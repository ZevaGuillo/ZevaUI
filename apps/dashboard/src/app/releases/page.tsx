import { ReleaseLogView } from "../../panel/release-log-view";
import { loadReleaseLog } from "../../release-log/load-release-log";

// D5: public server component, no session, revalidated every 5 minutes.
// Reads the build-time-generated .generated/release-log.json (see
// scripts/build-release-log.ts) through release-log/load-release-log.ts --
// never git tags, never a runtime GitHub Releases API call. The loader is
// shared with the Overview, which compares every app's reported version
// against the same series.
//
// Unlike page.tsx and deprecated/page.tsx, this page does NOT need
// `force-dynamic`: it never calls getDb(), so it has no DATABASE_URL
// dependency and nothing to fail at build time. It stays prerenderable
// (ISR) as originally designed. The loader's read is a filesystem read,
// not a network/DB call, and the file it reads is guaranteed to exist by
// the time `next build` prerenders this page, because the `build` script
// runs `build-release-log.ts` FIRST and `next build` second (see
// package.json).
export const revalidate = 300;

export default function ReleasesPage() {
  return (
    <>
      <header className="stack">
        <h1 className="screen__heading">Release log</h1>
        {/* Names the source, because where a changelog comes from is the whole
            question a reader has about it: these are the committed
            CHANGELOG.md files, never a GitHub Releases call and never a read of
            a repository tag (__tests__/no-git-tag-read.test.ts is the gate). */}
        <p className="screen__lede">
          Every published change, grouped by package and newest first, read from the committed
          CHANGELOG.md files in this repository &mdash; not from release tags and not from an API.
        </p>
      </header>
      <ReleaseLogView packages={loadReleaseLog()} />
    </>
  );
}
