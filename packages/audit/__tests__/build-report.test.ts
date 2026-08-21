import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReport, resolveDsVersion } from "../scripts/build-report.js";

let tempDirs: string[] = [];

function makeConsumerRoot() {
  const dir = mkdtempSync(path.join(tmpdir(), "zevaui-audit-build-report-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("buildReport", () => {
  it("returns exactly the five D8 keys, no deprecation key under any name", () => {
    const report = buildReport({
      app: "web",
      importsBySpecifier: [],
      dsVersion: "1.2.3",
      dsVersionSource: "installed",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(Object.keys(report).sort()).toEqual(
      ["app", "components", "dsVersion", "dsVersionSource", "generatedAt"].sort(),
    );
    expect(report).not.toHaveProperty("deprecatedComponentsUsed");
    expect(report.components).toEqual([]);
  });

  it("dedupes and alphabetically sorts components across multiple imports", () => {
    const report = buildReport({
      app: "web",
      importsBySpecifier: [
        { specifier: "@zevaui/components", names: ["Card", "Button"] },
        { specifier: "@zevaui/components", names: ["Button"] },
        { specifier: "@zevaui/tokens", names: ["spacingScale"] },
      ],
      dsVersion: "1.2.3",
      dsVersionSource: "installed",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(report.components).toEqual(["Button", "Card"]);
  });

  // The order is UTF-16 code-unit order, stated as a contract rather than
  // inherited from sort()'s default. It has to be byte-for-byte reproducible
  // on any runner, because the gate deep-equals this array against a committed
  // expected report — which is exactly why the comparator must NOT be
  // localeCompare: without an explicit locale that varies with the
  // environment's ICU, and two honest runs could sort differently.
  it("sorts components in deterministic code-unit order, uppercase before lowercase", () => {
    const report = buildReport({
      app: "web",
      importsBySpecifier: [
        { specifier: "@zevaui/components", names: ["iButton", "Zebra", "Alpha"] },
      ],
      dsVersion: "1.2.3",
      dsVersionSource: "installed",
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(report.components).toEqual(["Alpha", "Zebra", "iButton"]);
  });
});

describe("resolveDsVersion (D8 cascade)", () => {
  it("prefers the installed node_modules version when present", () => {
    const consumerRoot = makeConsumerRoot();
    const installedDir = path.join(consumerRoot, "node_modules", "@zevaui", "components");
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(path.join(installedDir, "package.json"), JSON.stringify({ version: "1.2.3" }));
    writeFileSync(
      path.join(consumerRoot, "package.json"),
      JSON.stringify({ dependencies: { "@zevaui/components": "^1.0.0" } }),
    );

    expect(resolveDsVersion({ consumerRoot })).toEqual({ version: "1.2.3", source: "installed" });
  });

  it("falls back to the declared range when node_modules is absent", () => {
    const consumerRoot = makeConsumerRoot();
    writeFileSync(
      path.join(consumerRoot, "package.json"),
      JSON.stringify({ dependencies: { "@zevaui/components": "^1.2.0" } }),
    );

    expect(resolveDsVersion({ consumerRoot })).toEqual({ version: "^1.2.0", source: "declared" });
  });

  it("follows dependencies -> devDependencies -> peerDependencies precedence", () => {
    const consumerRoot = makeConsumerRoot();
    writeFileSync(
      path.join(consumerRoot, "package.json"),
      JSON.stringify({
        peerDependencies: { "@zevaui/components": "^3.0.0" },
        devDependencies: { "@zevaui/components": "^2.0.0" },
      }),
    );

    expect(resolveDsVersion({ consumerRoot })).toEqual({ version: "^2.0.0", source: "declared" });
  });

  it("fails closed when neither an installed nor a declared version exists", () => {
    const consumerRoot = makeConsumerRoot();
    writeFileSync(path.join(consumerRoot, "package.json"), JSON.stringify({ dependencies: {} }));

    expect(resolveDsVersion({ consumerRoot })).toBeNull();
  });

  // The installed branch swallows a corrupt file because "unreadable" is not
  // proof of "not installed" — there is still the declared range to try. The
  // consumer's own package.json has no such successor: swallowing it would
  // report "not declared", which is a different and false claim.
  it("names a corrupt consumer package.json instead of reporting it as not declared", () => {
    const consumerRoot = makeConsumerRoot();
    writeFileSync(path.join(consumerRoot, "package.json"), '{ "dependencies": ');

    expect(() => resolveDsVersion({ consumerRoot })).toThrowError(/not valid JSON/);
  });

  it("still prefers a readable installed version over a corrupt consumer package.json", () => {
    const consumerRoot = makeConsumerRoot();
    const installedDir = path.join(consumerRoot, "node_modules", "@zevaui", "components");
    mkdirSync(installedDir, { recursive: true });
    writeFileSync(path.join(installedDir, "package.json"), JSON.stringify({ version: "1.2.3" }));
    writeFileSync(path.join(consumerRoot, "package.json"), "{ not json");

    expect(resolveDsVersion({ consumerRoot })).toEqual({ version: "1.2.3", source: "installed" });
  });
});
