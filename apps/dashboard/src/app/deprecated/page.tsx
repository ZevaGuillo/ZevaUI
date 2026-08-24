import manifest from "@zevaui/components/components.manifest.json";
import { getDb } from "../../db/client.js";
import { allLatestReportsQuery } from "../../db/queries.js";
import {
  computeDeprecatedInUse,
  deprecatedNamesFromManifest,
} from "../../panel/deprecated-logic.js";
import { type DeprecatedEntry, DeprecatedView } from "../../panel/deprecated-view.jsx";
import { serializeReport } from "../../reports/serialize.js";

// D5 deviation (documented for ADR-0011 reconciliation): the design specified
// `revalidate = 300` (ISR), which forces Next to prerender this page at
// BUILD time -- and prerendering runs getDb(), which throws without
// DATABASE_URL. That collides with D2's chosen infrastructure (Neon free
// tier, which autosuspends): a build that requires a live, awake database is
// fragile exactly where this project chose to be cheap. `force-dynamic`
// renders at request time instead, so the build never touches the database.
// Public, no session; DeprecatedView's own rendering (and the null-vs-[]
// distinction) is unit-covered in __tests__/deprecated-view.test.ts, and the
// intersection logic in __tests__/deprecated-logic.test.ts.
export const dynamic = "force-dynamic";

export default async function DeprecatedPage() {
  const rows = await allLatestReportsQuery(getDb());
  const deprecatedNames = deprecatedNamesFromManifest(manifest);
  const entries: DeprecatedEntry[] = rows.map(serializeReport).map((report) => ({
    repository: report.repository,
    app: report.app,
    deprecatedInUse: computeDeprecatedInUse(report.components, deprecatedNames),
    reportedDeprecated: report.deprecatedComponents,
  }));
  return <DeprecatedView entries={entries} />;
}
