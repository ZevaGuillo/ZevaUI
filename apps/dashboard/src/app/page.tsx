import { getDb } from "../db/client";
import { allLatestReportsQuery } from "../db/queries";
import { VersionsView } from "../panel/versions-view";
import { serializeReport } from "../reports/serialize";

// D5 deviation (documented for ADR-0011 reconciliation): the design specified
// `revalidate = 300` (ISR), which forces Next to prerender this page at
// BUILD time -- and prerendering runs getDb(), which throws without
// DATABASE_URL. That collides with D2's chosen infrastructure (Neon free
// tier, which autosuspends): a build that requires a live, awake database is
// fragile exactly where this project chose to be cheap. `force-dynamic`
// renders at request time instead, so the build never touches the database.
// Public, no session; VersionsView's own rendering is unit-covered in
// __tests__/versions-view.test.ts.
export const dynamic = "force-dynamic";

export default async function VersionsPage() {
  const rows = await allLatestReportsQuery(getDb());
  return <VersionsView reports={rows.map(serializeReport)} />;
}
