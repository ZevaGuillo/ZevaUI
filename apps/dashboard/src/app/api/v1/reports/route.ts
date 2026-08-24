import { NextResponse } from "next/server";
import { JWKS_URI, type JwksKey } from "../../../../auth/oidc.js";
import { getDb } from "../../../../db/client.js";
import {
  allLatestReportsQuery,
  insertSubmissionQuery,
  latestGeneratedAtQuery,
  recentSubmissionCountQuery,
} from "../../../../db/queries.js";
import { oidcJti } from "../../../../db/schema.js";
import {
  ingestReport,
  MAX_BODY_BYTES,
  payloadTooLargeResult,
} from "../../../../ingestion/ingest-report.js";
import { serializeReport } from "../../../../reports/serialize.js";

// D4: GET /api/v1/reports -- public. Thin wiring; query/response shapes
// are unit-covered in db/queries.test.ts and reports/serialize.test.ts.
export async function GET(): Promise<NextResponse> {
  const rows = await allLatestReportsQuery(getDb());
  return NextResponse.json(rows.map(serializeReport));
}

async function loadJwks(): Promise<{ keys?: JwksKey[] }> {
  const response = await fetch(JWKS_URI);
  if (!response.ok) throw new Error(`JWKS endpoint returned ${response.status}`);
  return response.json();
}

// D1 replay guard: an atomic insert-or-detect-conflict on the jti primary key.
async function checkAndRecordReplay(jti: string, expiresAt: Date): Promise<boolean> {
  const inserted = await getDb()
    .insert(oidcJti)
    .values({ jti, expiresAt })
    .onConflictDoNothing({ target: oidcJti.jti })
    .returning({ jti: oidcJti.jti });
  return inserted.length === 0;
}

function allowedOwnersFromEnv(): Set<string> {
  return new Set(
    (process.env.REGISTRY_ALLOWED_OWNERS ?? "")
      .split(",")
      .map((owner) => owner.trim())
      .filter(Boolean),
  );
}

// D1/D4: OIDC-authenticated ingestion. Pipeline logic (content-type/size/
// parse/schema/token/IB/rate-limit/monotonicity) lives in
// ingestion/ingest-report.js, unit-tested without a live DB; this wires the
// real dependencies.
export async function POST(request: Request): Promise<NextResponse> {
  // D4 step 1, gate b (pre-buffer): reject an oversized body from its
  // declared Content-Length BEFORE ever reading it into memory -- this is
  // the actual DoS-resistance mechanism. ingestReport's own contentLength
  // check remains as a backstop for a request that omits or understates
  // this header.
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    const { status, body } = payloadTooLargeResult();
    return NextResponse.json(body, { status });
  }

  const rawBody = await request.text();
  const db = getDb();
  const result = await ingestReport({
    rawBody,
    contentLength: Buffer.byteLength(rawBody),
    contentType: request.headers.get("content-type") ?? undefined,
    authorizationHeader: request.headers.get("authorization") ?? undefined,
    deps: {
      audience: process.env.REGISTRY_OIDC_AUDIENCE ?? "",
      allowedOwners: allowedOwnersFromEnv(),
      loadJwks,
      checkAndRecordReplay,
      countRecentSubmissions: async (repositoryId, since) =>
        (await recentSubmissionCountQuery(db, repositoryId, since))[0]?.value ?? 0,
      getLatestGeneratedAt: async (repositoryId, appLabel) =>
        (await latestGeneratedAtQuery(db, repositoryId, appLabel))[0]?.generatedAt ?? null,
      insertSubmission: async (values) => insertSubmissionQuery(db, values),
    },
  });
  return NextResponse.json(result.body, { status: result.status });
}
