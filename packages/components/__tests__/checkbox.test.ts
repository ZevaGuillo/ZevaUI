// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as input.test.ts: the file stays
// `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Checkbox } from "../src/checkbox/Checkbox.js";
import { checkboxRecipe } from "../src/checkbox/checkbox.recipe.js";
import type { CheckboxProps } from "../src/checkbox/checkbox.types.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { emittedStylesheet } from "./support/emitted-css.js";

afterEach(() => {
  cleanup();
});

const renderCheckbox = (props: CheckboxProps) => render(createElement(Checkbox, props));

/** The decorative box, which is `aria-hidden` and therefore unreachable by role. */
const controlBox = () =>
  document.querySelector(`.${slotRecipeClassNames(checkboxRecipe, {}).control.split(" ")[0]}`);

describe("Checkbox", () => {
  it("renders a checkbox whose accessible name comes from its children", () => {
    renderCheckbox({ children: "Accept terms" });
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });
    expect(checkbox.tagName).toBe("INPUT");
    expect(checkbox.getAttribute("type")).toBe("checkbox");
  });

  it("associates the label with the input, so clicking the text toggles the control", async () => {
    const user = userEvent.setup();
    renderCheckbox({ children: "Accept terms" });
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" }) as HTMLInputElement;

    await user.click(screen.getByText("Accept terms"));

    expect(checkbox.checked).toBe(true);
  });

  it("applies exactly the default slot classes with no props", () => {
    renderCheckbox({ children: "Accept terms" });
    const expected = slotRecipeClassNames(checkboxRecipe, {});
    const root = document.querySelector("label");
    expect(root?.className).toBe(expected.root);
    expect(controlBox()?.className).toBe(expected.control);
    expect(document.querySelector("svg")?.getAttribute("class")).toBe(expected.indicator);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderCheckbox({ children: "Accept terms", size: "lg" });
    const expected = slotRecipeClassNames(checkboxRecipe, { size: "lg" });
    expect(document.querySelector("label")?.className).toBe(expected.root);
    expect(controlBox()?.className).toBe(expected.control);
    // `size` styles only `root` and `control`, so the indicator and label must NOT pick one up.
    expect(document.querySelector("svg")?.getAttribute("class")).toBe(expected.indicator);
    expect(expected.indicator).not.toMatch(/--size_/);
    expect(expected.label).not.toMatch(/--size_/);
  });

  // react-aria-components stamps its own `react-aria-*` class on any part rendered without an
  // explicit className. Those would become a public styling hook the design system never agreed
  // to expose, so every slot passes one. Measured against RAC's real output, not assumed.
  it("never ships react-aria's default class names", () => {
    renderCheckbox({ children: "Accept terms", isSelected: true, isInvalid: true });
    for (const element of document.querySelectorAll("*")) {
      // SVG elements carry an SVGAnimatedString, not a string, so the attribute is read directly.
      expect(element.getAttribute("class") ?? "").not.toMatch(/react-aria-/);
    }
  });

  it("hides the decorative box from assistive tech so the control announces once", () => {
    renderCheckbox({ children: "Accept terms" });
    expect(controlBox()?.getAttribute("aria-hidden")).toBe("true");
    // One checkbox, not two: the box must not have become a second reachable control.
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("reports the new value through onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderCheckbox({ children: "Accept terms", onChange });

    await user.click(screen.getByRole("checkbox", { name: "Accept terms" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("does not fire onChange while disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderCheckbox({ children: "Accept terms", isDisabled: true, onChange });

    await user.click(screen.getByRole("checkbox", { name: "Accept terms" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not change value while read-only", async () => {
    const user = userEvent.setup();
    renderCheckbox({ children: "Accept terms", isReadOnly: true });
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" }) as HTMLInputElement;

    await user.click(checkbox);

    expect(checkbox.checked).toBe(false);
  });

  it("renders a controlled selected value", () => {
    renderCheckbox({ children: "Accept terms", isSelected: true, onChange: () => {} });
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it("marks a required control so assistive tech can announce it", () => {
    renderCheckbox({ children: "Accept terms", isRequired: true });
    expect(document.querySelector("input")?.hasAttribute("required")).toBe(true);
  });

  it("marks an invalid control through aria-invalid, not colour alone", () => {
    renderCheckbox({ children: "Accept terms", isInvalid: true });
    expect(
      screen.getByRole("checkbox", { name: "Accept terms" }).getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("takes keyboard focus, which is what the focus-visible outline hangs off", async () => {
    const user = userEvent.setup();
    renderCheckbox({ children: "Accept terms" });
    const checkbox = screen.getByRole("checkbox", { name: "Accept terms" });

    await user.tab();

    // `document.activeElement` rather than jest-dom's `toHaveFocus`: this package deliberately
    // does not depend on @testing-library/jest-dom.
    expect(document.activeElement).toBe(checkbox);
    expect(controlBox()?.getAttribute("data-focus-visible")).toBe("true");
  });
});

// The third state is a real behaviour, not a styling flag, so it gets its own block.
describe("Checkbox indeterminate state", () => {
  // Asserted on the NATIVE `indeterminate` DOM property, not on `aria-checked`, and that is what
  // RAC actually does — measured, after an assertion against `aria-checked="mixed"` failed here.
  // A native checkbox whose `indeterminate` property is set is announced as "mixed" by assistive
  // tech on its own; RAC sets no `aria-checked` at all, and adding one would be redundant ARIA
  // over a native control.
  it("puts the control in the native mixed state", () => {
    renderCheckbox({ children: "Select all", isIndeterminate: true });
    const checkbox = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement;

    expect(checkbox.indeterminate).toBe(true);
    expect(checkbox.getAttribute("aria-checked")).toBeNull();
  });

  // The ordering bug this pins is real rather than hypothetical, and the measurement is specific:
  // with BOTH flags set, RAC renders `checked === true` AND `indeterminate === true`. So a
  // component that tested `isSelected` first would draw a tick on a control that assistive tech
  // announces as "mixed". The dash and the tick are different paths, so comparing them catches
  // the swap.
  it("draws the dash, not the tick, while indeterminate and selected at once", () => {
    renderCheckbox({
      children: "Select all",
      isIndeterminate: true,
      isSelected: true,
      onChange: () => {},
    });
    const checkbox = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement;
    // Pins the premise, so this test cannot quietly become vacuous if RAC changes that behaviour.
    expect(checkbox.checked).toBe(true);
    expect(checkbox.indeterminate).toBe(true);
    const indeterminatePath = document.querySelector("svg path")?.getAttribute("d");

    cleanup();
    renderCheckbox({ children: "Select all", isSelected: true, onChange: () => {} });
    const selectedPath = document.querySelector("svg path")?.getAttribute("d");

    expect(indeterminatePath).toBeTruthy();
    expect(selectedPath).toBeTruthy();
    expect(indeterminatePath).not.toBe(selectedPath);
  });

  it("draws no glyph at all while neither selected nor indeterminate", () => {
    renderCheckbox({ children: "Accept terms" });
    expect(document.querySelector("svg path")).toBeNull();
  });
});

// The state attributes on the decorative box are not cosmetic duplication: they are what every
// `&[data-*]` rule in the recipe hangs off. Reading the root's state through a descendant
// selector instead would emit an UNQUALIFIED `[data-hovered] .zui-checkbox__control`, which any
// hovered ancestor matches — a Menu row, a Card — lighting every checkbox inside it with no
// pointer near it. These assertions are the guard on that decision.
describe("Checkbox state attributes are stamped on the box the recipe styles", () => {
  it("mirrors selected and indeterminate onto the box", () => {
    renderCheckbox({ children: "Select all", isIndeterminate: true });
    expect(controlBox()?.getAttribute("data-indeterminate")).toBe("true");

    cleanup();
    renderCheckbox({ children: "Accept terms", isSelected: true, onChange: () => {} });
    expect(controlBox()?.getAttribute("data-selected")).toBe("true");
  });

  it("mirrors disabled and invalid onto the box", () => {
    renderCheckbox({ children: "Accept terms", isDisabled: true, isInvalid: true });
    expect(controlBox()?.getAttribute("data-disabled")).toBe("true");
    expect(controlBox()?.getAttribute("data-invalid")).toBe("true");
  });

  it("omits an unset state entirely rather than rendering it false", () => {
    renderCheckbox({ children: "Accept terms" });
    const box = controlBox();
    expect(box?.hasAttribute("data-selected")).toBe(false);
    expect(box?.hasAttribute("data-indeterminate")).toBe(false);
    expect(box?.hasAttribute("data-invalid")).toBe(false);
  });

  // The hover tint must never outrank the invalid border. Found by the review, not by me, and it
  // was real: `[data-hovered]:not([data-disabled])` scores (0,3,0) against `[data-invalid]`'s
  // (0,2,0) — a `:not()` argument carries its own weight — so an invalid checkbox lost its red
  // border the moment the pointer touched it, which is the one moment the user is looking at it.
  //
  // This is the cheap local guard on the emitted selector. The rendered consequence is asserted
  // in a real browser by the `HoveringAnInvalidCheckboxKeepsItRed` story, for the same
  // two-altitude reason G1 and the ThemeContract story split that work: the selector is the
  // input, the painted border is what a user sees.
  it("never lets the hover tint outrank the invalid border", () => {
    const css = emittedStylesheet();
    const hoverSelectors = [...css.matchAll(/([^{}]*)\{/g)]
      .flatMap((match) => match[1].split(","))
      .map((selector) => selector.trim())
      .filter(
        (selector) =>
          selector.includes("zui-checkbox__control") && selector.includes("[data-hovered]"),
      );

    expect(hoverSelectors.length).toBeGreaterThan(0);
    for (const selector of hoverSelectors) {
      expect({ selector, excludesInvalid: selector.includes(":not([data-invalid])") }).toEqual({
        selector,
        excludesInvalid: true,
      });
    }
  });

  it("emits no rule that could reach a checkbox from an ancestor's state", () => {
    const css = emittedStylesheet();
    // Every checkbox rule that mentions a state attribute must qualify it with the control's own
    // class. A bare `[data-selected] .zui-checkbox__control` is exactly the regression.
    const checkboxRules = [...css.matchAll(/([^{}]*)\{/g)]
      .map((match) => match[1].trim())
      .filter((selector) => selector.includes("zui-checkbox"));

    expect(checkboxRules.length).toBeGreaterThan(0);
    for (const selector of checkboxRules) {
      for (const part of selector.split(",")) {
        // Any state attribute in the selector must be attached directly to a zui-checkbox class,
        // never standing alone as an ancestor condition.
        expect(part.trim()).not.toMatch(/(^|\s)\[data-[a-z-]+\]/);
      }
    }
  });
});

// G6 (the "use client" boundary assertion) lives in __tests__/emit-gates.test.ts, where it is one
// registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `CheckboxProps` so the excess-property checks below
// apply to a fresh object literal.
function checkboxElement(props: CheckboxProps) {
  return createElement(Checkbox, props);
}

describe("Checkbox public API surface (type-level)", () => {
  it("rejects className, style, unknown variant values and a missing label at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half of the contract — a rejected prop
    // still constructs a valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      checkboxElement({ children: "Accept", className: "x" }),
      // @ts-expect-error style is not part of the public API
      checkboxElement({ children: "Accept", style: {} }),
      // @ts-expect-error unknown size value
      checkboxElement({ children: "Accept", size: "nope" }),
      // @ts-expect-error an unlabelled control is not constructible
      checkboxElement({}),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
