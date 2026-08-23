import { sign as cryptoSign, generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { ingestReport } from "../src/ingestion/ingest-report.js";

// D4 validation pipeline, ordered fail-fast: size -> parse -> schema -> token
// -> IB/allowlist -> rate limit -> monotonicity -> insert. No live DB: every
// data-access dependency is injected (same pattern as db/queries.js callers).
const AUDIENCE = "https://registry.example.test";
const ISSUER = "https://token.actions.githubusercontent.com";
const ALLOWED_OWNERS = new Set(["octo-org"]);

let privateKey: import("node:crypto").KeyObject;
let publicJwk: Record<string, unknown>;

beforeAll(() => {
  const { publicKey, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  privateKey = priv;
  publicJwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
});

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function mintToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER,
    aud: AUDIENCE,
    exp: now + 300,
    iat: now,
    nbf: now,
    jti: `jti-${Math.random()}`,
    repository: "octo-org/web",
    repository_id: 123,
    repository_owner: "octo-org",
    ...overrides,
  };
  const headerB64 = base64url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
  const payloadB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

const validReport = {
  app: "web",
  dsVersion: "1.2.3",
  dsVersionSource: "declared",
  components: ["Button"],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

function baseDeps(overrides: Record<string, unknown> = {}) {
  return {
    audience: AUDIENCE,
    allowedOwners: ALLOWED_OWNERS,
    loadJwks: async () => ({ keys: [publicJwk] }),
    checkAndRecordReplay: async () => false,
    countRecentSubmissions: async () => 0,
    getLatestGeneratedAt: async () => null,
    insertSubmission: vi.fn(async () => undefined),
    ...overrides,
  };
}

function request(
  overrides: {
    rawBody?: string;
    contentLength?: number;
    contentType?: string | undefined;
    authorizationHeader?: string;
    reportBody?: Record<string, unknown>;
    tokenClaims?: Record<string, unknown>;
    deps?: Record<string, unknown>;
  } = {},
) {
  const rawBody = overrides.rawBody ?? JSON.stringify(overrides.reportBody ?? validReport);
  return {
    rawBody,
    contentLength: overrides.contentLength ?? Buffer.byteLength(rawBody),
    contentType: "contentType" in overrides ? overrides.contentType : "application/json",
    authorizationHeader:
      "authorizationHeader" in overrides
        ? overrides.authorizationHeader
        : `Bearer ${mintToken(overrides.tokenClaims ?? {})}`,
    deps: baseDeps(overrides.deps ?? {}),
  };
}

describe("ingestReport (D4 pipeline)", () => {
  it("accepts a valid authenticated report and appends it (never updates/deletes)", async () => {
    const insertSubmission = vi.fn(async () => undefined);
    const result = await ingestReport(request({ deps: { insertSubmission } }));
    expect(result.status).toBe(201);
    expect(insertSubmission).toHaveBeenCalledTimes(1);
    expect(insertSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ repositoryId: 123, appLabel: "web", components: ["Button"] }),
    );
  });

  it.each([
    [
      "a non-JSON content-type, before parsing",
      { contentType: "text/plain" },
      415,
      "unsupported_media_type",
    ],
    [
      "a missing content-type, before parsing",
      { contentType: undefined },
      415,
      "unsupported_media_type",
    ],
    [
      "a body over the 64 KiB size cap, before parsing",
      { contentLength: 64 * 1024 + 1 },
      413,
      "payload_too_large",
    ],
    ["malformed JSON", { rawBody: "{ not json" }, 400, "invalid_json"],
    ["a missing bearer token", { authorizationHeader: undefined }, 401, "token_invalid"],
    [
      "an unauthenticated/invalid token (wrong issuer)",
      { tokenClaims: { iss: "https://evil.example" } },
      401,
      "issuer_mismatch",
    ],
    [
      "an identity mismatch",
      { reportBody: { ...validReport, app: "mobile" } },
      403,
      "identity_mismatch",
    ],
    [
      "an owner outside the allowlist",
      { tokenClaims: { repository: "foreign-org/web", repository_owner: "foreign-org" } },
      403,
      "owner_not_allowed",
    ],
    [
      "a rate-limited repository (60/hour)",
      { deps: { countRecentSubmissions: async () => 60 } },
      429,
      "rate_limited",
    ],
    [
      "a stale report (RF-AR03 monotonicity)",
      { deps: { getLatestGeneratedAt: async () => new Date("2026-06-01T00:00:00.000Z") } },
      409,
      "stale_report",
    ],
  ])("rejects %s", async (_label, overrides, status, code) => {
    const result = await ingestReport(request(overrides));
    expect(result).toMatchObject({ status, body: { error: { code } } });
  });

  it("rejects a schema-invalid report with the failing field, payload never echoed", async () => {
    const result = await ingestReport(
      request({ reportBody: { ...validReport, app: "<img onerror=1>" } }),
    );
    expect(result).toMatchObject({
      status: 400,
      body: { error: { code: "schema_invalid", field: "app" } },
    });
    expect(JSON.stringify(result.body)).not.toContain("<img onerror=1>");
  });

  it("accepts a content-type with a charset parameter (application/json; charset=utf-8)", async () => {
    const result = await ingestReport(request({ contentType: "application/json; charset=utf-8" }));
    expect(result.status).toBe(201);
  });

  it("rejects an unsupported content-type before the size cap (gate order: content-type first)", async () => {
    const result = await ingestReport(
      request({ contentType: "text/plain", contentLength: 64 * 1024 + 1 }),
    );
    expect(result).toMatchObject({
      status: 415,
      body: { error: { code: "unsupported_media_type" } },
    });
  });

  it("accepts a report newer than the stored latest", async () => {
    const result = await ingestReport(
      request({ deps: { getLatestGeneratedAt: async () => new Date("2025-01-01T00:00:00.000Z") } }),
    );
    expect(result.status).toBe(201);
  });

  it("never leaks a secret-shaped value into the error body (RNF secrets handling)", async () => {
    process.env.DATABASE_URL = "postgres://user:s3cr3t@host/db";
    const result = await ingestReport(
      request({
        deps: {
          insertSubmission: vi.fn(async () => {
            throw new Error(`connection failed: ${process.env.DATABASE_URL}`);
          }),
        },
      }),
    );
    expect(JSON.stringify(result.body)).not.toContain("s3cr3t");
    delete process.env.DATABASE_URL;
  });
});
