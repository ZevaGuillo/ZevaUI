import { getDb } from "../db/client.js";
import { allLatestReportsQuery } from "../db/queries.js";
import { VersionsView } from "../panel/versions-view.jsx";
import { serializeReport } from "../reports/serialize.js";

// D5: public server component, no session, revalidated every 5 minutes.
// Thin wiring; VersionsView's own rendering is unit-covered in
// __tests__/versions-view.test.ts.
export const revalidate = 300;

export default async function VersionsPage() {
  const rows = await allLatestReportsQuery(getDb());
  return <VersionsView reports={rows.map(serializeReport)} />;
}
