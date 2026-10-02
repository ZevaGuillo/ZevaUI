import { getDb } from "../../db/client";
import { allLatestReportsQuery } from "../../db/queries";
import { parseVersionsSort, sortReports } from "../../panel/versions-sort";
import { VersionsView } from "../../panel/versions-view";
import { serializeReport } from "../../reports/serialize";

// D5 deviation (documented for ADR-0011 reconciliation): the design specified
// `revalidate = 300` (ISR), which forces Next to prerender this page at
// BUILD time -- and prerendering runs getDb(), which throws without
// DATABASE_URL. That collides with D2's chosen infrastructure (Neon free
// tier, which autosuspends): a build that requires a live, awake database is
// fragile exactly where this project chose to be cheap. `force-dynamic`
// renders at request time instead, so the build never touches the database.
// Public, no session; VersionsView's own rendering is unit-covered in
// __tests__/versions-view.test.ts.
//
// Reading `searchParams` would force dynamic rendering on its own, so the sort
// below costs nothing this page was not already paying.
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function VersionsPage({
  searchParams,
}: {
  readonly searchParams: Promise<SearchParams>;
}) {
  // THE ORDERING HAPPENS HERE, NOT IN THE VIEW, and that is `Table`'s contract
  // rather than a preference: it sorts nothing itself, it renders headings as
  // links and rows in the order it is given. Sorting on this side of the RSC
  // boundary means no comparator and no sort state ship to the browser -- the
  // visitor gets a new URL and a new server render, which is also the only shape
  // RF-AP01 scenario 2 allows (every affordance is an anchor).
  const [rows, params] = await Promise.all([allLatestReportsQuery(getDb()), searchParams]);
  const sort = parseVersionsSort(params);

  return (
    <>
      <header className="stack">
        <h1 className="screen__heading">Versions</h1>
        <p className="screen__lede">
          The design system version each app reports, newest report per app. Sort by any heading to
          group the rows -- the ordering lives in the URL, so a sorted view is a link you can share.
        </p>
      </header>
      <VersionsView reports={sortReports(rows.map(serializeReport), sort)} sort={sort} />
    </>
  );
}
