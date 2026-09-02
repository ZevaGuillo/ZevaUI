// Repo-root hygiene gate: `.gitignore` only prevents NEW files from being
// tracked — it never untracks what was committed before the rule existed.
// That gap is real: local-machine visual debris under
// `apps/storybook/.vitest-attachments/` (declared ignored, ADR-0008) sat
// tracked in git for weeks. `git ls-files --cached -i --exclude-standard`
// lists every tracked path that an ignore rule claims to exclude, so the
// whole class of "ignored on paper, committed in practice" fails here, not
// just that one directory. Lives in packages/config next to the other
// repo-root gates because it has no workspace of its own.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..");

describe("tracked-but-ignored files", () => {
  it("tracks no file that .gitignore declares ignored", () => {
    const trackedIgnored = execFileSync(
      "git",
      ["ls-files", "--cached", "-i", "--exclude-standard"],
      { cwd: repoRoot, encoding: "utf8" },
    )
      .split("\n")
      .filter((line) => line.length > 0);

    expect(trackedIgnored).toEqual([]);
  });
});
