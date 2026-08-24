// D5: release log build step. Aggregates every packages/*/CHANGELOG.md into
// apps/dashboard/.generated/release-log.json at build time -- never a
// runtime GitHub Releases API call, never a read of any repository release
// tag (RF-AP02 refinement; see __tests__/no-git-tag-read.test.ts).
//
// This script is invoked directly via `tsx` (see package.json's `build`
// script), which resolves extensionless local imports the same way
// Next/Vite do -- the same convention as the rest of the app.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainModule } from "../src/lib/is-main-module";
import { type ParsedChangelog, parseChangelog } from "../src/release-log/parse-changelog";

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = path.dirname(path.dirname(appRoot));

type ChangelogSource = { readonly packageName: string; readonly markdown: string };

/**
 * Real filesystem listing, injectable so buildReleaseLog is a pure unit
 * under test -- no real fs access required to prove the aggregation logic.
 */
function defaultListChangelogs(packagesDir: string): ChangelogSource[] {
  const entries: ChangelogSource[] = [];
  for (const dirName of readdirSync(packagesDir)) {
    const changelogPath = path.join(packagesDir, dirName, "CHANGELOG.md");
    const packageJsonPath = path.join(packagesDir, dirName, "package.json");
    try {
      const markdown = readFileSync(changelogPath, "utf8");
      const packageJson: { name: string } = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      entries.push({ packageName: packageJson.name, markdown });
    } catch {
      // No CHANGELOG.md (or no package.json) for this directory -- not
      // every packages/* entry has published a release yet.
    }
  }
  return entries;
}

export type ReleaseLog = { readonly generated: string; readonly packages: ParsedChangelog[] };

export type BuildReleaseLogOptions = {
  readonly packagesDir?: string;
  readonly outFile?: string;
  readonly listChangelogs?: (packagesDir: string) => ChangelogSource[];
};

export function buildReleaseLog({
  packagesDir = path.join(workspaceRoot, "packages"),
  outFile = path.join(appRoot, ".generated", "release-log.json"),
  listChangelogs = defaultListChangelogs,
}: BuildReleaseLogOptions = {}): ReleaseLog {
  const packages = listChangelogs(packagesDir).map(({ packageName, markdown }) =>
    parseChangelog(markdown, packageName),
  );
  const releaseLog: ReleaseLog = { generated: new Date().toISOString(), packages };
  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, `${JSON.stringify(releaseLog, null, 2)}\n`);
  return releaseLog;
}

if (isMainModule(import.meta.url, process.argv[1])) {
  const releaseLog = buildReleaseLog();
  console.log(`[build:release-log] wrote ${releaseLog.packages.length} package(s)`);
}
