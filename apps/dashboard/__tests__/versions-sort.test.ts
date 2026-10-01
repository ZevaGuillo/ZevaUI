import { describe, expect, it } from "vitest";
import {
  parseVersionsSort,
  sortReports,
  VERSIONS_SORTABLE_COLUMNS,
} from "../src/panel/versions-sort";
import type { SerializedReport } from "../src/reports/serialize";

const report = (overrides: Partial<SerializedReport>): SerializedReport => ({
  repository: "acme/web",
  app: "web",
  dsVersion: "1.4.0",
  dsVersionSource: "installed",
  components: [],
  deprecatedComponents: null,
  generatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// `?sort=` and `?dir=` arrive from the URL, so they are untrusted input in the
// ordinary sense: anything can be in there, and the answer to anything
// unrecognised is the default view -- never a crash and never a guess.
describe("parseVersionsSort (the query string is untrusted input)", () => {
  it("reads a sortable column and an explicit direction", () => {
    expect(parseVersionsSort({ sort: "dsVersion", dir: "descending" })).toEqual({
      columnId: "dsVersion",
      direction: "descending",
    });
  });

  // A column with no direction means "sort by this", and ascending is the only
  // reading of that which does not require a second click to be useful.
  it("defaults the direction to ascending", () => {
    expect(parseVersionsSort({ sort: "app" })).toEqual({
      columnId: "app",
      direction: "ascending",
    });
  });

  it.each([
    ["nothing at all", {}],
    ["a column that is not sortable", { sort: "generatedAt" }],
    ["a column that does not exist", { sort: "../../etc/passwd" }],
    ["an unknown direction", { sort: "app", dir: "sideways" }],
    ["repeated params (Next hands these over as arrays)", { sort: ["app", "repository"] }],
  ])("returns undefined for %s", (_label, params) => {
    expect(parseVersionsSort(params)).toBeUndefined();
  });

  // The view marks exactly these columns sortable. If the two lists drift, the
  // panel grows a heading that links to a sort this module silently ignores.
  it("exposes the sortable set the view and the page agree on", () => {
    expect([...VERSIONS_SORTABLE_COLUMNS]).toEqual(["repository", "app", "dsVersion"]);
  });
});

describe("sortReports", () => {
  it("leaves the rows alone with no sort", () => {
    const rows = [report({ app: "b" }), report({ app: "a" })];
    expect(sortReports(rows, undefined).map((row) => row.app)).toEqual(["b", "a"]);
  });

  it("does not mutate the input", () => {
    const rows = [report({ app: "b" }), report({ app: "a" })];
    sortReports(rows, { columnId: "app", direction: "ascending" });
    expect(rows.map((row) => row.app)).toEqual(["b", "a"]);
  });

  it("sorts ascending and descending", () => {
    const rows = [report({ app: "b" }), report({ app: "a" }), report({ app: "c" })];
    expect(
      sortReports(rows, { columnId: "app", direction: "ascending" }).map((row) => row.app),
    ).toEqual(["a", "b", "c"]);
    expect(
      sortReports(rows, { columnId: "app", direction: "descending" }).map((row) => row.app),
    ).toEqual(["c", "b", "a"]);
  });

  // THE ONE THAT A PLAIN STRING COMPARE GETS WRONG. Lexicographically "1.10.0"
  // sorts before "1.4.0", because "1" < "4" one character in -- so the newest
  // version lands in the middle of the list and nobody notices until a minor
  // hits double digits.
  it("orders version numbers numerically, not lexicographically", () => {
    const rows = [
      report({ dsVersion: "1.4.0" }),
      report({ dsVersion: "1.10.0" }),
      report({ dsVersion: "1.9.2" }),
    ];
    expect(
      sortReports(rows, { columnId: "dsVersion", direction: "ascending" }).map(
        (row) => row.dsVersion,
      ),
    ).toEqual(["1.4.0", "1.9.2", "1.10.0"]);
  });

  // Sorting on repository is what replaces the group header the design asked
  // for: Table has no grouping, so clustering the repositories is the ordering's
  // job. Rows inside one repository must then hold a stable, meaningful order
  // rather than whatever the database happened to return.
  it("breaks ties on the app so one repository's rows cluster in a stable order", () => {
    const rows = [
      report({ repository: "acme/web", app: "storefront" }),
      report({ repository: "acme/api", app: "gateway" }),
      report({ repository: "acme/web", app: "admin" }),
    ];
    expect(
      sortReports(rows, { columnId: "repository", direction: "ascending" }).map(
        (row) => `${row.repository}/${row.app}`,
      ),
    ).toEqual(["acme/api/gateway", "acme/web/admin", "acme/web/storefront"]);
  });
});
