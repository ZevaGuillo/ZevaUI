// Opt-in, always-exit-0 POST client (design D6, RF-AR06). Fire-and-tolerate:
// a dead, slow, or misconfigured registry costs the consumer this script's
// own 10-second budget and a `::warning::` annotation — never a red build,
// never a changed report. This is the single most important property of
// this file: nothing in here may ever cause a nonzero exit.
//
// Dependency-free, like the rest of this package: `node:https` directly, no
// `fetch`, no HTTP client library. Runs as a SEPARATE, opt-in step after the
// scan already wrote its report — it never runs unless the consumer set
// `registry-url`, and it never mutates the report file it reads.
//
// Inputs arrive as env vars, never argv: the reusable workflow (PR5) passes
// `registry-url` through `env:`, never interpolated into a `run:` body,
// which is the one thing standing between caller-controlled text and a
// shell (Threat Matrix: argument/env composition).
import { appendFileSync, readFileSync } from "node:fs";
import https from "node:https";

// The whole submission, INCLUDING every retry, is bounded to this budget —
// not 10s per attempt. Three attempts at 10s each could cost a consumer 30s
// for a registry that never answers; that is not what "costs 10 seconds"
// means in the design.
const TOTAL_BUDGET_MS = 10_000;
// 1 initial attempt + up to 2 retries.
const MAX_ATTEMPTS = 3;
const REGISTRY_REPORT_PATH_NAME = "/api/v1/reports";

/** @param {string} message */
function warn(message) {
  console.log(`::warning::[submit-report] ${message}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n> **Registry submission**: ${message}\n`, {
      flag: "a",
    });
  }
}

// A rejected submission is explained to the consumer through one
// `::warning::` line and nothing else. Carrying only the status makes
// `owner_not_allowed` and `identity_mismatch` — different fixes, different
// people — indistinguishable without reading the registry's source, which an
// external consumer cannot do.
//
// The body is NOT trusted. `registry-url` is chosen by the caller, so the
// response comes from whatever host that URL resolves to, and it flows into
// a workflow-command context. A code carrying a newline and `::add-mask::`
// or `::stop-commands::` would be command injection into the consumer's own
// run. Hence a strict allowlist rather than escaping: every code in the
// registry's taxonomy is a snake_case identifier, so nothing legitimate is
// lost by discarding everything else.
const MAX_ERROR_BODY_BYTES = 2048;
const MAX_ERROR_CODE_LENGTH = 64;
const DISALLOWED_IN_ERROR_CODE = /[^A-Za-z0-9_.-]/g;

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function sanitizeErrorCode(value) {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(DISALLOWED_IN_ERROR_CODE, "").slice(0, MAX_ERROR_CODE_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Never throws: a malformed body is simply a body that explains nothing,
 * which is the pre-existing behaviour and not a reason to fail a submission
 * that already failed.
 *
 * @param {string} body
 * @returns {string | undefined}
 */
function errorCodeFrom(body) {
  try {
    const parsed = JSON.parse(body);
    return sanitizeErrorCode(parsed?.error?.code);
  } catch {
    return undefined;
  }
}

/**
 * @typedef {{ kind: "response", status: number, code?: string }
 *   | { kind: "connect-error", message: string }
 *   | { kind: "timeout-exhausted" }} SubmitOutcome
 */
/**
 * The subset of `https.request`'s signature `postOnce` actually uses —
 * narrower than `typeof https.request` on purpose, so a fake transport in
 * tests can satisfy it without matching Node's full overloaded type.
 * @typedef {(
 *   url: URL,
 *   options: import("node:https").RequestOptions,
 *   callback: (response: import("node:http").IncomingMessage) => void,
 * ) => import("node:http").ClientRequest} RequestFn
 */

// Retryable means "this attempt proved nothing about OUR request" — a
// connection that never completed, or the server admitting it failed on its
// own (5xx). A 4xx means WE sent something the server understood and
// rejected; retrying an identical request produces an identical rejection,
// so it is noise, never resilience.
/** @param {SubmitOutcome} outcome */
function isRetryable(outcome) {
  if (outcome.kind === "connect-error") return true;
  if (outcome.kind === "response") return outcome.status >= 500;
  return false;
}

/**
 * One HTTP attempt. `requestFn` defaults to `https.request` and exists only
 * as a seam: it lets tests exercise the retry/timeout state machine against
 * a fake transport with deterministic outcomes, the same way
 * walk-source-tree.js's injectable `io` covers filesystem paths no portable
 * fixture can produce — a live 5xx or a mid-response hang is exactly that
 * kind of path here.
 *
 * @param {object} options
 * @param {URL} options.url
 * @param {string} options.token
 * @param {Buffer} options.payload
 * @param {number} options.timeoutMs
 * @param {RequestFn} [options.requestFn]
 * @returns {Promise<SubmitOutcome>}
 */
function postOnce({ url, token, payload, timeoutMs, requestFn = https.request }) {
  return new Promise((resolve) => {
    let settled = false;
    /** @param {SubmitOutcome} outcome */
    const settle = (outcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const request = requestFn(
      url,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": payload.length,
          authorization: `Bearer ${token}`,
        },
        timeout: Math.max(1, timeoutMs),
      },
      (response) => {
        const status = response.statusCode ?? 0;
        // A success explains itself. Draining without reading lets the socket
        // close instead of leaking a half-read response.
        if (status >= 200 && status < 300) {
          response.resume();
          settle({ kind: "response", status });
          return;
        }

        // A rejection is the one case worth reading, and only up to a cap:
        // the far side is consumer-chosen and may answer with a megabyte of
        // HTML. Chunks past the cap are still consumed — dropping them from
        // the buffer is not the same as stopping the drain, and stopping it
        // would hold the socket open until the request timeout.
        let body = "";
        let bytes = 0;
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          const text = String(chunk);
          if (bytes >= MAX_ERROR_BODY_BYTES) return;
          bytes += text.length;
          body += text;
        });
        response.on("end", () =>
          settle({
            kind: "response",
            status,
            code: errorCodeFrom(body.slice(0, MAX_ERROR_BODY_BYTES)),
          }),
        );
        // A truncated response still told us the status, which is more than
        // reporting a connection error would.
        response.on("error", () => settle({ kind: "response", status }));
      },
    );

    request.on("timeout", () => {
      request.destroy();
      settle({ kind: "connect-error", message: "request timed out" });
    });
    request.on("error", (error) => {
      settle({ kind: "connect-error", message: error.message });
    });

    request.end(payload);
  });
}

/**
 * @param {object} options
 * @param {URL} options.url
 * @param {string} options.token
 * @param {Buffer} options.payload
 * @param {RequestFn} [options.requestFn]
 * @param {number} [options.deadline] epoch ms; defaults to now + the total budget
 * @returns {Promise<
 *   { ok: true, attempts: number, status: number }
 *   | { ok: false, attempts: number, outcome: SubmitOutcome }
 * >}
 */
export async function submitWithRetries({
  url,
  token,
  payload,
  requestFn,
  deadline = Date.now() + TOTAL_BUDGET_MS,
}) {
  /** @type {SubmitOutcome} */
  let outcome = { kind: "timeout-exhausted" };
  let attempts = 0;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      outcome = { kind: "timeout-exhausted" };
      break;
    }
    attempts = attempt;
    outcome = await postOnce({ url, token, payload, timeoutMs: remaining, requestFn });
    if (outcome.kind === "response" && outcome.status >= 200 && outcome.status < 300) {
      return { ok: true, attempts, status: outcome.status };
    }
    if (!isRetryable(outcome)) break;
  }

  return { ok: false, attempts, outcome };
}

/**
 * Parses `registryUrlInput` and resolves the ingestion endpoint, forcing
 * `https:` unconditionally — regardless of what scheme the consumer wrote.
 * `new URL()` is the injection defense: a payload shaped like shell syntax
 * is not a valid URL and throws here, before any request is even
 * constructed (Threat Matrix: argument/env composition).
 *
 * @param {string} registryUrlInput
 * @returns {URL}
 */
export function resolveIngestionUrl(registryUrlInput) {
  const parsed = new URL(registryUrlInput);
  parsed.protocol = "https:";
  return new URL(REGISTRY_REPORT_PATH_NAME, parsed);
}

/** @param {SubmitOutcome} outcome */
export function describeOutcome(outcome) {
  if (outcome.kind === "response") {
    // The code is what tells a consumer which gate rejected them, and
    // therefore whose fix it is: `owner_not_allowed` is the registry
    // operator's allowlist, `identity_mismatch` is the caller's `app` input.
    return outcome.code
      ? `the registry responded ${outcome.status} (${outcome.code})`
      : `the registry responded ${outcome.status}`;
  }
  if (outcome.kind === "connect-error") return `a connection error (${outcome.message})`;
  return "the 10s submission budget was exhausted";
}

async function main() {
  // Belt-and-braces: even if every guard below were somehow bypassed, no
  // code path in this file may set a nonzero exit code.
  process.exitCode = 0;

  const registryUrlInput = process.env.REGISTRY_URL;
  if (!registryUrlInput) {
    // The workflow already guards this whole step on
    // `inputs.registry-url != ''`, so this should not normally run — but a
    // fire-and-tolerate script never trusts that from the inside either.
    return;
  }

  let url;
  try {
    url = resolveIngestionUrl(registryUrlInput);
  } catch (error) {
    warn(
      `registry-url is not a valid URL (${error instanceof Error ? error.message : String(error)}); skipped submission`,
    );
    return;
  }

  const token = process.env.REGISTRY_OIDC_TOKEN;
  if (!token) {
    warn("no OIDC token was available for the registry audience; skipped submission");
    return;
  }

  const reportPath = process.env.REGISTRY_REPORT_PATH;
  if (!reportPath) {
    warn("REGISTRY_REPORT_PATH was not set; skipped submission");
    return;
  }

  let payload;
  try {
    payload = Buffer.from(readFileSync(reportPath, "utf8"), "utf8");
  } catch (error) {
    warn(
      `could not read the report at "${reportPath}" (${error instanceof Error ? error.message : String(error)}); skipped submission`,
    );
    return;
  }

  const result = await submitWithRetries({ url, token, payload });
  if (!result.ok) {
    warn(
      `gave up after ${result.attempts} attempt(s): ${describeOutcome(result.outcome)}. The ` +
        "report was still uploaded as an artifact by the step above; only the registry copy is missing.",
    );
    return;
  }

  console.log(
    `[submit-report] submitted after ${result.attempts} attempt(s), status ${result.status}.`,
  );
}

main().catch((error) => {
  // The final backstop: nothing thrown anywhere above may ever surface as a
  // nonzero exit or an uncaught-exception stack trace in the consumer's log.
  warn(
    `unexpected error (${error instanceof Error ? error.message : String(error)}); skipped submission`,
  );
});
