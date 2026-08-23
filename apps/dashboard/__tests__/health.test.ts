import { describe, expect, it } from "vitest";
import { GET } from "../src/app/api/v1/health/route.js";

describe("GET /api/v1/health -- Route Handlers are plain functions, called directly", () => {
  it("responds 200 with a liveness payload, never touching the DB", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
