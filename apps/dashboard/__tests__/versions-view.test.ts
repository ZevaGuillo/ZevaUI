// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file (stays `.test.ts`, not `.test.tsx`) --
// see the same rationale in packages/components/__tests__/button.test.ts.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { VersionsView } from "../src/panel/versions-view";

afterEach(cleanup);

const report = {
  repository: "acme/web",
  app: "web",
  dsVersion: "1.4.0",
  dsVersionSource: "installed",
  components: ["Button"],
  deprecatedComponents: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("VersionsView (RF-AP01 scenario 1: versions per app, no auth)", () => {
  it("renders one row per report with repository, app, version and source", () => {
    render(createElement(VersionsView, { reports: [report] }));
    const row = screen.getByRole("row", { name: /acme\/web/ });
    expect(row.textContent).toContain("web");
    expect(row.textContent).toContain("1.4.0");
    expect(row.textContent).toContain("installed");
  });

  // The repository identifies the record, so it is the `<th scope="row">` -- which
  // is what makes every other cell announce WITH its subject ("Design system
  // version, 1.4.0, acme/web") instead of a bare number. It is also what gives
  // the row above its accessible name, so that assertion and this one are the
  // same decision seen from two sides.
  it("makes the repository the row header", () => {
    render(createElement(VersionsView, { reports: [report] }));
    const rowHeader = screen.getByRole("rowheader", { name: "acme/web" });
    expect(rowHeader.getAttribute("scope")).toBe("row");
  });

  describe("the empty state stays INSIDE the table", () => {
    // A `<tbody>` with no rows beside a paragraph announces "0 rows" and then
    // says nothing about why. The caption and the headers survive, and the
    // message spans the columns, so the row count stays honest.
    it("keeps the caption and the column headers", () => {
      render(createElement(VersionsView, { reports: [] }));
      expect(screen.getByRole("table", { name: /design system versions/i })).toBeTruthy();
      expect(screen.getAllByRole("columnheader").length).toBeGreaterThan(0);
    });

    it("renders the empty message", () => {
      render(createElement(VersionsView, { reports: [] }));
      expect(screen.getByText(/no reports/i)).toBeTruthy();
    });
  });

  describe("sorting travels by URL, never by callback (RF-AP01 scenario 2)", () => {
    // The panel has no mutation affordance at all, so a sortable heading cannot be
    // a button with an onPress -- it is a Link to the sorted view, and the column
    // you are already sorted by points at the OTHER direction. A heading that
    // pointed at its current direction would do nothing the second time.
    it("renders sortable headings as links to the next direction", () => {
      render(
        createElement(VersionsView, {
          reports: [report],
          sort: { columnId: "repository", direction: "ascending" as const },
        }),
      );
      // Query-only, carrying no path: it resolves against whatever page is
      // current, so the view never hardcodes the route it happens to live on.
      expect(screen.getByRole("link", { name: "Repository" }).getAttribute("href")).toBe(
        "?sort=repository&dir=descending",
      );
    });

    // `aria-sort` is what announces that a column CAN be sorted, so it belongs on
    // the sortable columns and on no others -- `none` on the unsorted ones, and
    // nothing at all on a column with no sort.
    it("marks the sorted column and leaves the unsortable ones unmarked", () => {
      render(
        createElement(VersionsView, {
          reports: [report],
          sort: { columnId: "repository", direction: "ascending" as const },
        }),
      );
      const [repository] = screen.getAllByRole("columnheader");
      expect(repository?.getAttribute("aria-sort")).toBe("ascending");
      expect(
        screen.getByRole("columnheader", { name: "Reported at" }).getAttribute("aria-sort"),
      ).toBeNull();
    });

    // First load, before any `?sort=` exists: the headings are still links,
    // because the destination exists whether or not the visitor has used one.
    // What is absent is a DIRECTION -- `aria-sort="none"`, not a missing link.
    it("links every sortable heading before any sort is applied", () => {
      render(createElement(VersionsView, { reports: [report] }));
      expect(screen.getByRole("link", { name: "Repository" }).getAttribute("href")).toBe(
        "?sort=repository&dir=ascending",
      );
      expect(
        screen.getByRole("columnheader", { name: "Repository" }).getAttribute("aria-sort"),
      ).toBe("none");
    });
  });

  // The ingestion schema closes this domain at "installed" or "declared"
  // (packages/audit/src/report-schema.js:64), and the two mean different things:
  // `installed` was measured, `declared` was read off a version RANGE and may not
  // be what is actually running. The tones carry that difference.
  describe("the version source is toned by how much it can be trusted", () => {
    it("renders the source as text whatever it is", () => {
      render(
        createElement(VersionsView, {
          reports: [report, { ...report, app: "admin", dsVersionSource: "declared" }],
        }),
      );
      expect(screen.getByText("installed")).toBeTruthy();
      expect(screen.getByText("declared")).toBeTruthy();
    });

    // `dsVersionSource` is typed `string`, not a union, so a value the schema
    // forbids can still reach this view through a column default or a migration.
    // It renders, untoned -- inventing a tone would assert something false.
    it("renders an out-of-domain source without inventing a meaning", () => {
      render(
        createElement(VersionsView, {
          reports: [{ ...report, dsVersionSource: "guessed" }],
        }),
      );
      expect(screen.getByText("guessed")).toBeTruthy();
    });

    // THE CASE "guessed" DOES NOT COVER, because "guessed" is absent from the
    // prototype chain too. An object literal answers an index lookup for every
    // `Object.prototype` key -- `{}["constructor"]` is `Object`, not `undefined`
    // -- so with a plain object these values would skip the fallback entirely
    // and render a Badge toned with a function. They must come out as bare text,
    // exactly like any other value the schema does not define.
    it.each(["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"])(
      "treats the prototype-chain name %s as an ordinary unknown source",
      (source) => {
        const { container } = render(
          createElement(VersionsView, { reports: [{ ...report, dsVersionSource: source }] }),
        );
        const cell = screen.getByText(source);
        expect(cell.textContent).toBe(source);
        // A Badge renders a <span> carrying its own recipe class. The fallback
        // path renders the string straight into the cell, so no span appears
        // around it -- that is what distinguishes "no badge" from "untoned badge".
        expect(container.querySelector("td > span, th > span")).toBeNull();
      },
    );
  });

  // Threat Matrix: poisoned report (XSS) -- app/dsVersion carrying HTML must
  // render as literal text, never become a real DOM element.
  it("renders a payload app/dsVersion as literal text, never as an element (XSS)", () => {
    const payload = '<img src=x onerror="window.__pwned = true">';
    const { container } = render(
      createElement(VersionsView, {
        reports: [{ ...report, app: payload, dsVersion: payload }],
      }),
    );
    expect(container.textContent).toContain(payload);
    expect(container.querySelector("img")).toBeNull();
  });
});
