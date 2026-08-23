// Proves the fixture's report deep-equals the committed expected report
// (RF-UAW12), in BOTH shapes: the base 5-key report (RF-AR05 "v1 consumer
// keeps passing") and the additive 6-key report carrying
// `deprecatedComponents` (RF-AR04), once an installed manifest is readable.
// Plants a decoy DS import AND, for the second run, an installed manifest
// inside `node_modules` at run time (`.gitignore:2` blocks committing
// either), both removed in a `finally` — the visual gates' self-seeding
// pattern. Exit-code reading and the crash branch live in
// @zevaui/config/gate-harness, shared with the other gates in this repo.
import { deepStrictEqual } from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCrash, reportCrash, runNode } from "@zevaui/config/gate-harness";

const LABEL = "usage-audit-gate";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const entryScriptPath = path.join(scriptDir, "audit-usage.js");
const fixtureRoot = path.join(packageRoot, "__fixtures__", "consumer");
const expectedReportPath = path.join(packageRoot, "__fixtures__", "expected-report.json");
const expectedInstalledReportPath = path.join(
  packageRoot,
  "__fixtures__",
  "expected-report-installed.json",
);

const phantomNodeModules = path.join(fixtureRoot, "node_modules");
const phantomDir = path.join(phantomNodeModules, "@zevaui", "components", "src");
const phantomFile = path.join(phantomDir, "phantom.tsx");
// Absent from every must-find — a leaked collision would be silently
// swallowed by components[]'s dedup (measured, see git history: 5.3).
const PHANTOM_CONTENTS =
  'import { PhantomMenu } from "@zevaui/components";\nexport const Phantom = PhantomMenu;\n';

// RF-AR04/D7: second self-seeded fixture (same node_modules tree, so
// `removePhantomImport` covers its cleanup too). Marks `Dialog` (a real
// must-find, imported by fixtures/consumer/src/app.tsx) deprecated so the
// 6-key expectation's `deprecatedComponents` carries a non-trivial value.
const installedManifestDir = path.join(phantomNodeModules, "@zevaui", "components", "dist");
const installedManifestFile = path.join(installedManifestDir, "components.manifest.json");
const INSTALLED_MANIFEST_CONTENTS = JSON.stringify({
  version: "1.0.0",
  generated: "2026-01-01T00:00:00.000Z",
  components: [
    { name: "Button" },
    { name: "Dialog", deprecated: { since: "1.4.0", replacement: "NewDialog" } },
  ],
});

function plantPhantomImport() {
  mkdirSync(phantomDir, { recursive: true });
  writeFileSync(phantomFile, PHANTOM_CONTENTS);
}

function removePhantomImport() {
  rmSync(phantomNodeModules, { recursive: true, force: true });
}

function plantInstalledManifest() {
  mkdirSync(installedManifestDir, { recursive: true });
  writeFileSync(installedManifestFile, INSTALLED_MANIFEST_CONTENTS);
}

/** @param {string} stepSummaryPath */
function runEntry(stepSummaryPath) {
  return runNode({
    args: [entryScriptPath],
    cwd: packageRoot,
    env: {
      ...process.env,
      GITHUB_WORKSPACE: packageRoot,
      AUDIT_WORKING_DIRECTORY: path.relative(packageRoot, fixtureRoot),
      AUDIT_APP: "zevaui-fixture-consumer",
      GITHUB_STEP_SUMMARY: stepSummaryPath,
    },
  });
}

// Extracted so `main()` can run it twice — once per shape — without
// duplicating the parse/freshness/deep-equal logic. Behaves exactly like the
// single-shape version this replaces: sets `process.exitCode = 1` and
// returns on any failure, leaving `main()` to check it after each call.
/** @param {string} expectedPath */
function runScenario(expectedPath) {
  const tempDir = mkdtempSync(path.join(tmpdir(), "zevaui-audit-gate-"));
  const stepSummaryPath = path.join(tempDir, "step-summary.md");
  writeFileSync(stepSummaryPath, "");

  try {
    const result = runEntry(stepSummaryPath);
    if (isCrash(result)) return reportCrash(LABEL, result);

    if (result.status !== 0) {
      console.error(
        `\n[${LABEL}] FAILED: audit-usage.js exited ${result.status} against the fixture ` +
          "consumer, which is expected to produce a clean report, not fail.",
      );
      process.exitCode = 1;
      return;
    }

    let actual;
    try {
      actual = JSON.parse(result.stdout);
    } catch (error) {
      console.error(
        `\n[${LABEL}] FAILED: audit-usage.js's stdout was not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exitCode = 1;
      return;
    }

    const generatedAtMs = Date.parse(actual.generatedAt);
    const withinBudget =
      !Number.isNaN(generatedAtMs) && Math.abs(Date.now() - generatedAtMs) <= 60_000;
    if (!withinBudget) {
      console.error(
        `\n[${LABEL}] FAILED: generatedAt ("${actual.generatedAt}") does not parse as a real ` +
          "timestamp within 60s of now. A hardcoded value must not pass this check.",
      );
      process.exitCode = 1;
      return;
    }

    const expected = JSON.parse(readFileSync(expectedPath, "utf8"));
    try {
      deepStrictEqual(
        { ...actual, generatedAt: "<frozen>" },
        { ...expected, generatedAt: "<frozen>" },
      );
    } catch (error) {
      console.error(
        `\n[${LABEL}] FAILED: the fixture's report does not match ` +
          `${path.basename(expectedPath)}.\n${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
      return;
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function main() {
  plantPhantomImport();

  try {
    // Scenario 1 (RF-AR05): no installed manifest yet — the exact 5-key
    // shape, byte-identical to today. Must run BEFORE the manifest is
    // planted, or this would silently stop proving the omit-when-absent case.
    runScenario(expectedReportPath);
    if (process.exitCode) return;

    // Scenario 2 (RF-AR04): an installed manifest is now readable — the
    // additive 6th key, `deprecatedComponents`, appears with the sorted
    // intersection of what the fixture consumer imports and what the
    // manifest marks deprecated.
    plantInstalledManifest();
    runScenario(expectedInstalledReportPath);
    if (process.exitCode) return;

    console.log(
      `\n[${LABEL}] PASSED: audit-usage.js reproduced the exact expected report for the ` +
        "fixture consumer in both shapes — every must-find present, every decoy and ceiling " +
        "case absent, and deprecatedComponents additive in the installed-manifest scenario.",
    );
    process.exitCode = 0;
  } finally {
    removePhantomImport();
  }
}

main();
