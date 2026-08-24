// D4 ingestion pipeline, ordered fail-fast, one error code per gate. Every
// data-access dependency is injected (deps.*) so this stays unit-testable
// without a live database -- production wiring binds real queries in
// route.js. Payload is NEVER echoed back; on an unexpected error, only a
// generic message is returned (never the raw error, which may carry a
// secret value from a thrown DB/network error).
import { type ValidationResult, validateReport } from "@zevaui/audit/report-schema";
import { type JwksKey, OidcVerificationError, verifyOidcToken } from "../auth/oidc";
import type { NewSubmission } from "../db/schema";
import { checkIdentityBinding } from "./identity-binding";

export const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_PER_HOUR = 60;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export type IngestSuccessResult = {
  readonly status: 201;
  readonly body: { readonly accepted: true };
};

export type IngestErrorResult = {
  readonly status: number;
  readonly body: {
    readonly error: { readonly code: string; readonly message: string; readonly field?: string };
  };
};

export type IngestResult = IngestSuccessResult | IngestErrorResult;

function errorResult(
  status: number,
  code: string,
  message: string,
  field?: string,
): IngestErrorResult {
  return { status, body: { error: field ? { code, message, field } : { code, message } } };
}

// D4 step 1: the request body is only ever application/json. Parameters
// (e.g. `; charset=utf-8`) are ignored, matching how the platform itself
// negotiates content types.
export function payloadTooLargeResult(): IngestErrorResult {
  return errorResult(413, "payload_too_large", "request body exceeds 64 KiB");
}

function isJsonContentType(contentType: string | undefined): boolean {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

function extractBearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/.exec(header ?? "");
  return match ? match[1] : null;
}

// The shape `report-schema.js` validates -- see `ambient` declaration in
// src/types/audit-report-schema.d.ts for why this is declared locally
// rather than imported.
export type ValidatedReport = {
  readonly app: string;
  readonly dsVersion: string;
  readonly dsVersionSource: string;
  readonly components: readonly string[];
  readonly deprecatedComponents?: readonly string[];
  readonly generatedAt: string;
};

// `parsed` is `unknown` until `validateReport` has actually run its runtime
// checks; this guard reads that real boolean rather than blindly asserting
// the shape, so the narrowing stays honest about what was actually checked.
function isValidatedReport(value: unknown, result: ValidationResult): value is ValidatedReport {
  return result.valid;
}

export type IngestReportDeps = {
  readonly audience: string;
  readonly allowedOwners: ReadonlySet<string>;
  readonly loadJwks: () => Promise<{ keys?: JwksKey[] }>;
  readonly checkAndRecordReplay: (jti: string, expiresAt: Date) => Promise<boolean>;
  readonly countRecentSubmissions: (repositoryId: number, since: Date) => Promise<number>;
  readonly getLatestGeneratedAt: (repositoryId: number, appLabel: string) => Promise<Date | null>;
  readonly insertSubmission: (values: NewSubmission) => Promise<unknown>;
  readonly now?: number;
};

export type IngestReportRequest = {
  readonly rawBody: string;
  readonly contentLength: number;
  readonly contentType: string | undefined;
  readonly authorizationHeader: string | undefined;
  readonly deps: IngestReportDeps;
};

export async function ingestReport({
  rawBody,
  contentLength,
  contentType,
  authorizationHeader,
  deps,
}: IngestReportRequest): Promise<IngestResult> {
  const now = deps.now ?? Date.now();

  // D4 step 1, gate a: content-type, checked before parsing (and before the
  // size cap, which is the platform's own transport-level backstop).
  if (!isJsonContentType(contentType)) {
    return errorResult(415, "unsupported_media_type", "content-type must be application/json");
  }

  // D4 step 1, gate b: size cap. The pre-buffer guard against
  // request.text() lives in route.js; this is the backstop for a request
  // that omits or understates Content-Length.
  if (contentLength > MAX_BODY_BYTES) {
    return payloadTooLargeResult();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return errorResult(400, "invalid_json", "request body is not valid JSON");
  }

  const schemaResult = validateReport(parsed);
  if (!schemaResult.valid) {
    return errorResult(400, "schema_invalid", schemaResult.message, schemaResult.field);
  }
  if (!isValidatedReport(parsed, schemaResult)) {
    // Unreachable in practice: schemaResult.valid is true here. Kept so the
    // rest of this function works against a real, narrowed report type
    // instead of `unknown`.
    return errorResult(500, "internal_error", "an unexpected error occurred");
  }

  const token = extractBearerToken(authorizationHeader);
  if (!token) return errorResult(401, "token_invalid", "missing bearer token");

  let claims: Record<string, unknown>;
  try {
    claims = await verifyOidcToken({
      token,
      audience: deps.audience,
      loadJwks: deps.loadJwks,
      checkAndRecordReplay: deps.checkAndRecordReplay,
      now,
    });
  } catch (error) {
    if (error instanceof OidcVerificationError) {
      return errorResult(error.status, error.code, error.message);
    }
    throw error;
  }

  const ib = checkIdentityBinding({
    app: parsed.app,
    repository: String(claims.repository),
    repositoryOwner: String(claims.repository_owner),
    allowedOwners: deps.allowedOwners,
  });
  if (!ib.ok) return errorResult(ib.status, ib.code, ib.message);

  try {
    const repositoryId = Number(claims.repository_id);
    const recentCount = await deps.countRecentSubmissions(
      repositoryId,
      new Date(now - RATE_WINDOW_MS),
    );
    if (recentCount >= RATE_LIMIT_PER_HOUR) {
      return errorResult(429, "rate_limited", "too many submissions for this repository this hour");
    }

    const latestGeneratedAt = await deps.getLatestGeneratedAt(repositoryId, parsed.app);
    const generatedAtMs = Date.parse(parsed.generatedAt);
    if (latestGeneratedAt !== null && generatedAtMs <= latestGeneratedAt.getTime()) {
      return errorResult(
        409,
        "stale_report",
        "generatedAt is not newer than the stored latest report",
      );
    }

    await deps.insertSubmission({
      repositoryId,
      repository: String(claims.repository),
      appLabel: parsed.app,
      dsVersion: parsed.dsVersion,
      dsVersionSource: parsed.dsVersionSource,
      components: [...parsed.components],
      deprecatedComponents: parsed.deprecatedComponents ? [...parsed.deprecatedComponents] : null,
      schemaVersion: parsed.deprecatedComponents ? 2 : 1,
      generatedAt: new Date(generatedAtMs),
      payload: parsed,
    });
  } catch {
    // Never surface a raw error (may carry DATABASE_URL or other secrets).
    return errorResult(500, "internal_error", "an unexpected error occurred");
  }

  return { status: 201, body: { accepted: true } };
}
