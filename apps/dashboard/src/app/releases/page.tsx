import { readFileSync } from "node:fs";
import path from "node:path";
import { ReleaseLogView } from "../../panel/release-log-view";
import type { ParsedChangelog } from "../../release-log/parse-changelog";

// D5: public server component, no session, revalidated every 5 minutes.
// Reads the build-time-generated .generated/release-log.json (see
// scripts/build-release-log.ts) directly -- never git tags, never a
// runtime GitHub Releases API call. Falls back to an empty list rather
// than erroring when the file has not been generated yet (e.g. locally,
// before `pnpm build` has run once).
//
// Unlike page.tsx and deprecated/page.tsx, this page does NOT need
// `force-dynamic`: it never calls getDb(), so it has no DATABASE_URL
// dependency and nothing to fail at build time. It stays prerenderable
// (ISR) as originally designed. The `readFileSync` call below is a
// filesystem read, not a network/DB call, and the file it reads is
// guaranteed to exist by the time `next build` prerenders this page,
// because the `build` script now runs `build-release-log.ts` FIRST and
// `next build` second (see package.json).
export const revalidate = 300;

function loadReleaseLog(): ParsedChangelog[] {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".generated", "release-log.json"), "utf8");
    const parsed: { packages?: ParsedChangelog[] } = JSON.parse(raw);
    return parsed.packages ?? [];
  } catch {
    return [];
  }
}

export default function ReleasesPage() {
  return <ReleaseLogView packages={loadReleaseLog()} />;
}
