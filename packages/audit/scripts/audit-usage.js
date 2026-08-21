// Runnable entry (design #156, D3/D10). Walks a consumer's source tree,
// scans it, resolves dsVersion via build-report.js's D8 cascade, and prints
// the report as the ONLY line on stdout — the gate (assert-usage-report.js)
// parses stdout as JSON, so diagnostics go to stderr and the step summary.
//
// Inputs arrive as env vars (AUDIT_APP, AUDIT_WORKING_DIRECTORY), not argv:
// the reusable workflow (PR2) invokes this with a plain `node <path>` step,
// passing workflow_call inputs through as step-level `env:`.
import { appendFileSync } from "node:fs";
import path from "node:path";
import { buildReport, resolveDsVersion } from "./build-report.js";
import { MAX_SCANNED_FILES, walkAndScan } from "./walk-source-tree.js";

/**
 * Terminal: this never returns.
 *
 * The annotation is load-bearing. Without it nothing in the signature says so,
 * and every guard below reads as if execution might continue past it — which
 * is how `versionResult` came to be dereferenced on a path an analyzer can
 * prove is nullable. If anyone ever makes this function return, that invariant
 * breaks silently at every call site; declaring it here is what turns that into
 * a checkable claim instead of a habit.
 *
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`[audit-usage] FAIL: ${message}`);
  process.exit(1);
}

// The table is the one place consumer-controlled text reaches rendered
// output: `dsVersion` is copied from THEIR package.json and `app` from a
// workflow input, so both are free text this repo never validates. An
// unescaped `|` closes the cell early and a newline forges an entire extra
// row — measured, see the "escapes pipes and newlines" test. Component
// names need no escaping (scan-source.js already constrains them to
// /^[A-Za-z_$][\w$]*$/), but escaping them costs nothing and means nobody
// has to re-derive which cells are safe.
function cell(value) {
  // All three line-terminator forms, not just LF and CRLF: a lone CR still
  // breaks the line wherever it is honoured, and `\r?\n` walks straight past it.
  return String(value)
    .replace(/\r\n?|\n/g, " ")
    .replace(/\|/g, "\\|");
}

function renderStepSummary(report, skipped) {
  const componentsCell = report.components.length === 0 ? "_none_" : report.components.join(", ");
  return (
    "\n### DS usage audit\n\n" +
    "| Field | Value |\n|---|---|\n" +
    `| app | ${cell(report.app)} |\n` +
    `| dsVersion | ${cell(report.dsVersion)} (${cell(report.dsVersionSource)}) |\n` +
    `| components | ${cell(componentsCell)} |\n` +
    `| generatedAt | ${cell(report.generatedAt)} |\n` +
    `| skipped files | ${skipped.length} |\n`
  );
}

// GitHub Actions passes an omitted `workflow_call` input through as an EMPTY
// STRING, never as an unset variable, so `??` never fires on one.
function provided(value) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function main() {
  const workspaceRoot = path.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
  const workingDirectoryInput = provided(process.env.AUDIT_WORKING_DIRECTORY) ?? ".";
  // Two different questions, deliberately kept apart. `explicitApp` answers
  // "did the caller name this app?", which is what D3 below asks. `appInput`
  // answers "what do we label the report with?".
  //
  // Collapsing them is not a style choice, it is the bug that shipped: with
  // one value, GITHUB_REPOSITORY — which Actions ALWAYS sets — satisfied D3's
  // check, so the guard never fired in the only environment it exists for, and
  // a subdirectory's report was labelled with the whole repository's name.
  // Measured, and it is exactly the outcome D3 exists to refuse.
  const explicitApp = provided(process.env.AUDIT_APP);
  const appInput = explicitApp ?? provided(process.env.GITHUB_REPOSITORY);

  const consumerRoot = path.resolve(workspaceRoot, workingDirectoryInput);
  const relativeToWorkspace = path.relative(workspaceRoot, consumerRoot);
  if (relativeToWorkspace.startsWith("..") || path.isAbsolute(relativeToWorkspace)) {
    fail(
      `working-directory "${workingDirectoryInput}" resolves outside GITHUB_WORKSPACE ` +
        `(${workspaceRoot}) — refusing to scan outside the checked-out workspace`,
    );
  }

  // D3: the default identity (github.repository) is only safe for the
  // single-app case; refuse the one configuration where it is LIKELY wrong.
  if (workingDirectoryInput !== "." && !explicitApp) {
    fail(
      'working-directory is set to something other than "." but no app was provided — the ' +
        "default (github.repository) would silently mislabel this report",
    );
  }
  if (!appInput) {
    fail("no app identity resolved — set the app input or GITHUB_REPOSITORY");
  }

  // resolveDsVersion throws only when the consumer's package.json exists but
  // cannot be parsed. That is a real, nameable failure and belongs on the
  // deliberate fail() path — uncaught, it would exit with a raw stack trace
  // that says nothing about which file is malformed.
  let versionResult;
  try {
    versionResult = resolveDsVersion({ consumerRoot });
  } catch (error) {
    fail(error.message);
  }
  if (!versionResult) {
    fail(
      "@zevaui/components is not installed under node_modules and not declared in " +
        "package.json (dependencies/devDependencies/peerDependencies) — a report with no " +
        "dsVersion would be a false audit signal, not a degraded one",
    );
  }

  // D10: a repo too large to finish exits 1 rather than reporting a partial
  // truth as a whole one. The walk signals it; the message belongs here.
  const { imports, skipped, overflowed } = walkAndScan(consumerRoot);
  if (overflowed) {
    fail(
      `scanned more than ${MAX_SCANNED_FILES} files without finishing — refusing to report ` +
        "a partial truth as a whole one",
    );
  }

  const report = buildReport({
    app: appInput,
    importsBySpecifier: imports,
    dsVersion: versionResult.version,
    dsVersionSource: versionResult.source,
    generatedAt: new Date().toISOString(),
  });

  console.log(JSON.stringify(report, null, 2));

  if (skipped.length > 0) {
    console.error(
      `[audit-usage] skipped ${skipped.length} file(s) (unreadable or over the 1MB cap): ` +
        skipped.join(", "),
    );
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, renderStepSummary(report, skipped), {
      flag: "a",
    });
  }
}

main();
