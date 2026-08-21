// Runnable entry (design #156, D3/D10). Walks a consumer's source tree,
// scans it, resolves dsVersion via build-report.js's D8 cascade, and prints
// the report as the ONLY line on stdout — the gate (assert-usage-report.js)
// parses stdout as JSON, so diagnostics go to stderr and the step summary.
//
// Inputs arrive as env vars (AUDIT_APP, AUDIT_WORKING_DIRECTORY), not argv:
// the reusable workflow (PR2) invokes this with a plain `node <path>` step,
// passing workflow_call inputs through as step-level `env:`.
import { appendFileSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { buildReport, resolveDsVersion } from "./build-report.js";
import { scanSource } from "./scan-source.js";

const PRUNED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "build",
  "out",
  "coverage",
  ".turbo",
  "storybook-static",
]);
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);
const MAX_FILE_BYTES = 1 * 1024 * 1024;
const MAX_SCANNED_FILES = 20000;

function fail(message) {
  console.error(`[audit-usage] FAIL: ${message}`);
  process.exit(1);
}

// Pruned-dir walk, symlink-averse, extension-allowlisted, size/count-capped
// (D10): a silent skip is a lie, so skips are counted and named; a repo too
// large to finish exits 1 rather than reporting a partial truth as a whole.
function walkAndScan(consumerRoot) {
  const imports = [];
  const skipped = [];
  let scannedCount = 0;
  const stack = [consumerRoot];

  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!PRUNED_DIRS.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name))) continue;

      scannedCount += 1;
      if (scannedCount > MAX_SCANNED_FILES) {
        fail(
          `scanned more than ${MAX_SCANNED_FILES} files without finishing — refusing to report ` +
            "a partial truth as a whole one",
        );
      }

      const relativePath = path.relative(consumerRoot, fullPath);
      try {
        if (statSync(fullPath).size > MAX_FILE_BYTES) {
          skipped.push(relativePath);
          continue;
        }
        const contents = readFileSync(fullPath, "utf8");
        imports.push(...scanSource(contents));
      } catch {
        skipped.push(relativePath);
      }
    }
  }

  return { imports, skipped };
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

function main() {
  const workspaceRoot = path.resolve(process.env.GITHUB_WORKSPACE ?? process.cwd());
  const workingDirectoryInput = process.env.AUDIT_WORKING_DIRECTORY ?? ".";
  const appInput = process.env.AUDIT_APP ?? process.env.GITHUB_REPOSITORY;

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
  if (workingDirectoryInput !== "." && !appInput) {
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

  const { imports, skipped } = walkAndScan(consumerRoot);

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
