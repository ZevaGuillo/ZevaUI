// Proves the fixture's report deep-equals the committed expected report
// (RF-UAW12). Plants a decoy DS import inside `node_modules` first — a
// directory the real entry MUST prune — at run time (`.gitignore:2` blocks
// committing it), removed in a `finally`, matching the visual gates'
// self-seeding pattern. Exit-code reading and the crash branch live in
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

const phantomNodeModules = path.join(fixtureRoot, "node_modules");
const phantomDir = path.join(phantomNodeModules, "@zevaui", "components", "src");
const phantomFile = path.join(phantomDir, "phantom.tsx");
// Absent from every must-find — a leaked collision would be silently
// swallowed by components[]'s dedup (measured, see git history: 5.3).
const PHANTOM_CONTENTS =
  'import { PhantomMenu } from "@zevaui/components";\nexport const Phantom = PhantomMenu;\n';

function plantPhantomImport() {
  mkdirSync(phantomDir, { recursive: true });
  writeFileSync(phantomFile, PHANTOM_CONTENTS);
}

function removePhantomImport() {
  rmSync(phantomNodeModules, { recursive: true, force: true });
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

function main() {
  plantPhantomImport();
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

    const expected = JSON.parse(readFileSync(expectedReportPath, "utf8"));
    try {
      deepStrictEqual(
        { ...actual, generatedAt: "<frozen>" },
        { ...expected, generatedAt: "<frozen>" },
      );
    } catch (error) {
      console.error(
        `\n[${LABEL}] FAILED: the fixture's report does not match ` +
          `__fixtures__/expected-report.json.\n${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      `\n[${LABEL}] PASSED: audit-usage.js reproduced the exact expected report for the ` +
        "fixture consumer — every must-find present, every decoy and ceiling case absent.",
    );
    process.exitCode = 0;
  } finally {
    removePhantomImport();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
