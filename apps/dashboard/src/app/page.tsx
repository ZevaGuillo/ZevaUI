import manifest from "@zevaui/components/components.manifest.json";
import { getDb } from "../db/client";
import { allLatestReportsQuery } from "../db/queries";
import { deprecatedNamesFromManifest } from "../panel/deprecated-logic";
import { buildOverview, componentsReleases } from "../panel/overview-logic";
import { OverviewView } from "../panel/overview-view";
import { loadReleaseLog } from "../release-log/load-release-log";
import { serializeReport } from "../reports/serialize";

// D5 deviation (documented for ADR-0011 reconciliation): the design specified
// `revalidate = 300` (ISR), which forces Next to prerender this page at
// BUILD time -- and prerendering runs getDb(), which throws without
// DATABASE_URL. That collides with D2's chosen infrastructure (Neon free
// tier, which autosuspends): a build that requires a live, awake database is
// fragile exactly where this project chose to be cheap. `force-dynamic`
// renders at request time instead, so the build never touches the database.
//
// `force-dynamic` IS ALSO WHAT MAKES THE AGES HONEST on this particular page.
// Every row carries a relative age ("2h ago"), computed on the server from the
// `now` passed below. Under ISR that string would be frozen into a cached
// payload and served for five minutes after it stopped being true; rendered per
// request, it is correct when it is read. The arithmetic itself is unit-covered
// in __tests__/overview-logic.test.ts and the rendering in
// __tests__/overview-view.test.ts.
export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const rows = await allLatestReportsQuery(getDb());

  return (
    <>
      <header className="stack">
        <h1 className="screen__heading">Overview</h1>
        {/* The lede names what the register IS and what it is not, because the
            denominator is the one thing a reader cannot infer from the numbers:
            every count on this screen is over the apps that report, and nothing
            here knows how many apps exist. */}
        <p className="screen__lede">
          Every app that reports, grouped by repository and ordered alphabetically &mdash; not
          ranked by debt. &ldquo;Behind&rdquo; counts the releases published since the version an
          app reports, read from the committed release log. An app that has never reported is absent
          rather than counted: the register is opt-in, so absence is not a row.
        </p>
      </header>
      <OverviewView
        overview={buildOverview({
          reports: rows.map(serializeReport),
          releases: componentsReleases(loadReleaseLog()),
          deprecatedNames: deprecatedNamesFromManifest(manifest),
          // THE CLOCK IS READ HERE AND NOWHERE DEEPER. overview-logic.ts takes
          // `now` as a parameter so none of its arithmetic is time-dependent
          // under test; this is the one place that has to know what time it is.
          now: new Date(),
        })}
      />
    </>
  );
}
