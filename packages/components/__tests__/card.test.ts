// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin (`@vitejs/plugin-react` is not a
// dependency here, and adding it just for tests would be an extra build-pipeline dependency).
// `React.createElement` gives the exact same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on, without that extra dependency.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "../src/card/Card.js";
import { cardRecipe } from "../src/card/card.recipe.js";
import type { CardPartProps, CardProps } from "../src/card/card.types.js";
import { emittedSlotClassNames, slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import {
  declarationBodies,
  emittedStylesheet,
  styledClassPredicate,
} from "./support/emitted-css.js";

const css = emittedStylesheet();

afterEach(() => {
  cleanup();
});

// `CardProps.children` is required, so it must live on the props object itself for
// `createElement`'s overload resolution (and the excess-property checks below) to see it.
function renderCard(props: Omit<CardProps, "children">, children: ReactNode) {
  return render(createElement(Card, { ...props, children }));
}

// Builds one Card part with a stable key, routed through a `children` shorthand (rather than an
// explicit `children:` property) so Biome's `noChildrenProp` rule — which targets exactly that
// literal shape passed straight to `createElement` — has nothing to flag.
function cardPart(part: typeof Card.Header, key: string, text: ReactNode) {
  const children = text;
  return createElement(part, { key, children });
}

describe("Card", () => {
  it("applies exactly the root's base and default variant class, with no props", () => {
    renderCard({}, "root content");
    const root = screen.getByText("root content");
    expect(root.className).toBe(slotRecipeClassNames(cardRecipe, {}).root);
  });

  it("swaps only the root's variant class for surface=outlined", () => {
    renderCard({ surface: "outlined" }, "root content");
    const root = screen.getByText("root content");
    expect(root.className).toBe(slotRecipeClassNames(cardRecipe, { surface: "outlined" }).root);
  });

  // THE POINT OF THE SECOND AXIS. ADR-0021 E1 recorded that `surface` is one-of, so a card could
  // have a boundary OR a shadow and never both — the design's own E1 panel wanted both. These three
  // tests pin the composition directly on the class list rather than through
  // `slotRecipeClassNames`, which would only restate the helper: what is in doubt is that two
  // single-slot axes land side by side on `root`, with neither overwriting the other.
  it("renders both variant classes for surface=outlined with shadow=card", () => {
    renderCard({ surface: "outlined", shadow: "card" }, "root content");
    const root = screen.getByText("root content");
    expect(root.className.split(" ")).toEqual([
      "zui-card__root",
      "zui-card__root--surface_outlined",
      "zui-card__root--shadow_card",
    ]);
  });

  it("adds the shadow class alongside the default surface, not instead of it", () => {
    renderCard({ shadow: "card" }, "root content");
    const root = screen.getByText("root content");
    expect(root.className.split(" ")).toEqual([
      "zui-card__root",
      "zui-card__root--surface_elevated",
      "zui-card__root--shadow_card",
    ]);
  });

  // The additive half of the contract: every Card that exists today renders byte-identical DOM.
  // `shadow` has no `defaultVariants` entry, so omitting it must emit no class whatsoever — the
  // test at the top of this block pins the no-props case against the helper, this one pins that
  // nothing shadow-shaped leaks in on the other surface either.
  it("emits no shadow class at all when shadow is omitted", () => {
    renderCard({ surface: "outlined" }, "root content");
    const root = screen.getByText("root content");
    expect(root.className).not.toMatch(/shadow/);
  });

  it("renders Card.Header, Card.Body and Card.Footer with exactly their own slot class", () => {
    renderCard({}, [
      cardPart(Card.Header, "header", "Head"),
      cardPart(Card.Body, "body", "Body"),
      cardPart(Card.Footer, "footer", "Foot"),
    ]);
    const slots = slotRecipeClassNames(cardRecipe, {});
    expect(screen.getByText("Head").className).toBe(slots.header);
    expect(screen.getByText("Body").className).toBe(slots.body);
    expect(screen.getByText("Foot").className).toBe(slots.footer);
  });

  it("renders children inside each part", () => {
    renderCard({}, [
      cardPart(Card.Header, "header", "Header content"),
      cardPart(Card.Body, "body", "Body content"),
      cardPart(Card.Footer, "footer", "Footer content"),
    ]);
    expect(screen.getByText("Header content")).toBeDefined();
    expect(screen.getByText("Body content")).toBeDefined();
    expect(screen.getByText("Footer content")).toBeDefined();
  });
});

// G6 (the "use client" boundary assertion) moved to __tests__/emit-gates.test.ts, where it is
// now one registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through plain functions typed as `CardProps` / `CardPartProps` (rather than a direct
// call to `createElement`) so the excess-property/type checks below still apply to a fresh object
// literal, without tripping Biome's `noChildrenProp` rule on a raw `createElement` call.
function cardElement(props: CardProps) {
  return createElement(Card, props);
}
function headerElement(props: CardPartProps) {
  return createElement(Card.Header, props);
}
function bodyElement(props: CardPartProps) {
  return createElement(Card.Body, props);
}
function footerElement(props: CardPartProps) {
  return createElement(Card.Footer, props);
}

describe("Card public API surface (type-level)", () => {
  it("rejects className, style and unknown surface/shadow values on Card at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the
    // typecheck the moment its error disappears. What runs here is the
    // runtime half of the contract — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      cardElement({ className: "x", children: "x" }),
      // @ts-expect-error style is not part of the public API
      cardElement({ style: {}, children: "x" }),
      // @ts-expect-error unknown surface value
      cardElement({ surface: "nope", children: "x" }),
      // @ts-expect-error unknown shadow value
      cardElement({ shadow: "nope", children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  it("rejects className and style on Card.Header at compile time", () => {
    const constructed = [
      // @ts-expect-error className is not part of the public API
      headerElement({ className: "x", children: "x" }),
      // @ts-expect-error style is not part of the public API
      headerElement({ style: {}, children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  it("rejects className and style on Card.Body at compile time", () => {
    const constructed = [
      // @ts-expect-error className is not part of the public API
      bodyElement({ className: "x", children: "x" }),
      // @ts-expect-error style is not part of the public API
      bodyElement({ style: {}, children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  it("rejects className and style on Card.Footer at compile time", () => {
    const constructed = [
      // @ts-expect-error className is not part of the public API
      footerElement({ className: "x", children: "x" }),
      // @ts-expect-error style is not part of the public API
      footerElement({ style: {}, children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

// Panda emits a variant rule only for the slots that variant value actually styles — `surface`
// and `shadow` both style `root` alone here, so the emitted set is 4 base slot rules + 3 root
// variant rules, NOT 4 slots x 3 values. See `slot-recipe-class.ts` for the measured rule this
// pins.
//
// `shadow` contributes exactly ONE rule, not two. It is a single-value axis (`card`) rather than
// `none | card` on purpose: two single-class selectors of equal specificity would leave which one
// wins to Panda's source order, which is not a contract this package is willing to depend on.
// Absence of the class IS the "no shadow" state.
describe("the emitted CSS has exactly the base + root-variant rules Card owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits all 4 base slot rules and exactly 3 root variant rules", () => {
    const required = emittedSlotClassNames(cardRecipe);
    expect(required).toEqual([
      "zui-card__root",
      "zui-card__header",
      "zui-card__body",
      "zui-card__footer",
      "zui-card__root--surface_elevated",
      "zui-card__root--surface_outlined",
      "zui-card__root--shadow_card",
    ]);
    for (const className of required) {
      expect({ [className]: hasRule(className) }).toEqual({ [className]: true });
    }
  });

  it("never emits a surface or shadow variant class for header, body or footer", () => {
    expect(hasRule("zui-card__header--surface_elevated")).toBe(false);
    expect(hasRule("zui-card__header--surface_outlined")).toBe(false);
    expect(hasRule("zui-card__body--surface_elevated")).toBe(false);
    expect(hasRule("zui-card__body--surface_outlined")).toBe(false);
    expect(hasRule("zui-card__footer--surface_elevated")).toBe(false);
    expect(hasRule("zui-card__footer--surface_outlined")).toBe(false);
    expect(hasRule("zui-card__header--shadow_card")).toBe(false);
    expect(hasRule("zui-card__body--shadow_card")).toBe(false);
    expect(hasRule("zui-card__footer--shadow_card")).toBe(false);
  });

  // The combination ADR-0021 E1 could not express, asserted on the shipped stylesheet rather than
  // on the recipe object: the boundary and the elevation are declared by two different rules, so
  // a card can carry both at once.
  //
  // READ THROUGH `declarationBodies` AND NOT `ruleBody`, AND THE PREDICATE SHAPE IS THE WHOLE
  // POINT. Two failure modes pull in opposite directions and the predicate has to beat both.
  //
  //   * `ruleBody` matches the exact rule head `.<class> {`, so it returns "" for any rule the
  //     emitter folded into a comma-separated selector list — and `--surface_elevated` and
  //     `--shadow_card` now declare the BYTE-IDENTICAL `box-shadow`, which is exactly the shape an
  //     optimiser folds. This change's own argument is that Panda's emission layout is not a
  //     contract, so a test of it must not quietly depend on that layout either.
  //   * A bare `selector.includes()` beats the fold but opens a prefix hole: it would also match a
  //     future sibling value whose class EXTENDS this one (`--shadow_cardLg`), fold that rule's
  //     body into the result, and keep passing while the real rule was broken or gone.
  //
  // So the predicate splits the head on commas and compares each part for EQUALITY. That survives
  // the fold (a part still matches exactly inside a list) and closes the prefix hole (equality
  // never matches an extension). Measured on all seven shapes that matter, including
  // `--shadow_cardLg` -> false and a state variant `--shadow_card:hover` -> false.
  //
  // The match count is pinned at exactly 1 rather than merely non-empty, and the body is read
  // positionally rather than joined: a joined string would let the assertion pass on a SIBLING
  // rule's declaration when this one's had gone. The body is also asserted to contain no `{`,
  // because `declarationBodies` slices to the first closing brace and would silently hand back a
  // truncated read if either rule ever grew a nested block — that turns the truncation into a
  // loud failure instead of a quiet pass on a partial slice.
  const rootRuleBodies = (className: string) =>
    declarationBodies(css, (head) =>
      head.split(",").some((part) => part.trim() === `.${className}`),
    );

  it("declares the boundary and the elevation in two separate root rules", () => {
    const outlined = rootRuleBodies("zui-card__root--surface_outlined");
    const shadow = rootRuleBodies("zui-card__root--shadow_card");
    expect(outlined).toHaveLength(1);
    expect(shadow).toHaveLength(1);
    expect(outlined[0]).toContain("var(--zuip-colors-border-default)");
    expect(shadow[0]).toContain("var(--zuip-shadows-card)");
    expect(outlined[0]).not.toContain("{");
    expect(shadow[0]).not.toContain("{");
  });
});
