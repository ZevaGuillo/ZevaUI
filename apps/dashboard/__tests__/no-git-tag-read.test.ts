import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const sources = [
  path.join(dirname, "..", "scripts", "build-release-log.ts"),
  path.join(dirname, "..", "src", "release-log", "parse-changelog.ts"),
].map((file) => readFileSync(file, "utf8").toLowerCase());

// RF-AP02 refinement: the release log is derived from committed CHANGELOG.md
// files. It MUST NOT require a separate write path, and it MUST NOT read git
// tags or call a runtime GitHub Releases API -- an explicit gate, not an
// assumption.
describe("release log never reads git tags or a Releases API (RF-AP02 refinement)", () => {
  it.each([
    "git tag",
    "git describe",
    "child_process",
    "execsync",
    "execfile",
    "simple-git",
    "octokit",
    "/releases/",
    "github.com/repos",
  ])("contains no reference to %s", (forbidden) => {
    for (const source of sources) {
      expect(source).not.toContain(forbidden);
    }
  });
});
