import manifest from "@zevaui/components/components.manifest.json";
import { getDb } from "../../db/client";
import { allLatestReportsQuery } from "../../db/queries";
import { computeDeprecatedInUse, deprecatedNamesFromManifest } from "../../panel/deprecated-logic";
import { type DeprecatedEntry, DeprecatedView } from "../../panel/deprecated-view";
import { serializeReport } from "../../reports/serialize";

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
  return (
    <>
      <header className="stack">
        <h1 className="screen__heading">Deprecation debt</h1>
        {/* The lede states BOTH sources and that they can disagree, because the
            screen's whole content is a cross-check between them and a reader who
            does not know there are two sources cannot read it. "Opt-in" is the
            load-bearing word: a missing self-report is an absence, not a zero. */}
        <p className="screen__lede">
          Two sources per app, side by side. The left column is computed from the installed
          component manifest and is always known; the right is what the app reported about itself,
          which is opt-in and may be absent entirely. Where the two disagree, this screen says so
          and names both.
        </p>
      </header>
      <DeprecatedView entries={entries} />
    </>
  );
}
