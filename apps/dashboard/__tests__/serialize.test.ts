import { describe, expect, it } from "vitest";
import { serializeReport, toRegistryFileReport } from "../src/reports/serialize";

const baseRow = {
  repository: "acme/web",
  appLabel: "web",
  dsVersion: "1.4.0",
  dsVersionSource: "installed",
  components: ["Button", "Dialog"],
  deprecatedComponents: null,
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("serialize.js (D3/D4 shapes)", () => {
  it("serializeReport maps DB fields to public shape and preserves null-vs-[] honesty", () => {
    const report = serializeReport({ ...baseRow, generatedAt: new Date("2026-02-02T10:00:00Z") });
    expect(report).toEqual({
      repository: "acme/web",
      app: "web",
      dsVersion: "1.4.0",
      dsVersionSource: "installed",
      components: ["Button", "Dialog"],
      deprecatedComponents: null,
      generatedAt: "2026-02-02T10:00:00.000Z",
    });
    expect(serializeReport({ ...baseRow, deprecatedComponents: [] }).deprecatedComponents).toEqual(
      [],
    );
  });

  it("toRegistryFileReport drops DB-only fields, matches the audit shape, honors the omit rule", () => {
    const known = toRegistryFileReport({ ...baseRow, deprecatedComponents: ["Dialog"] });
    expect(known).not.toHaveProperty("repository");
    expect(Object.keys(known)).toEqual([
      "app",
      "dsVersion",
      "dsVersionSource",
      "components",
      "generatedAt",
      "deprecatedComponents",
    ]);
    expect(toRegistryFileReport(baseRow)).not.toHaveProperty("deprecatedComponents");
  });
});
