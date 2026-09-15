// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as progress.test.ts: the file stays
// `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { componentRegistry, keyframesOf } from "../src/registry.js";
import { Spinner } from "../src/spinner/Spinner.js";
import { spinnerRecipe } from "../src/spinner/spinner.recipe.js";
import type { SpinnerProps } from "../src/spinner/spinner.types.js";
import { ancestorStateSelectors, emittedStylesheet, selectorParts } from "./support/emitted-css.js";

afterEach(() => {
  cleanup();
});

const renderSpinner = (props: SpinnerProps) => render(createElement(Spinner, props));

/** A slot's structural hook — the base class, without any variant derivative. */
const baseClass = (slot: keyof ReturnType<typeof slotRecipeClassNames<typeof spinnerRecipe>>) =>
  slotRecipeClassNames(spinnerRecipe, {})[slot].split(" ")[0];

const slotElement = (slot: Parameters<typeof baseClass>[0]) =>
  document.querySelector(`.${baseClass(slot)}`);

describe("Spinner", () => {
  it("renders a progressbar whose accessible name comes from the label prop", () => {
    renderSpinner({ label: "Loading" });
    expect(screen.getByRole("progressbar", { name: "Loading" })).not.toBeNull();
  });

  // THE PROPERTY THAT MAKES THIS A SPINNER RATHER THAN A PROGRESS BAR, and the one a future
  // refactor could break without any visual difference: react-aria-components publishes the
  // indeterminate state as the ABSENCE of `aria-valuenow`, which is what its own documented
  // `:not([aria-valuenow])` selector keys off. A spinner that grew a value would start claiming
  // progress it cannot know about.
  it("never publishes a value, because it never has one", () => {
    renderSpinner({ label: "Loading" });
    const bar = screen.getByRole("progressbar", { name: "Loading" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.hasAttribute("aria-valuetext")).toBe(false);
    // The bounds survive: RAC drops only the value, and a progressbar with no bounds at all would
    // be a different (and less well-supported) thing to announce.
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  // Measured against react-aria-components 1.20's ProgressBar, not assumed: it provides
  // `LabelContext` with `elementType: 'span'`, and react-aria's own `useProgressBar` passes
  // `labelElementType: 'span'` for the stated reason that "Progress bar is not an HTML input
  // element so it shouldn't be labeled by a <label> element". A real <label> here would point at
  // no form control at all, so this is a correctness property rather than a markup preference.
  it("renders its label as a span, never a <label> pointing at no control", () => {
    renderSpinner({ label: "Loading" });
    expect(slotElement("label")?.tagName).toBe("SPAN");
    expect(document.querySelector("label")).toBeNull();
  });

  // The whole reason hiding is a VARIANT rather than "don't render the label": the element is what
  // `aria-labelledby` points at. A spinner that dropped it to hide it would be an unnamed control,
  // which is the exact failure the required `label` prop exists to prevent — and nothing visual
  // would change, so nothing would notice.
  it("keeps the label in the document and as the accessible name while hidden", () => {
    renderSpinner({ label: "Loading", labelVisibility: "hidden" });
    const label = slotElement("label");
    expect(label?.textContent).toBe("Loading");
    expect(label?.hasAttribute("aria-hidden")).toBe(false);
    expect(screen.getByRole("progressbar", { name: "Loading" })).not.toBeNull();
  });

  it("hides the label by default, because a bare ring is the spinner people mean", () => {
    renderSpinner({ label: "Loading" });
    const expected = slotRecipeClassNames(spinnerRecipe, { labelVisibility: "hidden" });
    expect(slotElement("label")?.className).toBe(expected.label);
    expect(expected.label).toMatch(/--labelVisibility_hidden/);
  });

  // The visible branch declares no styles of its own — the base IS the visible state — so it must
  // render no variant class at all. A class matching no rule would be dead markup, which is the
  // defect `slotRecipeClassNames`' per-slot filter exists to avoid.
  it("drops every labelVisibility class when the label is visible", () => {
    renderSpinner({ label: "Loading", labelVisibility: "visible" });
    expect(slotElement("label")?.className).toBe(baseClass("label"));
    expect(slotElement("label")?.className).not.toMatch(/--labelVisibility_/);
  });

  // The ring is decoration: the role, the state and the name all live on the root. Exposing the
  // ring would describe the control twice. Same argument as Progress's track and Checkbox's
  // decorative box.
  it("hides the ring from assistive tech and announces the spinner exactly once", () => {
    renderSpinner({ label: "Loading" });
    expect(slotElement("indicator")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  });

  // The counterpart to progress.test.ts's "as its only inline declaration". Progress has to render
  // one inline style because a percentage has no class to hang off; a spinner has no runtime
  // number at all, so every single thing about it belongs to the stylesheet.
  it("renders no inline style anywhere, having no runtime number to express", () => {
    renderSpinner({ label: "Loading", size: "lg", labelVisibility: "visible" });
    for (const element of document.querySelectorAll("*")) {
      expect((element as HTMLElement).style.length).toBe(0);
    }
  });

  it("applies exactly the default slot classes with no size and no labelVisibility prop", () => {
    renderSpinner({ label: "Loading" });
    const expected = slotRecipeClassNames(spinnerRecipe, {});
    expect(screen.getByRole("progressbar", { name: "Loading" }).className).toBe(expected.root);
    expect(slotElement("indicator")?.className).toBe(expected.indicator);
    expect(slotElement("label")?.className).toBe(expected.label);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderSpinner({ label: "Loading", size: "lg" });
    const expected = slotRecipeClassNames(spinnerRecipe, { size: "lg" });
    expect(slotElement("indicator")?.className).toBe(expected.indicator);
    // `size` styles the `indicator` only, so no other slot may pick a size class up.
    expect(expected.indicator).toMatch(/--size_lg/);
    for (const slot of ["root", "label"] as const) {
      expect(expected[slot]).not.toMatch(/--size_/);
    }
  });

  // react-aria-components stamps its own `react-aria-*` class on any part rendered without an
  // explicit className. Those would become a public styling hook the design system never agreed
  // to expose, so every slot passes one.
  it("never ships react-aria's default class names", () => {
    renderSpinner({ label: "Loading" });
    for (const element of document.querySelectorAll("*")) {
      expect(element.getAttribute("class") ?? "").not.toMatch(/react-aria-/);
    }
  });
});

// Routed through a plain function typed as `SpinnerProps` (rather than a direct call to
// `createElement`) so the excess-property/type checks below apply to a fresh object literal.
function spinnerElement(props: SpinnerProps) {
  return createElement(Spinner, props);
}

describe("Spinner public API surface (type-level)", () => {
  it("rejects className, style, a value, and an unknown variant at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half of the contract — a rejected prop
    // still constructs a valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      spinnerElement({ label: "Loading", className: "x" }),
      // @ts-expect-error style is not part of the public API
      spinnerElement({ label: "Loading", style: {} }),
      // @ts-expect-error unknown size value
      spinnerElement({ label: "Loading", size: "xl" }),
      // @ts-expect-error unknown labelVisibility value
      spinnerElement({ label: "Loading", labelVisibility: "sr-only" }),
      // @ts-expect-error a spinner has no value: a caller who has one wants Progress
      spinnerElement({ label: "Loading", value: 62 }),
      // @ts-expect-error isIndeterminate is not a choice here; it is the whole component
      spinnerElement({ label: "Loading", isIndeterminate: false }),
      // @ts-expect-error label is required, not optional
      spinnerElement({} as Omit<SpinnerProps, "label">),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

// THE GUARD THAT COULD NOT EXIST UNTIL NOW. `panda.config.ts` merges every registry entry's
// keyframes into one map with `Object.assign`, so two components declaring the same animation
// name silently overwrite one another and the loser animates through the winner's frames. While
// `Progress` was the only entry with any keyframes at all, there was nothing to collide with.
// `Spinner` is the second, so the collision became reachable in the same change that adds this.
describe("the registry's keyframe names", () => {
  it("are unique across every registered component", () => {
    const owners = new Map<string, string[]>();
    for (const entry of componentRegistry) {
      for (const name of Object.keys(keyframesOf(entry))) {
        owners.set(name, [...(owners.get(name) ?? []), entry.name]);
      }
    }
    const collisions = [...owners].filter(([, declarers]) => declarers.length > 1);
    expect(collisions).toEqual([]);
  });

  it("covers more than one component, so the check above is not vacuous", () => {
    const declaring = componentRegistry.filter(
      (entry) => Object.keys(keyframesOf(entry)).length > 0,
    );
    expect(declaring.length).toBeGreaterThan(1);
  });
});

describe("the emitted CSS Spinner owes", () => {
  const css = emittedStylesheet();
  const heads = selectorParts(css);
  const hasRule = (className: string): boolean => {
    const pattern = classSelectorPattern(className);
    return heads.some((head) => pattern.test(head));
  };

  it("emits a rule for every slot the recipe declares base styles for", () => {
    for (const slot of spinnerRecipe.slots) {
      expect({ [slot]: hasRule(`zui-spinner__${slot}`) }).toEqual({ [slot]: true });
    }
  });

  it("emits the size rules on the indicator slot only", () => {
    for (const size of Object.keys(spinnerRecipe.variants.size)) {
      expect({ [size]: hasRule(`zui-spinner__indicator--size_${size}`) }).toEqual({ [size]: true });
      expect(hasRule(`zui-spinner__root--size_${size}`)).toBe(false);
      expect(hasRule(`zui-spinner__label--size_${size}`)).toBe(false);
    }
  });

  it("emits a rule for the hidden label and none for the visible one", () => {
    expect(hasRule("zui-spinner__label--labelVisibility_hidden")).toBe(true);
    // Nothing to emit: the base is already the visible state. A rule here would be bytes that
    // change nothing, and a class that matched it would be markup with no effect.
    expect(hasRule("zui-spinner__label--labelVisibility_visible")).toBe(false);
  });

  // The hidden label must stay in the accessibility tree. `display: none` and
  // `visibility: hidden` both remove it, and the element is the one `aria-labelledby` points at,
  // so either would silently unname the spinner while looking identical on screen.
  it("hides the label by clipping it, never by removing it from the accessibility tree", () => {
    const hiddenRules = heads.filter((head) =>
      classSelectorPattern("zui-spinner__label--labelVisibility_hidden").test(head),
    );
    expect(hiddenRules.length).toBeGreaterThan(0);

    for (const head of hiddenRules) {
      const body = css.slice(css.indexOf(head), css.indexOf("}", css.indexOf(head)));
      expect(body).not.toMatch(/display:\s*none/);
      expect(body).not.toMatch(/visibility:\s*hidden/);
    }
    expect(css).toMatch(/clip-path:\s*inset\(50%\)/);
  });

  // The cascade guard every stateful component in this package owes: a state attribute must be
  // attached directly to one of Spinner's own classes, never left bare where any ancestor
  // carrying it would match.
  it("never lets an ancestor's state attribute paint one of its parts", () => {
    expect(ancestorStateSelectors(css, "zui-spinner")).toEqual([]);
  });

  it("declares the rotation keyframes and runs them from the ring", () => {
    expect(css).toMatch(/@keyframes\s+zui-spinner-rotate\s*\{/);
    expect(css).toMatch(/animation-name:\s*zui-spinner-rotate/);
  });

  // Brace-matched rather than substring-sliced, for the reason progress.test.ts gives: an
  // `animation-name: none` sitting anywhere in the sheet would satisfy a looser check while the
  // rule actually lived outside the media query — and it would also make every visual baseline of
  // a spinner a coin flip, since the Playwright context pins `reducedMotion: "reduce"`.
  it("cancels the rotation inside a prefers-reduced-motion block, not merely somewhere", () => {
    const marker = "@media (prefers-reduced-motion: reduce)";
    const blocks: string[] = [];
    for (let from = css.indexOf(marker); from !== -1; from = css.indexOf(marker, from + 1)) {
      let depth = 0;
      for (let i = css.indexOf("{", from); i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        if (css[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            blocks.push(css.slice(from, i + 1));
            break;
          }
        }
      }
    }
    expect(blocks.length).toBeGreaterThan(0);
    const cancelling = blocks.filter(
      (block) => block.includes(".zui-spinner__indicator") && /animation-name:\s*none/.test(block),
    );
    expect(cancelling.length).toBeGreaterThan(0);
  });
});
