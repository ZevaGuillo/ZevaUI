// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin (`@vitejs/plugin-react` is not a
// dependency here, and adding it just for tests would be an extra build-pipeline dependency).
// `React.createElement` gives the exact same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on, without that extra dependency.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Badge } from "../src/badge/Badge.js";
import { badgeRecipe } from "../src/badge/badge.recipe.js";
import type { BadgeProps, BadgeTone } from "../src/badge/badge.types.js";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { recipeClassName } from "../src/internal/recipe-class.js";
import { selectorSegments } from "../src/internal/selector-segments.js";
import { emittedStylesheet } from "./support/emitted-css.js";

const css = emittedStylesheet();

const TONES: readonly BadgeTone[] = ["accent", "danger", "neutral", "success", "warning"];

afterEach(() => {
  cleanup();
});

// `BadgeProps.children` is required, so it must live on the props object itself for
// `createElement`'s overload resolution (and the excess-property checks below) to see it.
function renderBadge(props: BadgeProps) {
  return render(createElement(Badge, props));
}

describe("Badge", () => {
  it("falls back to tone=neutral when no tone is given", () => {
    renderBadge({ children: "Draft" });
    const badge = screen.getByText("Draft");
    expect(badge.className).toBe("zui-badge zui-badge--tone_neutral");
    expect(badge.className).toBe(recipeClassName(badgeRecipe, {}));
  });

  it('renders exactly "zui-badge zui-badge--tone_success" for tone="success"', () => {
    renderBadge({ tone: "success", children: "Shipped" });
    const badge = screen.getByText("Shipped");
    expect(badge.className).toBe("zui-badge zui-badge--tone_success");
    expect(badge.className).toBe(recipeClassName(badgeRecipe, { tone: "success" }));
  });

  it("emits one class per declared tone, and nothing else", () => {
    for (const tone of TONES) {
      cleanup();
      renderBadge({ tone, children: tone });
      expect(screen.getByText(tone).className).toBe(`zui-badge zui-badge--tone_${tone}`);
    }
  });

  // A badge is text with a background, not a widget: it announces nothing of its own and owns no
  // ARIA role. Whatever meaning the colour carries has to be in the text, which is why the
  // stories never ship a badge whose only content is a tone-coloured dot.
  it("renders a plain span with no role and no aria attributes of its own", () => {
    renderBadge({ tone: "danger", children: "Overdue" });
    const badge = screen.getByText("Overdue");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.hasAttribute("role")).toBe(false);
    expect(badge.getAttributeNames().filter((name) => name.startsWith("aria-"))).toEqual([]);
  });

  it("renders children inside the element", () => {
    renderBadge({ children: "12" });
    expect(screen.getByText("12").textContent).toBe("12");
  });
});

// G6 (the "use client" boundary assertion) lives in __tests__/emit-gates.test.ts, where it is one
// registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `BadgeProps` (rather than a direct call to
// `createElement`) so the excess-property/type checks below still apply to a fresh object
// literal, without tripping Biome's `noChildrenProp` rule on a raw `createElement` call.
function badgeElement(props: BadgeProps) {
  return createElement(Badge, props);
}

describe("Badge public API surface (type-level)", () => {
  it("rejects className, style and an unknown tone at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the
    // typecheck the moment its error disappears. What runs here is the
    // runtime half of the contract — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      badgeElement({ className: "x", children: "x" }),
      // @ts-expect-error style is not part of the public API
      badgeElement({ style: {}, children: "x" }),
      // @ts-expect-error unknown tone value
      badgeElement({ tone: "info", children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // The opposite of Alert, and deliberately so: Alert makes `tone` REQUIRED because a default
  // would invent a semantic meaning ("this message is a warning") the caller never stated. A
  // badge's `neutral` states nothing, so it is a safe default in the sense Button's
  // `visual: "solid"` is — the caller who omits `tone` gets a label, not a claim.
  it("accepts a badge with no tone at all", () => {
    expect(isValidElement(badgeElement({ children: "x" }))).toBe(true);
  });
});

describe("the emitted CSS has exactly the base plus five tone rules Badge owes", () => {
  // One linear pass over the emitted sheet, shared with the CSS gates: the obvious regex
  // spelling is super-linear, and a per-class rescan is what timed the gates out on CI.
  const heads = selectorSegments(css).map((segment) => segment.selector);
  const hasRule = (className: string): boolean => {
    const pattern = classSelectorPattern(className);
    return heads.some((head) => pattern.test(head));
  };

  it("emits the base .zui-badge rule", () => {
    expect(hasRule("zui-badge")).toBe(true);
  });

  it("emits exactly five .zui-badge--tone_* rules, one per declared tone", () => {
    const toneSelectors = [...new Set(css.match(/\.zui-badge--tone_[a-z]+/g) ?? [])];
    expect(toneSelectors.sort()).toEqual(TONES.map((tone) => `.zui-badge--tone_${tone}`).sort());
  });

  // The measured reason Badge paints `text.default` on every tone instead of the conventional
  // `{tone}.default` on `{tone}.subtle` is argued in badge.recipe.ts — that pairing was measured
  // against the real light-theme OKLCH values for Alert and fails the 4.5:1 AA floor in every
  // tone. This gate pins the consequence: no tone rule may set a text colour at all.
  it("no tone rule declares a text colour — the tone is background only", () => {
    const toneSegments = selectorSegments(css).filter((segment) =>
      /\.zui-badge--tone_[a-z]+/.test(segment.selector),
    );
    expect(toneSegments.length).toBeGreaterThan(0);
    for (const segment of toneSegments) {
      // A tone rule is a flat declaration block, so its body ends at the first closing brace.
      const body = css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex));
      expect(body).not.toMatch(/(^|[;\s])color\s*:/);
    }
  });
});
