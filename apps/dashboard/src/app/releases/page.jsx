import { readFileSync } from "node:fs";
import path from "node:path";
import { ReleaseLogView } from "../../panel/release-log-view.jsx";

// D5: public server component, no session, revalidated every 5 minutes.
// Reads the build-time-generated .generated/release-log.json (see
// scripts/build-release-log.js) directly -- never git tags, never a
// runtime GitHub Releases API call. Falls back to an empty list rather
// than erroring when the file has not been generated yet (e.g. locally,
// before `pnpm build` has run once).
export const revalidate = 300;

function loadReleaseLog() {
  try {
    const raw = readFileSync(path.join(process.cwd(), ".generated", "release-log.json"), "utf8");
    return JSON.parse(raw).packages ?? [];
  } catch {
    return [];
  }
}

export default function ReleasesPage() {
  return <ReleaseLogView packages={loadReleaseLog()} />;
}
