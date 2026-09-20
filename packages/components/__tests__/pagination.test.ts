// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Pagination } from "../src/pagination/Pagination.js";
import { paginationRecipe } from "../src/pagination/pagination.recipe.js";
import type { PaginationProps } from "../src/pagination/pagination.types.js";
import {
  declarationBodies,
  emittedStylesheet,
  styledClassPredicate,
} from "./support/emitted-css.js";

const css = emittedStylesheet();

const href = (page: number) => `/issues?page=${page}`;

afterEach(() => {
  cleanup();
});

function renderPagination(props: Partial<PaginationProps> = {}) {
  return render(createElement(Pagination, { page: 4, total: 20, href, ...props }));
}

describe("Pagination", () => {
  // The landmark is how someone navigating by structure reaches the control at all — an `<ol>` on
  // its own is not one. Same reading `Breadcrumb` applies.
  it("renders a named navigation landmark around an ordered list", () => {
    renderPagination();
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(nav.tagName).toBe("NAV");
    expect(within(nav).getByRole("list").tagName).toBe("OL");
  });

  it("lets the landmark be renamed, for a second list or another language", () => {
    renderPagination({ label: "Paginación" });
    expect(screen.getByRole("navigation", { name: "Paginación" })).toBeTruthy();
  });

  /**
   * A pagination control for one page tells the reader something they can already see, and costs a
   * landmark in the accessibility tree to say it. This is the one case where returning `null` is
   * the design rather than a guard, so it is asserted rather than left to be discovered.
   */
  it("renders nothing at all for a single page", () => {
    const { container } = renderPagination({ page: 1, total: 1 });
    expect(container.innerHTML).toBe("");
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("renders nothing for an empty result set", () => {
    const { container } = renderPagination({ page: 1, total: 0 });
    expect(container.innerHTML).toBe("");
  });
});

/**
 * EVERY PAGE IS A REAL LINK, WHICH IS THE DECISION EVERYTHING ELSE FOLLOWS FROM. The conventional
 * API is `onPageChange(page)`, which makes every number a button — and a page of results has a URL
 * while a button does not. These assertions pin that the rendered control is navigable: bookmarkable,
 * middle-clickable, previewable in the status bar.
 */
describe("Pagination is built on links, not on a callback", () => {
  it("gives every page its own destination from the href function", () => {
    renderPagination({ page: 4, total: 20 });
    expect(screen.getByRole("link", { name: "3" }).getAttribute("href")).toBe("/issues?page=3");
    expect(screen.getByRole("link", { name: "5" }).getAttribute("href")).toBe("/issues?page=5");
    expect(screen.getByRole("link", { name: "20" }).getAttribute("href")).toBe("/issues?page=20");
  });

  // The defect `Breadcrumb` restructured its whole API to make unrepresentable: a link to the page
  // you are already on is announced as a link and clicks to no effect.
  it("renders the current page as plain text carrying aria-current", () => {
    renderPagination({ page: 4, total: 20 });
    const current = screen.getByText("4");
    expect(current.tagName).toBe("SPAN");
    expect(current.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "4" })).toBeNull();
  });
});

/**
 * THE EDGE CONTROLS, AND THE CHOICE MOST PAGINATION COMPONENTS MAKE DIFFERENTLY.
 *
 * A disabled "Previous" on page 1 announces as "Previous page, dimmed" — a control offered and then
 * withdrawn, on every first page, to everyone using a keyboard or a screen reader. The fact it
 * conveys is "you are at the start", and `aria-current="page"` on the first number already says
 * exactly that. So the cell is reserved visually and left out of the accessibility tree.
 */
describe("Pagination's edge controls", () => {
  it("names them with words rather than the glyph they draw", () => {
    renderPagination({ page: 4, total: 20 });
    expect(screen.getByRole("link", { name: "Previous page" }).getAttribute("href")).toBe(
      "/issues?page=3",
    );
    expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe(
      "/issues?page=5",
    );
  });

  it("lets both names be localised", () => {
    renderPagination({ previousLabel: "Página anterior", nextLabel: "Página siguiente" });
    expect(screen.getByRole("link", { name: "Página anterior" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Página siguiente" })).toBeTruthy();
  });

  it("offers no Previous on the first page, and says nothing about it", () => {
    renderPagination({ page: 1, total: 20 });
    expect(screen.queryByRole("link", { name: "Previous page" })).toBeNull();
    expect(screen.getByRole("link", { name: "Next page" })).toBeTruthy();
  });

  it("offers no Next on the last page", () => {
    renderPagination({ page: 20, total: 20 });
    expect(screen.queryByRole("link", { name: "Next page" })).toBeNull();
    expect(screen.getByRole("link", { name: "Previous page" })).toBeTruthy();
  });

  // The cell is still THERE, so the row does not shift out from under the pointer when you reach
  // either end. That is the half a screen reader must not see and a sighted user must.
  it("reserves the cell it does not fill", () => {
    const { container } = renderPagination({ page: 1, total: 20 });
    const edges = container.querySelectorAll(".zui-pagination__edge");
    expect(edges).toHaveLength(1);
    expect(edges[0].getAttribute("aria-hidden")).toBe("true");
  });

  it("reserves neither cell in the middle of the trail", () => {
    const { container } = renderPagination({ page: 10, total: 20 });
    expect(container.querySelectorAll(".zui-pagination__edge")).toHaveLength(0);
  });
});

describe("Pagination gaps", () => {
  // A real element rather than a `::before`, so `aria-hidden` has a node to sit on — some screen
  // readers announce CSS generated content. Same shape as `Breadcrumb`'s separator.
  it("hides the ellipsis from the accessibility tree", () => {
    const { container } = renderPagination({ page: 10, total: 20 });
    const gaps = container.querySelectorAll(".zui-pagination__gap");
    expect(gaps).toHaveLength(2);
    for (const gap of gaps) expect(gap.getAttribute("aria-hidden")).toBe("true");
  });

  // The trail reads as its page numbers, never as "1 ellipsis 9 10 11 ellipsis 20".
  it("announces only the pages", () => {
    renderPagination({ page: 10, total: 20 });
    const names = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label") ?? link.textContent);
    expect(names).toEqual(["Previous page", "1", "9", "11", "20", "Next page"]);
  });
});

describe("Pagination class contract", () => {
  it("stamps each slot's class, and no variant class, because the recipe declares none", () => {
    const { container } = renderPagination({ page: 10, total: 20 });
    const slots = slotRecipeClassNames(paginationRecipe, {});

    expect(screen.getByRole("navigation").className).toBe(slots.nav);
    expect(screen.getByRole("list").className).toBe(slots.list);
    expect(screen.getByText("10").className).toBe(slots.current);
    expect(container.querySelector("li")?.className).toBe(slots.item);
  });
});

function paginationElement(props: PaginationProps) {
  return createElement(Pagination, props);
}

describe("Pagination public API surface (type-level)", () => {
  it("rejects className and style at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      paginationElement({ className: "x", page: 1, total: 2, href }),
      // @ts-expect-error style is not part of the public API
      paginationElement({ style: {}, page: 1, total: 2, href }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // `href` is the prop that makes this a navigation control rather than a callback widget, so it is
  // required. There is deliberately no `onPageChange` to reach for instead.
  it("cannot be constructed without destinations", () => {
    const constructed = [
      // @ts-expect-error href is required — a page with no destination is a button
      paginationElement({ page: 1, total: 2 }),
      // @ts-expect-error there is no callback API; the href is the navigation
      paginationElement({ page: 1, total: 2, href, onPageChange: () => {} }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

describe("the emitted CSS Pagination owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits a rule for every slot it styles", () => {
    for (const slot of paginationRecipe.slots) {
      expect({ [slot]: hasRule(`zui-pagination__${slot}`) }).toEqual({ [slot]: true });
    }
  });

  it("emits no variant class for a recipe that declares no variants", () => {
    expect(css.match(/\.zui-pagination__[a-z]+--[a-z]+_/)).toBeNull();
  });

  /**
   * Page numbers are one, two or three digits, so a row sized to its content reflows the moment you
   * paginate past 9 or 99 — and the control you are clicking moves out from under the pointer that
   * just clicked it. This is the floor that keeps the row still, and it is exactly the kind of
   * regression a screenshot at one page number would never catch.
   */
  it("gives every cell the same floor, so the row does not reflow as the digits grow", () => {
    const bodies = declarationBodies(css, (selector) => selector.includes(".zui-pagination__item"));
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.join(";")).toMatch(/min-inline-size:/);
  });

  it("wraps instead of overflowing", () => {
    const bodies = declarationBodies(css, (selector) => selector.includes(".zui-pagination__list"));
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.join(";")).toMatch(/flex-wrap:\s*wrap/);
  });
});
