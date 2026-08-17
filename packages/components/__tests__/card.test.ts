// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin (`@vitejs/plugin-react` is not a
// dependency here, and adding it just for tests would be an extra build-pipeline dependency).
// `React.createElement` gives the exact same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on, without that extra dependency.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "../src/card/Card.js";
import { cardRecipe } from "../src/card/card.recipe.js";
import type { CardPartProps, CardProps } from "../src/card/card.types.js";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { emittedSlotClassNames, slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(packageRoot, "dist", "styles.css"), "utf8");

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

describe('G6: the emitted Card module does NOT ship the "use client" directive', () => {
  it("does not start dist/card/Card.js with the client boundary directive", () => {
    const built = readFileSync(join(packageRoot, "dist", "card", "Card.js"), "utf8");
    expect(built.startsWith('"use client"')).toBe(false);
  });
});

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
  it("rejects className, style and unknown surface values on Card at compile time", () => {
    // @ts-expect-error className is not part of the public API
    cardElement({ className: "x", children: "x" });
    // @ts-expect-error style is not part of the public API
    cardElement({ style: {}, children: "x" });
    // @ts-expect-error unknown surface value
    cardElement({ surface: "nope", children: "x" });
  });

  it("rejects className and style on Card.Header at compile time", () => {
    // @ts-expect-error className is not part of the public API
    headerElement({ className: "x", children: "x" });
    // @ts-expect-error style is not part of the public API
    headerElement({ style: {}, children: "x" });
  });

  it("rejects className and style on Card.Body at compile time", () => {
    // @ts-expect-error className is not part of the public API
    bodyElement({ className: "x", children: "x" });
    // @ts-expect-error style is not part of the public API
    bodyElement({ style: {}, children: "x" });
  });

  it("rejects className and style on Card.Footer at compile time", () => {
    // @ts-expect-error className is not part of the public API
    footerElement({ className: "x", children: "x" });
    // @ts-expect-error style is not part of the public API
    footerElement({ style: {}, children: "x" });
  });
});

// Panda emits a variant rule only for the slots that variant value actually styles — `surface`
// styles `root` alone here, so the emitted set is 4 base slot rules + 2 root variant rules, NOT
// 4 slots x 2 values. See `slot-recipe-class.ts` for the measured rule this pins.
describe("the emitted CSS has exactly the base + root-variant rules Card owes", () => {
  const hasRule = (className: string): boolean => {
    const pattern = classSelectorPattern(className);
    return [...css.matchAll(/([^{}]*)\{/g)].some((match) => pattern.test(match[1]));
  };

  it("emits all 4 base slot rules and exactly 2 root variant rules", () => {
    const required = emittedSlotClassNames(cardRecipe);
    expect(required).toEqual([
      "zui-card__root",
      "zui-card__header",
      "zui-card__body",
      "zui-card__footer",
      "zui-card__root--surface_elevated",
      "zui-card__root--surface_outlined",
    ]);
    for (const className of required) {
      expect({ [className]: hasRule(className) }).toEqual({ [className]: true });
    }
  });

  it("never emits a surface variant class for header, body or footer", () => {
    expect(hasRule("zui-card__header--surface_elevated")).toBe(false);
    expect(hasRule("zui-card__header--surface_outlined")).toBe(false);
    expect(hasRule("zui-card__body--surface_elevated")).toBe(false);
    expect(hasRule("zui-card__body--surface_outlined")).toBe(false);
    expect(hasRule("zui-card__footer--surface_elevated")).toBe(false);
    expect(hasRule("zui-card__footer--surface_outlined")).toBe(false);
  });
});
