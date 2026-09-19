// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { recipeClassName } from "../src/internal/recipe-class.js";
import { selectorSegments } from "../src/internal/selector-segments.js";
import { Separator } from "../src/separator/Separator.js";
import { separatorRecipe } from "../src/separator/separator.recipe.js";
import type { SeparatorOrientation, SeparatorProps } from "../src/separator/separator.types.js";
import { emittedStylesheet, styledClassPredicate } from "./support/emitted-css.js";

const css = emittedStylesheet();

const ORIENTATIONS: readonly SeparatorOrientation[] = ["horizontal", "vertical"];

afterEach(() => {
  cleanup();
});

function renderSeparator(props: SeparatorProps = {}) {
  return render(createElement(Separator, props));
}

describe("Separator", () => {
  it("renders an <hr>, whose implicit role is separator", () => {
    renderSeparator();
    const separator = screen.getByRole("separator");
    expect(separator.tagName).toBe("HR");
  });

  it("falls back to orientation=horizontal when none is given", () => {
    renderSeparator();
    const separator = screen.getByRole("separator");
    expect(separator.className).toBe("zui-separator zui-separator--orientation_horizontal");
    expect(separator.className).toBe(recipeClassName(separatorRecipe, {}));
  });

  it("emits one class per declared orientation, and nothing else", () => {
    for (const orientation of ORIENTATIONS) {
      cleanup();
      renderSeparator({ orientation });
      expect(screen.getByRole("separator").className).toBe(
        `zui-separator zui-separator--orientation_${orientation}`,
      );
    }
  });
});

describe("Separator and the orientation it announces", () => {
  // `horizontal` is already the implicit value for `role="separator"`, so writing it changes
  // nothing in any accessibility tree and only adds an attribute a reader must check against the
  // spec to know is redundant.
  it("omits aria-orientation when horizontal rather than spelling out the implicit value", () => {
    renderSeparator({ orientation: "horizontal" });
    expect(screen.getByRole("separator").hasAttribute("aria-orientation")).toBe(false);
  });

  it("sets aria-orientation=vertical when vertical", () => {
    renderSeparator({ orientation: "vertical" });
    expect(screen.getByRole("separator").getAttribute("aria-orientation")).toBe("vertical");
  });
});

describe("Separator when the division is already announced by something else", () => {
  // The default is the load-bearing half: a separator's purpose is to say "these two things are
  // separate", and `role="separator"` is how that reaches someone navigating by structure rather
  // than by sight. Defaulting to decorative would make the common case the silent one.
  it("is structural by default", () => {
    renderSeparator();
    expect(screen.queryAllByRole("separator")).toHaveLength(1);
  });

  it("leaves the accessibility tree entirely when decorative", () => {
    const { container } = renderSeparator({ decorative: true });
    expect(screen.queryByRole("separator")).toBeNull();
    const hr = container.querySelector("hr");
    expect(hr?.getAttribute("role")).toBe("presentation");
  });

  // Decorative is an ARIA decision, never a visual one: the line looks identical either way, so
  // the class contract must not move with it.
  it("paints identically whether or not it announces itself", () => {
    const { container } = renderSeparator({ orientation: "vertical", decorative: true });
    expect(container.querySelector("hr")?.className).toBe(
      recipeClassName(separatorRecipe, { orientation: "vertical" }),
    );
  });

  // A decorative separator carries no orientation either — there is no role left for
  // `aria-orientation` to qualify, and an orphan ARIA attribute on a presentational element is
  // noise a validator will eventually flag.
  it("carries no aria-orientation once it is presentational", () => {
    const { container } = renderSeparator({ orientation: "vertical", decorative: true });
    expect(container.querySelector("hr")?.hasAttribute("aria-orientation")).toBe(false);
  });
});

function separatorElement(props: SeparatorProps) {
  return createElement(Separator, props);
}

describe("Separator public API surface (type-level)", () => {
  it("rejects className, style, children and an unknown orientation at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      separatorElement({ className: "x" }),
      // @ts-expect-error style is not part of the public API
      separatorElement({ style: {} }),
      // @ts-expect-error <hr> is void content; a labelled divider is a different component
      separatorElement({ children: "or" }),
      // @ts-expect-error unknown orientation value
      separatorElement({ orientation: "diagonal" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  it("accepts a separator with no props at all", () => {
    expect(isValidElement(separatorElement({}))).toBe(true);
  });
});

describe("the emitted CSS Separator owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits the base .zui-separator rule", () => {
    expect(hasRule("zui-separator")).toBe(true);
  });

  it("emits exactly two .zui-separator--orientation_* rules", () => {
    const selectors = [...new Set(css.match(/\.zui-separator--orientation_[a-z]+/g) ?? [])];
    expect(selectors.sort()).toEqual(
      ORIENTATIONS.map((o) => `.zui-separator--orientation_${o}`).sort(),
    );
  });

  /**
   * The rule is painted as a BACKGROUND, never as a border, and that is what lets one declaration
   * serve both orientations. It also means the `<hr>` user-agent border has to be switched off
   * rather than recoloured — a `border-style: inset` left in place would draw a second, bevelled
   * line beside the one this component actually owns.
   */
  it("resets the user-agent border instead of recolouring it", () => {
    const baseSegments = selectorSegments(css).filter(
      (segment) => segment.selector.trim() === ".zui-separator",
    );
    expect(baseSegments.length).toBeGreaterThan(0);
    const body = baseSegments
      .map((segment) =>
        css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex)),
      )
      .join(";");
    expect(body).toMatch(/border-style\s*:\s*none/);
    expect(body).toMatch(/background(-color)?\s*:/);
  });

  /**
   * A separator between flex items IS a flex item, and a flex item with a 1px basis is the first
   * thing a crowded row squashes to nothing. This is the one declaration whose absence would make
   * a vertical divider vanish only under pressure — the hardest kind of regression to notice.
   */
  it("refuses to shrink", () => {
    const baseSegments = selectorSegments(css).filter(
      (segment) => segment.selector.trim() === ".zui-separator",
    );
    const body = baseSegments
      .map((segment) =>
        css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex)),
      )
      .join(";");
    expect(body).toMatch(/flex-shrink\s*:\s*0/);
  });
});
