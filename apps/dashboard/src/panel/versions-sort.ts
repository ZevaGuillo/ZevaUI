// The ordering half of /versions, kept pure and out of both the page and the
// view -- the same split `deprecated-logic.ts` already uses.
//
// IT LIVES ON THE SERVER SIDE OF THE RSC BOUNDARY, ON PURPOSE. `Table` sorts
// nothing by itself (its engine is built from `tableFeatures({})`); it renders
// headings as links and the rows in the order it is handed. So the ordering is
// the page's job, which means it happens before any data crosses into the client
// bundle -- no sort state, no re-render, no client-side comparator shipped.
import type { SerializedReport } from "../reports/serialize";
import type { VersionsSort, VersionsSortDirection } from "./versions-view";

/**
 * The columns a visitor may sort by.
 *
 * MUST MATCH the columns `versions-view.tsx` marks `sortable: true`, and
 * __tests__/versions-sort.test.ts pins the list for exactly that reason: a
 * heading that links to a sort this module drops is a control that looks live
 * and does nothing. `generatedAt` is absent because that column renders a DAY,
 * so ordering by the underlying instant would promise a precision the screen
 * does not show.
 */
export const VERSIONS_SORTABLE_COLUMNS = ["repository", "app", "dsVersion"] as const;

export type VersionsSortableColumn = (typeof VERSIONS_SORTABLE_COLUMNS)[number];

const SORTABLE = new Set<string>(VERSIONS_SORTABLE_COLUMNS);
const DIRECTIONS = new Set<string>(["ascending", "descending"]);

/**
 * Next hands a search param over as a string, an array (the param repeated), or
 * `undefined`. Only the single-string case can be read: `?sort=app&sort=repo`
 * expresses two sorts, and picking one of them would answer a question the
 * visitor did not ask.
 */
type SearchParamValue = string | readonly string[] | undefined;

/**
 * Numeric-aware, so "1.10.0" sorts AFTER "1.9.2" instead of before it.
 *
 * The locale is pinned to "en" rather than left to the runtime's default: an
 * ordering that depends on the server's locale is an ordering that changes when
 * the deploy region does.
 */
const COLLATOR = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/**
 * The sort a URL asks for, or `undefined` for the default view.
 *
 * Every unrecognised shape collapses to `undefined`: a column that is not
 * sortable, a column that does not exist, a direction that is not a direction, a
 * repeated param. This is URL input, so the rule is that nothing in it can
 * produce an error or a guess -- only a sort or no sort.
 */
export function parseVersionsSort(
  params: Readonly<Record<string, SearchParamValue>>,
): VersionsSort | undefined {
  const columnId = params.sort;
  if (typeof columnId !== "string" || !SORTABLE.has(columnId)) return undefined;

  const direction = params.dir;
  // Absent means "sorted by this column" with no opinion on which way, and
  // ascending is the reading of that which is useful on the first click. A
  // direction that IS present but unrecognised is a different case: the URL is
  // malformed, so it gets no sort at all rather than a silent correction.
  if (direction === undefined) return { columnId, direction: "ascending" };
  if (typeof direction !== "string" || !DIRECTIONS.has(direction)) return undefined;

  return { columnId, direction: direction as VersionsSortDirection };
}

const sortKeyOf = (report: SerializedReport, columnId: string): string =>
  columnId === "repository"
    ? report.repository
    : columnId === "dsVersion"
      ? report.dsVersion
      : report.app;

/**
 * The reports in the asked-for order. A new array -- the caller's is `readonly`
 * and `Array.prototype.sort` is in-place, so copying is the boundary between the
 * two rather than a defensive clone.
 */
export function sortReports(
  reports: readonly SerializedReport[],
  sort: VersionsSort | undefined,
): readonly SerializedReport[] {
  if (sort === undefined) return reports;

  const sign = sort.direction === "descending" ? -1 : 1;

  return [...reports].sort((left, right) => {
    const primary = COLLATOR.compare(
      sortKeyOf(left, sort.columnId),
      sortKeyOf(right, sort.columnId),
    );
    if (primary !== 0) return primary * sign;

    // TIE-BREAK ON THE APP, AND IT CARRIES THE WEIGHT THE GROUP HEADER WOULD.
    // Sorting by repository is what clusters a repository's rows together --
    // `Table` has no grouping, so the ordering is the only thing doing that job.
    // Without a second key the rows inside one repository come back in whatever
    // order the database chose, which changes between requests for no reason the
    // visitor can see. The tie-break is NOT reversed by `sign`: descending is a
    // statement about the column that was clicked, and flipping the apps
    // underneath it makes the secondary order look like noise.
    return COLLATOR.compare(left.app, right.app);
  });
}
