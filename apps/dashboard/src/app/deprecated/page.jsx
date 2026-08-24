import manifest from "@zevaui/components/components.manifest.json";
import { getDb } from "../../db/client.js";
import { allLatestReportsQuery } from "../../db/queries.js";
import {
  computeDeprecatedInUse,
  deprecatedNamesFromManifest,
} from "../../panel/deprecated-logic.js";
import { DeprecatedView } from "../../panel/deprecated-view.jsx";
import { serializeReport } from "../../reports/serialize.js";

// D5: public server component, no session, revalidated every 5 minutes. Thin
// wiring; DeprecatedView's own rendering (and the null-vs-[] distinction) is
// unit-covered in __tests__/deprecated-view.test.ts, and the intersection
// logic in __tests__/deprecated-logic.test.ts.
export const revalidate = 300;

export default async function DeprecatedPage() {
  const rows = await allLatestReportsQuery(getDb());
  const deprecatedNames = deprecatedNamesFromManifest(manifest);
  const entries = rows.map(serializeReport).map((report) => ({
    repository: report.repository,
    app: report.app,
    deprecatedInUse: computeDeprecatedInUse(report.components, deprecatedNames),
    reportedDeprecated: report.deprecatedComponents,
  }));
  return <DeprecatedView entries={entries} />;
}
