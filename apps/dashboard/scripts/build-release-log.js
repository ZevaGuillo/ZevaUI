// D5: release log build step. Aggregates every packages/*/CHANGELOG.md into
// apps/dashboard/.generated/release-log.json at build time -- never a
// runtime GitHub Releases API call, never a read of any repository release
// tag (RF-AP02 refinement; see __tests__/no-git-tag-read.test.ts).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseChangelog } from "../src/release-log/parse-changelog.js";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = path.dirname(path.dirname(appRoot));

/**
 * Real filesystem listing, injectable so buildReleaseLog is a pure unit
 * under test -- no real fs access required to prove the aggregation logic.
 * @param {string} packagesDir
 * @returns {{ packageName: string, markdown: string }[]}
 */
function defaultListChangelogs(packagesDir) {
  const entries = [];
  for (const dirName of readdirSync(packagesDir)) {
    const changelogPath = path.join(packagesDir, dirName, "CHANGELOG.md");
    const packageJsonPath = path.join(packagesDir, dirName, "package.json");
    try {
      const markdown = readFileSync(changelogPath, "utf8");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      entries.push({ packageName: packageJson.name, markdown });
    } catch {
      // No CHANGELOG.md (or no package.json) for this directory -- not
      // every packages/* entry has published a release yet.
    }
  }
  return entries;
}

/**
 * @param {{
 *   packagesDir?: string,
 *   outFile?: string,
 *   listChangelogs?: (packagesDir: string) => { packageName: string, markdown: string }[],
 * }} [options]
 */
export function buildReleaseLog({
  packagesDir = path.join(workspaceRoot, "packages"),
  outFile = path.join(appRoot, ".generated", "release-log.json"),
  listChangelogs = defaultListChangelogs,
} = {}) {
  const packages = listChangelogs(packagesDir).map(({ packageName, markdown }) =>
    parseChangelog(markdown, packageName),
  );
  const releaseLog = { generated: new Date().toISOString(), packages };
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(releaseLog, null, 2)}\n`);
  return releaseLog;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const releaseLog = buildReleaseLog();
  console.log(`[build:release-log] wrote ${releaseLog.packages.length} package(s)`);
}
