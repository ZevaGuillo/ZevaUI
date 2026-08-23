import { describe, expect, it } from "vitest";
import { validateReport } from "../src/report-schema.js";

// D4: pure, dependency-free, one tested shape shared by audit tests and the
// ingestion API (packages/audit/src/report-schema.js, apps/dashboard's route).
const base = {
  app: "web",
  dsVersion: "1.2.3",
  dsVersionSource: "declared",
  components: ["Button", "Card"],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("validateReport (D4 bounds)", () => {
  it.each([
    ["the 5-key shape", base],
    ["the 6-key shape with deprecatedComponents", { ...base, deprecatedComponents: ["Dialog"] }],
    ["deprecatedComponents as an empty array (known-none)", { ...base, deprecatedComponents: [] }],
    ["app shaped like owner/repo (IB rule allows it)", { ...base, app: "octo-org/octo-repo" }],
    [
      "generatedAt just under the 24h future-skew bound",
      { ...base, generatedAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString() },
    ],
  ])("accepts %s", (_label, report) => {
    expect(validateReport(report)).toEqual({ valid: true });
  });

  it.each([
    ["a non-object payload", "not an object", "report"],
    ["an array payload", [], "report"],
    ["an unknown field", { ...base, extra: "nope" }, "extra"],
    ["app over 100 chars", { ...base, app: "a".repeat(101) }, "app"],
    ["app with an XSS payload", { ...base, app: "<img onerror=alert(1)>" }, "app"],
    ["dsVersion over 64 chars", { ...base, dsVersion: "1".repeat(65) }, "dsVersion"],
    ["dsVersion with an XSS payload", { ...base, dsVersion: "1.2.3<script>" }, "dsVersion"],
    ["an invalid dsVersionSource", { ...base, dsVersionSource: "guessed" }, "dsVersionSource"],
    [
      "components over the 500-entry cap",
      { ...base, components: Array(501).fill("Button") },
      "components",
    ],
    [
      "a component name outside the identifier charset",
      { ...base, components: ["<img onerror=1>"] },
      "components",
    ],
    [
      "deprecatedComponents over the 500-entry cap",
      { ...base, deprecatedComponents: Array(501).fill("Dialog") },
      "deprecatedComponents",
    ],
    ["a non-ISO generatedAt", { ...base, generatedAt: "not-a-date" }, "generatedAt"],
    [
      "generatedAt more than 24h in the future",
      { ...base, generatedAt: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() },
      "generatedAt",
    ],
  ])("rejects %s", (_label, report, expectedField) => {
    const result = validateReport(report);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.field).toBe(expectedField);
  });

  it.each(["app", "dsVersion", "dsVersionSource", "components", "generatedAt"])(
    "rejects a report missing required field %s",
    (field) => {
      const rest: Record<string, unknown> = { ...base };
      delete rest[field];
      const result = validateReport(rest);
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.field).toBe(field);
    },
  );
});
