// D5: the one reader of the build-time-generated release log, extracted once
// `/releases` stopped being its only consumer -- the Overview compares every
// app's reported version against the same series, and two pages reading the
// same file with two copies of the fallback is one copy too many.
//
// Reads `.generated/release-log.json` (written by scripts/build-release-log.ts)
// and NEVER git tags, NEVER a runtime GitHub Releases API call --
// __tests__/no-git-tag-read.test.ts is the gate on that, not this comment.
import { readFileSync } from "node:fs";
import path from "node:path";
import type { ParsedChangelog } from "./parse-changelog";

/**
 * Falls back to an empty list rather than throwing.
 *
 * THE FALLBACK IS A LOCAL-DEVELOPMENT AFFORDANCE, NOT A PRODUCTION GUESS: the
 * file is absent before `pnpm build` has run once, and a landing page that
 * crashes on a fresh clone is hostile. In production the `build` script runs
 * `build-release-log.ts` FIRST and `next build` second, so the file exists by
 * the time anything renders.
 *
 * An empty list is also the honest degraded state downstream. `appHealth` makes
 * every app `unknown` against an empty series -- "there is nothing to compare
 * against" -- rather than claiming everyone is current, which is what a fallback
 * to a hardcoded version would do.
 */
export function loadReleaseLog(): ParsedChangelog[] {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".generated", "release-log.json"), "utf8");
    const parsed: { packages?: ParsedChangelog[] } = JSON.parse(raw);
    return parsed.packages ?? [];
  } catch {
    return [];
  }
}
