// RF-AR08: no file under packages/* may name a concrete app/tenant. All
// app-identity-aware code (report `app` handling, registry client, panel UI)
// belongs under apps/ instead — this gate proves that boundary rather than
// documenting it as a convention nobody checks.
//
// The denylist itself is read from apps/dashboard, never hardcoded here, so
// onboarding a real consumer touches exactly one committed file and this
// script's own source never has to change.
//
// Root-level, not a workspace package: this is a repo-wide invariant over
// packages/*, not a build artifact of any one package, so it runs as a plain
// `node` step in CI (see .github/workflows/ci.yml) rather than through turbo.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LABEL = "no-tenant-names-gate";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const denylistPath = path.join(repoRoot, "apps", "dashboard", "registry-tenant-denylist.json");
const packagesRoot = path.join(repoRoot, "packages");

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
const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".mdx",
  ".yml",
  ".yaml",
]);

/** @returns {string[]} */
function readDenylist() {
  const config = JSON.parse(readFileSync(denylistPath, "utf8"));
  if (!Array.isArray(config.names) || config.names.length === 0) {
    throw new Error(`${denylistPath} must declare a non-empty "names" array`);
  }
  return config.names;
}

/**
 * @param {string} dir
 * @param {string[]} out
 * @returns {string[]}
 */
function walkFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!PRUNED_DIRS.has(entry.name)) walkFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && SCANNED_EXTENSIONS.has(path.extname(entry.name))) out.push(fullPath);
  }
  return out;
}

/**
 * @param {string[]} names
 * @returns {Array<{ file: string, name: string }>}
 */
function findViolations(names) {
  const violations = [];
  for (const filePath of walkFiles(packagesRoot)) {
    const source = readFileSync(filePath, "utf8");
    for (const name of names) {
      if (source.includes(name)) violations.push({ file: path.relative(repoRoot, filePath), name });
    }
  }
  return violations;
}

function main() {
  const names = readDenylist();
  const violations = findViolations(names);

  if (violations.length > 0) {
    console.error(
      `\n[${LABEL}] FAILED: found ${violations.length} tenant-name leak(s) under packages/*:`,
    );
    for (const { file, name } of violations) console.error(`  ${file}: contains "${name}"`);
    console.error(
      "\nRF-AR08: app/tenant identity must live under apps/, never under packages/*. Move " +
        "the offending code, or if this match is a false positive, narrow the denylist entry " +
        `in ${path.relative(repoRoot, denylistPath)}.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n[${LABEL}] PASSED: none of the ${names.length} denylisted tenant identifier(s) appear ` +
      "anywhere under packages/*.",
  );
  process.exitCode = 0;
}

main();
