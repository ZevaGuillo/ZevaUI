// D4 ingestion pipeline, ordered fail-fast, one error code per gate. Every
// data-access dependency is injected (deps.*) so this stays unit-testable
// without a live database -- production wiring binds real queries in
// route.js. Payload is NEVER echoed back; on an unexpected error, only a
// generic message is returned (never the raw error, which may carry a
// secret value from a thrown DB/network error).
import { validateReport } from "@zevaui/audit/report-schema";
import { OidcVerificationError, verifyOidcToken } from "../auth/oidc.js";
import { checkIdentityBinding } from "./identity-binding.js";

/** @typedef {import("../auth/oidc.js").JwksKey} JwksKey */

export const MAX_BODY_BYTES = 64 * 1024;
const RATE_LIMIT_PER_HOUR = 60;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** @param {number} status @param {string} code @param {string} message @param {string} [field] */
function errorResult(status, code, message, field) {
  return { status, body: { error: field ? { code, message, field } : { code, message } } };
}

// D4 step 1: the request body is only ever application/json. Parameters
// (e.g. `; charset=utf-8`) are ignored, matching how the platform itself
// negotiates content types.
export function payloadTooLargeResult() {
  return errorResult(413, "payload_too_large", "request body exceeds 64 KiB");
}

/** @param {string | undefined} contentType */
function isJsonContentType(contentType) {
  const mediaType = contentType?.split(";")[0]?.trim().toLowerCase();
  return mediaType === "application/json";
}

/** @param {string | undefined} header */
function extractBearerToken(header) {
  const match = /^Bearer\s+(\S+)$/.exec(header ?? "");
  return match ? match[1] : null;
}

/**
 * @param {{
 *   rawBody: string,
 *   contentLength: number,
 *   contentType: string | undefined,
 *   authorizationHeader: string | undefined,
 *   deps: {
 *     audience: string,
 *     allowedOwners: Set<string>,
 *     loadJwks: () => Promise<{ keys?: JwksKey[] }>,
 *     checkAndRecordReplay: (jti: string, expiresAt: Date) => Promise<boolean>,
 *     countRecentSubmissions: (repositoryId: number, since: Date) => Promise<number>,
 *     getLatestGeneratedAt: (repositoryId: number, appLabel: string) => Promise<Date | null>,
 *     insertSubmission: (values: import("../db/schema.js").NewSubmission) => Promise<unknown>,
 *     now?: number,
 *   },
 * }} request
 */
export async function ingestReport({
  rawBody,
  contentLength,
  contentType,
  authorizationHeader,
  deps,
}) {
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

  let parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return errorResult(400, "invalid_json", "request body is not valid JSON");
  }

  const schemaResult = validateReport(parsed);
  if (!schemaResult.valid) {
    return errorResult(400, "schema_invalid", schemaResult.message, schemaResult.field);
  }

  const token = extractBearerToken(authorizationHeader);
  if (!token) return errorResult(401, "token_invalid", "missing bearer token");

  let claims;
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
      components: parsed.components,
      deprecatedComponents: parsed.deprecatedComponents ?? null,
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
