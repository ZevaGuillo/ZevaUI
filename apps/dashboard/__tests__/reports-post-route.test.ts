import { describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/v1/reports/route.js";

// D4 step 1 (DoS resistance): the 64 KiB cap must be enforced from the
// declared Content-Length header BEFORE the body is ever buffered into
// memory via request.text(). This is transport wiring (needs the real
// Request object's headers), so it is exercised at the route layer, not
// inside the pure ingestion/ingest-report.js pipeline. No DB/env is touched
// on this path -- getDb() must never be reached either.
describe("POST /api/v1/reports -- pre-parse Content-Length guard (D4)", () => {
  it("rejects an oversized body via the Content-Length header without ever reading it", async () => {
    const text = vi.fn(async () => "unused");
    const request = {
      headers: new Headers({ "content-length": String(64 * 1024 + 1) }),
      text,
    } as unknown as Request;

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "payload_too_large" } });
    expect(text).not.toHaveBeenCalled();
  });
});
