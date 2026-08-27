// D1: GitHub Actions OIDC verification. `loadJwks` and `checkAndRecordReplay`
// are injected so this module never hard-couples to a network call or the
// DB -- production wiring binds real ones (JWKS_URI + oidc_jti), tests bind
// fakes. Fail-closed: any JWKS fetch failure is `store_unavailable` (503),
// never a bypass.
import { createPublicKey, verify as cryptoVerify, type JsonWebKey } from "node:crypto";

export const ISSUER = "https://token.actions.githubusercontent.com";
export const JWKS_URI = `${ISSUER}/.well-known/jwks`;
export const CLOCK_SKEW_SECONDS = 60;

export type JwksKey = JsonWebKey & { readonly kid?: string };

export class OidcVerificationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.name = "OidcVerificationError";
    this.code = code;
    this.status = status;
  }
}

function fail(code: string, status: number, message: string): never {
  throw new OidcVerificationError(code, status, message);
}

function decodeBase64Url(segment: string): Buffer {
  return Buffer.from(segment, "base64url");
}

type DecodedJwt = {
  readonly header: Record<string, unknown>;
  readonly payload: Record<string, unknown>;
  readonly signingInput: string;
  readonly signature: Buffer;
};

function decodeJwt(token: string): DecodedJwt {
  const parts = token.split(".");
  if (parts.length !== 3) fail("token_invalid", 401, "malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;
  try {
    const header: Record<string, unknown> = JSON.parse(decodeBase64Url(headerB64).toString("utf8"));
    const payload: Record<string, unknown> = JSON.parse(
      decodeBase64Url(payloadB64).toString("utf8"),
    );
    return {
      header,
      payload,
      signingInput: `${headerB64}.${payloadB64}`,
      signature: decodeBase64Url(signatureB64),
    };
  } catch {
    return fail("token_invalid", 401, "token header/payload is not valid JSON");
  }
}

function verifyClaims(
  payload: Record<string, unknown>,
  { audience, now }: { audience: string; now: number },
): void {
  if (payload.iss !== ISSUER) fail("issuer_mismatch", 401, `unexpected issuer "${payload.iss}"`);
  if (payload.aud !== audience) fail("audience_mismatch", 401, "audience does not match");

  const nowSec = Math.floor(now / 1000);
  if (typeof payload.exp !== "number" || nowSec > payload.exp + CLOCK_SKEW_SECONDS) {
    fail("token_expired", 401, "token has expired");
  }
  if (typeof payload.nbf === "number" && nowSec < payload.nbf - CLOCK_SKEW_SECONDS) {
    fail("token_expired", 401, "token is not yet valid");
  }
  if (typeof payload.iat === "number" && nowSec < payload.iat - CLOCK_SKEW_SECONDS) {
    fail("token_expired", 401, "token issued in the future");
  }
}

export type VerifyOidcTokenOptions = {
  readonly token: string;
  readonly audience: string;
  readonly now?: number;
  readonly loadJwks: () => Promise<{ keys?: JwksKey[] }>;
  readonly checkAndRecordReplay: (jti: string, expiresAt: Date) => Promise<boolean>;
};

export async function verifyOidcToken({
  token,
  audience,
  now = Date.now(),
  loadJwks,
  checkAndRecordReplay,
}: VerifyOidcTokenOptions): Promise<Record<string, unknown>> {
  const { header, payload, signingInput, signature } = decodeJwt(token);

  // alg/kid rejected BEFORE any JWKS fetch (D1: "rejected before key lookup").
  if (header.alg !== "RS256") fail("token_invalid", 401, `unsupported alg "${header.alg}"`);
  if (!header.kid) fail("token_invalid", 401, "token is missing kid");

  let jwks: { keys?: JwksKey[] };
  try {
    jwks = await loadJwks();
  } catch {
    return fail("store_unavailable", 503, "JWKS endpoint unreachable");
  }
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!key) fail("token_invalid", 401, "no matching JWKS key for kid");

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = createPublicKey({ key, format: "jwk" });
  } catch {
    return fail("token_invalid", 401, "JWKS key is not a valid RSA public key");
  }
  const signatureValid = cryptoVerify(
    "RSA-SHA256",
    Buffer.from(signingInput, "utf8"),
    publicKey,
    signature,
  );
  if (!signatureValid) fail("token_invalid", 401, "signature verification failed");

  verifyClaims(payload, { audience, now });

  if (typeof payload.jti !== "string" || !payload.jti) {
    fail("token_invalid", 401, "token is missing jti");
  }
  if (typeof payload.exp !== "number") fail("token_invalid", 401, "token is missing exp");
  const alreadySeen = await checkAndRecordReplay(payload.jti, new Date(payload.exp * 1000));
  if (alreadySeen) fail("token_replayed", 401, "token jti has already been used");

  return payload;
}
