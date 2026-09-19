// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Breadcrumb } from "../src/breadcrumb/Breadcrumb.js";
import { breadcrumbRecipe } from "../src/breadcrumb/breadcrumb.recipe.js";
import type { BreadcrumbProps } from "../src/breadcrumb/breadcrumb.types.js";
import { recipeClassName } from "../src/internal/recipe-class.js";
import { selectorSegments } from "../src/internal/selector-segments.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { linkRecipe } from "../src/link/link.recipe.js";
import { emittedStylesheet, styledClassPredicate } from "./support/emitted-css.js";

const css = emittedStylesheet();

const TRAIL: BreadcrumbProps = {
  items: [
    { id: "home", label: "Home", href: "/" },
    { id: "projects", label: "Projects", href: "/projects" },
  ],
  current: "Alpha release",
};

afterEach(() => {
  cleanup();
});

function renderBreadcrumb(props: Partial<BreadcrumbProps> = {}) {
  return render(createElement(Breadcrumb, { ...TRAIL, ...props }));
}

describe("Breadcrumb", () => {
  // The landmark is the whole reason this component renders a `<nav>` at all: it is how someone
  // navigating by structure jumps to the trail, and an `<ol>` on its own is not one.
  // react-aria-components' `Breadcrumbs` emits only the list, which is the job most callers skip.
  it("renders a named navigation landmark", () => {
    renderBreadcrumb();
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav.tagName).toBe("NAV");
  });

  it("lets the landmark be renamed, for a second trail or another language", () => {
    renderBreadcrumb({ label: "Ruta de navegación" });
    expect(screen.getByRole("navigation", { name: "Ruta de navegación" })).toBeTruthy();
  });

  it("renders the hierarchy as an ordered list, one item per crumb", () => {
    renderBreadcrumb();
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    // Two ancestors plus the current page.
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders every ancestor as a real link to its own destination", () => {
    renderBreadcrumb();
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
    expect(screen.getByRole("link", { name: "Projects" }).getAttribute("href")).toBe("/projects");
  });
});

/**
 * THE DEFECT THIS COMPONENT'S TYPE EXISTS TO PREVENT, pinned as behaviour.
 *
 * A hand-rolled trail almost always links its last crumb to the page the user is already on: a
 * screen reader announces it as a link, and a sighted user clicks it to no effect. The
 * conventional API shape — one `items` array whose last entry is implicitly current, which is how
 * react-aria-components models it — permits exactly that, and permits the mirror defect too (an
 * ancestor with no `href`, a crumb that goes nowhere).
 *
 * `breadcrumb.types.ts` splits the two into separate props so neither state can be constructed.
 * These assertions prove the split reaches the DOM rather than stopping at the type.
 */
describe("Breadcrumb never links to the page you are on", () => {
  it("renders the current page as plain text carrying aria-current", () => {
    renderBreadcrumb();
    const current = screen.getByText("Alpha release");
    expect(current.tagName).toBe("SPAN");
    expect(current.getAttribute("aria-current")).toBe("page");
  });

  it("exposes exactly as many links as there are ancestors", () => {
    renderBreadcrumb();
    expect(screen.getAllByRole("link")).toHaveLength(TRAIL.items.length);
    expect(screen.queryByRole("link", { name: "Alpha release" })).toBeNull();
  });

  // A top-level page has a trail of exactly one crumb: itself. It is still a landmark, still a
  // list, and still carries `aria-current` — there is simply nothing above it.
  it("renders a trail with no ancestors at all", () => {
    renderBreadcrumb({ items: [], current: "Dashboard" });
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("Dashboard").getAttribute("aria-current")).toBe("page");
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(1);
  });
});

/**
 * The separator is a real element rather than a `::before`, and this is the pair of assertions
 * that makes that choice load-bearing instead of incidental: some screen readers announce CSS
 * generated content, and a pseudo-element has no node for `aria-hidden` to sit on. So the trail
 * must read as "Home, Projects, Alpha release" and never as "Home slash Projects slash".
 */
describe("Breadcrumb separators are drawn and never announced", () => {
  it("renders one separator per ancestor, each hidden from the accessibility tree", () => {
    const { container } = renderBreadcrumb();
    const separators = container.querySelectorAll(".zui-breadcrumb__separator");
    expect(separators).toHaveLength(TRAIL.items.length);
    for (const separator of separators) {
      expect(separator.getAttribute("aria-hidden")).toBe("true");
    }
  });

  // No trailing separator after the current page: the trail ends where you are.
  it("puts no separator after the current page", () => {
    const { container } = renderBreadcrumb();
    const items = container.querySelectorAll("li");
    const last = items[items.length - 1];
    expect(last.querySelector(".zui-breadcrumb__separator")).toBeNull();
  });
});

describe("Breadcrumb class contract", () => {
  it("stamps each slot's class, and no variant class, because the recipe declares none", () => {
    const { container } = renderBreadcrumb();
    const slots = slotRecipeClassNames(breadcrumbRecipe, {});

    expect(screen.getByRole("navigation").className).toBe(slots.nav);
    expect(screen.getByRole("list").className).toBe(slots.list);
    expect(screen.getByText("Alpha release").className).toBe(slots.current);
    expect(container.querySelector("li")?.className).toBe(slots.item);
  });

  /**
   * The composition this component was the reason for. `tone="neutral"` with `underline="hover"`
   * is the pair `link.recipe.ts` documents as correct in a navigation structure and as a WCAG
   * 1.4.1 failure inside prose — a trail where every crumb is blue and underlined makes the colour
   * carry no information, because nothing in it is NOT a link.
   *
   * Asserted against the link recipe rather than a literal string, so the day that axis is renamed
   * this fails at the rename instead of shipping crumbs with classes nothing styles.
   */
  it("renders its crumbs with the link treatment navigation calls for", () => {
    renderBreadcrumb();
    const expected = recipeClassName(linkRecipe, { tone: "neutral", underline: "hover" });
    expect(screen.getByRole("link", { name: "Home" }).className).toBe(expected);
  });
});

function breadcrumbElement(props: BreadcrumbProps) {
  return createElement(Breadcrumb, props);
}

describe("Breadcrumb public API surface (type-level)", () => {
  it("rejects className, style and a crumb with nowhere to go at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      breadcrumbElement({ ...TRAIL, className: "x" }),
      // @ts-expect-error style is not part of the public API
      breadcrumbElement({ ...TRAIL, style: {} }),
      // @ts-expect-error an ancestor without an href is a crumb that goes nowhere
      breadcrumbElement({ items: [{ id: "a", label: "A" }], current: "B" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // The mirror defect, and the one the split is really for: `current` is a string, so there is no
  // `href` to give it. A breadcrumb that links to the page you are on cannot be written.
  it("gives the current page no place to put a destination", () => {
    const constructed = [
      // @ts-expect-error `current` is the page's text, not a descriptor
      breadcrumbElement({ items: [], current: { label: "B", href: "/b" } }),
      // @ts-expect-error current is required — a trail always ends somewhere
      breadcrumbElement({ items: TRAIL.items }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

describe("the emitted CSS Breadcrumb owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits a rule for every slot it styles", () => {
    for (const slot of breadcrumbRecipe.slots) {
      expect({ [slot]: hasRule(`zui-breadcrumb__${slot}`) }).toEqual({ [slot]: true });
    }
  });

  // The slot-recipe counterpart to the same assertion in `tooltip.test.ts`: Panda is handed an
  // empty `staticCss` variant map for this recipe and the base rules still land. A Panda that
  // stopped emitting them would ship this component unstyled with nothing else noticing.
  it("emits no variant class for a recipe that declares no variants", () => {
    expect(css.match(/\.zui-breadcrumb__[a-z]+--[a-z]+_/)).toBeNull();
  });

  /**
   * A trail is as deep as the hierarchy is, and a deep one on a narrow viewport has to wrap rather
   * than push the page sideways. This is the declaration whose absence makes a breadcrumb the
   * thing that gives a layout a horizontal scrollbar — a regression that only appears at one
   * viewport width and therefore never in a default screenshot.
   */
  it("wraps instead of overflowing", () => {
    const segments = selectorSegments(css).filter((segment) =>
      segment.selector.includes(".zui-breadcrumb__list"),
    );
    expect(segments.length).toBeGreaterThan(0);
    const body = segments
      .map((segment) =>
        css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex)),
      )
      .join(";");
    expect(body).toMatch(/flex-wrap:\s*wrap/);
  });
});
