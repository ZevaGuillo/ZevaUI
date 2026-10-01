// D5: presentational component -- versions per app, RF-AP01 scenario 1. Takes
// already-serialized reports (see reports/serialize.ts); no fetching, no auth,
// no interactive elements at all -- RF-AP01 scenario 2 (no mutation affordance)
// is proven by __tests__/no-mutation-affordance.test.ts.
//
// "use client" IS FORCED, NOT PREFERRED, and the reason is worth knowing before
// the next view copies this file. `Table` is a client component, and its
// `columns` descriptors carry `cell` FUNCTIONS -- which cannot cross the RSC
// boundary, so they cannot be built in `src/app/page.tsx` (an async server
// component) and handed over as props. Putting the boundary HERE keeps what
// crosses it plain serializable data: `reports`, `sort`, and nothing else. The
// same constraint is why `sortHref` is defined below rather than taken as a prop.
"use client";

import type { BadgeTone } from "@zevaui/components";
import { Badge, Table } from "@zevaui/components";
import type { SerializedReport } from "../reports/serialize";

/**
 * How much the reported version can be trusted, as a tone.
 *
 * The ingestion schema closes this domain at two values
 * (packages/audit/src/report-schema.js:64) and they are not equivalent:
 * `installed` was MEASURED from what is actually resolved, while `declared` was
 * read off a semver RANGE in a manifest and may not be what is running.
 *
 * A value outside the domain falls through to no badge at all rather than to a
 * default tone. `dsVersionSource` is typed `string`, so a column default or a
 * migration can still put something else here -- and `neutral` is not "unknown",
 * it is a tone, so using it would quietly assert that the value was fine.
 *
 * A `Map` RATHER THAN AN OBJECT, AND THAT IS THE WHOLE POINT OF THIS LINE. An
 * object literal inherits `Object.prototype`, so an index lookup answers for
 * keys nobody put there: `{}["constructor"]` is `Object`, not `undefined`. With
 * a plain object, a `dsVersionSource` of "constructor", "toString",
 * "hasOwnProperty" or "valueOf" would sail past the `undefined` check below and
 * render a Badge whose `tone` is a function -- which Badge hands to its recipe,
 * finds no matching variant for, and drops, producing a silently untoned badge
 * instead of the documented bare-string fallback. A `Map` resolves only keys
 * that were actually set, so the guarantee above is real rather than intended.
 */
const SOURCE_TONE = new Map<string, BadgeTone>([
  ["installed", "success"],
  ["declared", "warning"],
]);

export type VersionsSortDirection = "ascending" | "descending";

export type VersionsSort = {
  readonly columnId: string;
  readonly direction: VersionsSortDirection;
};

export type VersionsViewProps = {
  readonly reports: readonly SerializedReport[];
  readonly sort?: VersionsSort;
};

/**
 * Where a sortable heading points.
 *
 * DEFINED HERE RATHER THAN PASSED IN, which is the same RSC constraint as the
 * `"use client"` directive above, one level up: `Table` wants a FUNCTION, and
 * `src/app/page.tsx` is a server component, so a `sortHref` prop could never
 * actually be supplied by the thing that renders this view. Owning it on this
 * side of the boundary is the only shape that works.
 *
 * QUERY-ONLY, so it carries no path. `?sort=…` resolves against whatever page is
 * current, which keeps this view from hardcoding the route it happens to live on
 * today -- and is why it needs no knowledge of `/` at all.
 */
const sortHref = (columnId: string, direction: VersionsSortDirection) =>
  `?sort=${columnId}&dir=${direction}`;

/**
 * The columns, as data.
 *
 * NO GROUPING, AND THAT IS A LIBRARY FACT RATHER THAN AN OVERSIGHT. The design
 * asked for the repository as a group header; `Table` builds its engine from
 * `tableFeatures({})` (packages/components/src/table/Table.tsx:73), which enables
 * no grouping, no rowspan and no sub-header rows. The honest render is the
 * repository as the ROW HEADER on every row: it identifies the record, it gives
 * each row its accessible name, and the page clusters the repositories by
 * sorting on this column. Visual grouping needs a `Table` feature that does not
 * exist yet, so it belongs in the ADR, not in a workaround here.
 */
const COLUMNS = [
  {
    id: "repository",
    header: "Repository",
    cell: (report: SerializedReport) => report.repository,
    isRowHeader: true,
    sortable: true,
  },
  {
    id: "app",
    header: "App",
    cell: (report: SerializedReport) => report.app,
    sortable: true,
  },
  {
    id: "dsVersion",
    header: "Design system version",
    cell: (report: SerializedReport) => report.dsVersion,
    sortable: true,
  },
  {
    id: "dsVersionSource",
    header: "Version source",
    cell: (report: SerializedReport) => {
      const tone = SOURCE_TONE.get(report.dsVersionSource);
      // `{value}` either way -- React's own escaping, whether it lands inside a
      // Badge or as a bare string (Threat Matrix: poisoned report XSS).
      return tone === undefined ? (
        report.dsVersionSource
      ) : (
        <Badge tone={tone}>{report.dsVersionSource}</Badge>
      );
    },
  },
  {
    id: "generatedAt",
    header: "Reported at",
    // The DATE only, and no `toLocaleString`. This component server-renders
    // before it hydrates, and a locale- or timezone-dependent format produces
    // one string on the server and a different one in the browser -- a hydration
    // mismatch. Slicing the ISO string is deterministic in both places, and
    // `<time dateTime>` keeps the full instant machine-readable.
    cell: (report: SerializedReport) => (
      <time dateTime={report.generatedAt}>{report.generatedAt.slice(0, 10)}</time>
    ),
    // Not sortable: the column shows a DAY, so clicking it would promise an
    // ordering finer than what is on screen.
  },
];

export function VersionsView({ reports, sort }: VersionsViewProps) {
  return (
    <Table<SerializedReport>
      caption="Design system versions"
      columns={COLUMNS}
      rows={reports}
      // Repository plus app, because neither identifies a row alone: one repo
      // reports many apps, and the same app label appears across repos.
      rowId={(report) => `${report.repository}:${report.app}`}
      sortHref={sortHref}
      sort={sort}
      emptyMessage="No reports yet."
    />
  );
}
