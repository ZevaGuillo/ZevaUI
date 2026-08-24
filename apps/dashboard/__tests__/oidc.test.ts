import { sign as cryptoSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyOidcToken } from "../src/auth/oidc";

// D1 gate table: local JWKS + minted RS256 tokens, no real GitHub call.
const AUDIENCE = "https://registry.example.test";
const ISSUER = "https://token.actions.githubusercontent.com";

let privateKey: KeyObject;
let publicJwk: Record<string, unknown>;

beforeAll(() => {
  const { publicKey, privateKey: priv } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  privateKey = priv;
  publicJwk = { ...publicKey.export({ format: "jwk" }), kid: "test-kid", alg: "RS256", use: "sig" };
});

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

function mintToken(
  claims: Record<string, unknown>,
  { alg = "RS256", kid = "test-kid" }: { alg?: string; kid?: string } = {},
) {
  const headerB64 = base64url(JSON.stringify({ alg, kid, typ: "JWT" }));
  const payloadB64 = base64url(JSON.stringify(claims));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = cryptoSign("RSA-SHA256", Buffer.from(signingInput), privateKey);
  return `${signingInput}.${base64url(signature)}`;
}

function validClaims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    exp: now + 300,
    iat: now,
    nbf: now,
    jti: "jti-1",
    repository: "octo/web",
    ...overrides,
  };
}

const loadJwks = async () => ({ keys: [publicJwk] });
const noReplay = async () => false;

/** @param {Partial<Parameters<typeof verifyOidcToken>[0]>} overrides */
function verify(token: string, overrides: Partial<Parameters<typeof verifyOidcToken>[0]> = {}) {
  return verifyOidcToken({
    token,
    audience: AUDIENCE,
    loadJwks,
    checkAndRecordReplay: noReplay,
    ...overrides,
  });
}

describe("verifyOidcToken (D1 gate table)", () => {
  it("accepts a validly signed, on-time token and returns its claims", async () => {
    await expect(verify(mintToken(validClaims()))).resolves.toMatchObject({
      repository: "octo/web",
    });
  });

  it("accepts a token expired within the 60s skew tolerance", async () => {
    const now = Math.floor(Date.now() / 1000);
    await expect(verify(mintToken(validClaims({ exp: now - 30 })))).resolves.toMatchObject({
      jti: "jti-1",
    });
  });

  it.each([
    ["wrong issuer", validClaims({ iss: "https://evil.example" }), {}, "issuer_mismatch", 401],
    ["wrong audience", validClaims({ aud: "https://other.example" }), {}, "audience_mismatch", 401],
    [
      "expired beyond the 60s skew tolerance",
      validClaims({ exp: Math.floor(Date.now() / 1000) - 90 }),
      {},
      "token_expired",
      401,
    ],
    [
      "not-yet-valid beyond the 60s nbf skew tolerance",
      validClaims({ nbf: Math.floor(Date.now() / 1000) + 90 }),
      {},
      "token_expired",
      401,
    ],
    [
      "a kid with no matching JWKS key",
      validClaims(),
      { kid: "unknown-kid" },
      "token_invalid",
      401,
    ],
  ])("rejects %s", async (_label, claims, tokenOpts, code, status) => {
    await expect(verify(mintToken(claims, tokenOpts))).rejects.toMatchObject({ code, status });
  });

  it("rejects alg:none before ever fetching JWKS (key lookup never happens)", async () => {
    let jwksCalled = false;
    await expect(
      verify(mintToken(validClaims(), { alg: "none" }), {
        loadJwks: async () => {
          jwksCalled = true;
          return { keys: [] };
        },
      }),
    ).rejects.toMatchObject({ code: "token_invalid", status: 401 });
    expect(jwksCalled).toBe(false);
  });

  it("rejects a replayed jti", async () => {
    await expect(
      verify(mintToken(validClaims()), { checkAndRecordReplay: async () => true }),
    ).rejects.toMatchObject({ code: "token_replayed", status: 401 });
  });

  it("fails closed with 503 when the JWKS store is unreachable", async () => {
    await expect(
      verify(mintToken(validClaims()), {
        loadJwks: async () => {
          throw new Error("network down");
        },
      }),
    ).rejects.toMatchObject({ code: "store_unavailable", status: 503 });
  });
});
