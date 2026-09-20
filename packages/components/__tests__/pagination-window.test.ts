import { describe, expect, it } from "vitest";
import { paginationWindow } from "../src/internal/pagination-window.js";

/**
 * TESTED AS A UNIT RATHER THAN THROUGH ELEVEN RENDERED `<li>` ELEMENTS, and that is a lesson from
 * the `Avatar` change rather than a habit: its CSS escaper was first tested through a rendered DOM,
 * and the test turned out to be worthless because jsdom refused to parse the value and the
 * assertion passed for an implementation that did nothing.
 *
 * Same shape of problem here. The interesting behaviour is arithmetic over edge cases — boundaries,
 * clamping, and exactly when a gap is worth drawing — and asserting it through rendered markup
 * would test the renderer far more than the rule.
 */

/** A readable shorthand for the assertions below: `1 … 4 5 6 … 20`. */
const shown = (page: number, total: number, siblings = 1): string =>
  paginationWindow(page, total, siblings)
    .map((item) => (item.type === "gap" ? "…" : String(item.page)))
    .join(" ");

describe("paginationWindow", () => {
  /**
   * The window is the FIRST page, the LAST page and the current one's neighbours — never "all of
   * them if they happen to fit". This assertion was written the other way first and was wrong: on
   * page 1 of 5 with one sibling the window is `{1, 2, 5}`, so pages 3 and 4 collapse, and that is
   * correct rather than a defect. Recorded here because "it's only five pages, surely they all
   * show" is exactly the reasoning that would loosen this into a special case nobody can predict.
   */
  it("keeps the window even on a short trail", () => {
    expect(shown(1, 5)).toBe("1 2 … 5");
    expect(shown(5, 5)).toBe("1 … 4 5");
  });

  it("shows every page when the window happens to cover them all", () => {
    // Page 3 of 5 with one sibling: `{1, 2, 3, 4, 5}` — nothing left to collapse.
    expect(shown(3, 5)).toBe("1 2 3 4 5");
  });

  it("keeps the first page, the last page and the current one's neighbours", () => {
    expect(shown(10, 20)).toBe("1 … 9 10 11 … 20");
  });

  it("drops the leading gap when the current page is near the start", () => {
    expect(shown(1, 20)).toBe("1 2 … 20");
    expect(shown(3, 20)).toBe("1 2 3 4 … 20");
  });

  it("drops the trailing gap when the current page is near the end", () => {
    expect(shown(20, 20)).toBe("1 … 19 20");
    expect(shown(18, 20)).toBe("1 … 17 18 19 20");
  });

  it("widens with siblings", () => {
    expect(shown(10, 20, 0)).toBe("1 … 10 … 20");
    expect(shown(10, 20, 2)).toBe("1 … 8 9 10 11 12 … 20");
    // Enough reach and the gaps disappear entirely rather than collapsing wrongly.
    expect(shown(10, 20, 9)).toBe("1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20");
  });
});

/**
 * THE RULE THAT IS NOT OBVIOUS, and the reason this file exists rather than a couple of assertions
 * inside the component's test.
 *
 * The naive condition — "insert a gap wherever consecutive kept pages are more than one apart" —
 * produces `1 … 3 4 5 … 20` on page 4, where the leading ellipsis stands in for page 2 ALONE. That
 * is strictly worse than showing it: the ellipsis occupies the same cell, costs a click to get past,
 * and tells the reader less. A gap has to hide at least two pages to be worth drawing.
 */
describe("paginationWindow never hides a single page behind a gap", () => {
  it("renders the page instead of an ellipsis that would stand in for it alone", () => {
    // Page 4 of 20: kept pages are 1, 3, 4, 5, 20. The 1→3 gap hides only page 2.
    expect(shown(4, 20)).toBe("1 2 3 4 5 … 20");
  });

  it("does the same at the other end", () => {
    // Page 17 of 20: the 18→20 gap would hide only page 19.
    expect(shown(17, 20)).toBe("1 … 16 17 18 19 20");
  });

  it("still draws a gap once it hides two pages or more", () => {
    expect(shown(5, 20)).toBe("1 … 4 5 6 … 20");
  });
});

/**
 * `page` reaches this from a query string in every real call site, so `?page=0` and `?page=9999`
 * are user input rather than caller bugs. Rendering nothing, or marking a current page that is not
 * in the list, would be a worse answer than showing the nearest real page.
 */
describe("paginationWindow survives input from a URL", () => {
  it("clamps a page below the first", () => {
    expect(shown(0, 20)).toBe(shown(1, 20));
    expect(shown(-7, 20)).toBe(shown(1, 20));
  });

  it("clamps a page past the last", () => {
    expect(shown(21, 20)).toBe(shown(20, 20));
    expect(shown(9999, 20)).toBe(shown(20, 20));
  });

  it("truncates a fractional page rather than producing a fractional label", () => {
    expect(shown(4.7, 20)).toBe(shown(4, 20));
  });

  it("treats a negative sibling count as none", () => {
    expect(shown(10, 20, -3)).toBe(shown(10, 20, 0));
  });

  it("returns nothing at all for a total below one", () => {
    expect(paginationWindow(1, 0, 1)).toEqual([]);
    expect(paginationWindow(1, -5, 1)).toEqual([]);
  });

  // The degenerate trail that must not duplicate its only page: `1` is both the first and the last.
  it("renders a single page once", () => {
    expect(shown(1, 1)).toBe("1");
  });
});

describe("paginationWindow output shape", () => {
  it("never places two gaps next to each other", () => {
    for (let page = 1; page <= 40; page += 1) {
      const items = paginationWindow(page, 40, 1);
      const adjacent = items.some(
        (item, index) => item.type === "gap" && items[index + 1]?.type === "gap",
      );
      expect({ page, adjacent }).toEqual({ page, adjacent: false });
    }
  });

  it("always includes the first page, the last page and the current one", () => {
    for (let page = 1; page <= 40; page += 1) {
      const pages = paginationWindow(page, 40, 1)
        .filter((item) => item.type === "page")
        .map((item) => (item.type === "page" ? item.page : 0));
      expect({
        page,
        has: pages.includes(1) && pages.includes(40) && pages.includes(page),
      }).toEqual({ page, has: true });
    }
  });

  it("is strictly ascending, with no page repeated", () => {
    for (let page = 1; page <= 40; page += 1) {
      const pages = paginationWindow(page, 40, 2)
        .filter((item) => item.type === "page")
        .map((item) => (item.type === "page" ? item.page : 0));
      const ascending = pages.every((value, index) => index === 0 || value > pages[index - 1]);
      expect({ page, ascending }).toEqual({ page, ascending: true });
    }
  });
});
