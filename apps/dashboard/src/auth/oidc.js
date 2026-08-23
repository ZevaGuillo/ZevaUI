// D1: GitHub Actions OIDC verification. `loadJwks` and `checkAndRecordReplay`
// are injected so this module never hard-couples to a network call or the
// DB -- production wiring binds real ones (JWKS_URI + oidc_jti), tests bind
// fakes. Fail-closed: any JWKS fetch failure is `store_unavailable` (503),
// never a bypass.
import { createPublicKey, verify as cryptoVerify } from "node:crypto";

export const ISSUER = "https://token.actions.githubusercontent.com";
export const JWKS_URI = `${ISSUER}/.well-known/jwks`;
const CLOCK_SKEW_SECONDS = 60;

/** @typedef {import("node:crypto").JsonWebKey & { kid?: string }} JwksKey */

export class OidcVerificationError extends Error {
  /** @param {string} code @param {number} status @param {string} message */
  constructor(code, status, message) {
    super(message);
    this.name = "OidcVerificationError";
    this.code = code;
    this.status = status;
  }
}

/** @param {string} code @param {number} status @param {string} message @returns {never} */
function fail(code, status, message) {
  throw new OidcVerificationError(code, status, message);
}

/** @param {string} segment */
function decodeBase64Url(segment) {
  return Buffer.from(segment, "base64url");
}

/** @param {string} token */
function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) fail("token_invalid", 401, "malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;
  try {
    return {
      header: JSON.parse(decodeBase64Url(headerB64).toString("utf8")),
      payload: JSON.parse(decodeBase64Url(payloadB64).toString("utf8")),
      signingInput: `${headerB64}.${payloadB64}`,
      signature: decodeBase64Url(signatureB64),
    };
  } catch {
    return fail("token_invalid", 401, "token header/payload is not valid JSON");
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {{ audience: string, now: number }} ctx
 */
function verifyClaims(payload, { audience, now }) {
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

/**
 * @param {{
 *   token: string,
 *   audience: string,
 *   now?: number,
 *   loadJwks: () => Promise<{ keys?: JwksKey[] }>,
 *   checkAndRecordReplay: (jti: string, expiresAt: Date) => Promise<boolean>,
 * }} options
 * @returns {Promise<Record<string, unknown>>}
 */
export async function verifyOidcToken({
  token,
  audience,
  now = Date.now(),
  loadJwks,
  checkAndRecordReplay,
}) {
  const { header, payload, signingInput, signature } = decodeJwt(token);

  // alg/kid rejected BEFORE any JWKS fetch (D1: "rejected before key lookup").
  if (header.alg !== "RS256") fail("token_invalid", 401, `unsupported alg "${header.alg}"`);
  if (!header.kid) fail("token_invalid", 401, "token is missing kid");

  let jwks;
  try {
    jwks = await loadJwks();
  } catch {
    return fail("store_unavailable", 503, "JWKS endpoint unreachable");
  }
  const key = jwks.keys?.find((candidate) => candidate.kid === header.kid);
  if (!key) fail("token_invalid", 401, "no matching JWKS key for kid");

  let publicKey;
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
