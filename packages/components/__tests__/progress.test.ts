// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as checkbox.test.ts: the file stays
// `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Progress } from "../src/progress/Progress.js";
import { progressRecipe } from "../src/progress/progress.recipe.js";
import type { ProgressProps } from "../src/progress/progress.types.js";
import { ancestorStateSelectors, emittedStylesheet, selectorParts } from "./support/emitted-css.js";

afterEach(() => {
  cleanup();
});

const renderProgress = (props: ProgressProps) => render(createElement(Progress, props));

/** A slot's structural hook — the base class, without any variant derivative. */
const baseClass = (slot: keyof ReturnType<typeof slotRecipeClassNames<typeof progressRecipe>>) =>
  slotRecipeClassNames(progressRecipe, {})[slot].split(" ")[0];

const slotElement = (slot: Parameters<typeof baseClass>[0]) =>
  document.querySelector(`.${baseClass(slot)}`);

describe("Progress", () => {
  it("renders a progressbar whose accessible name comes from the label prop", () => {
    renderProgress({ label: "Uploading", value: 62 });
    expect(screen.getByRole("progressbar", { name: "Uploading" })).not.toBeNull();
  });

  // Measured against react-aria-components 1.20's ProgressBar, not assumed: it provides
  // `LabelContext` with `elementType: 'span'`, and react-aria's own `useProgressBar` passes
  // `labelElementType: 'span'` for the stated reason that "Progress bar is not an HTML input
  // element so it shouldn't be labeled by a <label> element". A real <label> here would point at
  // no form control at all, so this is a correctness property rather than a markup preference.
  it("renders its label as a span, never a <label> pointing at no control", () => {
    renderProgress({ label: "Uploading", value: 62 });
    expect(slotElement("label")?.tagName).toBe("SPAN");
    expect(document.querySelector("label")).toBeNull();
  });

  it("publishes the determinate value through the ARIA value attributes", () => {
    renderProgress({ label: "Uploading", value: 62 });
    const bar = screen.getByRole("progressbar", { name: "Uploading" });
    expect(bar.getAttribute("aria-valuenow")).toBe("62");
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuetext")).toBe("62%");
  });

  // The one attribute that distinguishes the two states, and the reason `Progress.tsx` can stamp
  // `data-indeterminate` from the render prop rather than inventing a state of its own: RAC's
  // documented selector for `isIndeterminate` is `:not([aria-valuenow])`.
  it("omits aria-valuenow and aria-valuetext while indeterminate, and keeps min/max", () => {
    renderProgress({ label: "Syncing", isIndeterminate: true });
    const bar = screen.getByRole("progressbar", { name: "Syncing" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.hasAttribute("aria-valuetext")).toBe(false);
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  it("scales the value against a custom minValue/maxValue range", () => {
    renderProgress({ label: "Steps", value: 5, minValue: 0, maxValue: 10 });
    const bar = screen.getByRole("progressbar", { name: "Steps" });
    expect(bar.getAttribute("aria-valuenow")).toBe("5");
    expect(bar.getAttribute("aria-valuemax")).toBe("10");
    expect(bar.getAttribute("aria-valuetext")).toBe("50%");
    expect((slotElement("fill") as HTMLElement | null)?.style.inlineSize).toBe("50%");
  });

  // Clamping is RAC's, not this component's — asserted because the fill width is derived from the
  // same percentage, so a value past the ceiling must not paint a bar wider than its track.
  it("clamps a value above maxValue instead of overflowing the track", () => {
    renderProgress({ label: "Uploading", value: 150 });
    const bar = screen.getByRole("progressbar", { name: "Uploading" });
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect((slotElement("fill") as HTMLElement | null)?.style.inlineSize).toBe("100%");
  });

  it("honours formatOptions when formatting the value text", () => {
    renderProgress({
      label: "Steps",
      value: 5,
      maxValue: 10,
      formatOptions: { style: "decimal" },
    });
    expect(screen.getByRole("progressbar", { name: "Steps" }).getAttribute("aria-valuetext")).toBe(
      "5",
    );
  });

  it("lets valueLabel replace the formatted text, in the DOM and in aria-valuetext", () => {
    renderProgress({ label: "Steps", value: 5, maxValue: 10, valueLabel: "5 of 10" });
    expect(screen.getByRole("progressbar", { name: "Steps" }).getAttribute("aria-valuetext")).toBe(
      "5 of 10",
    );
    expect(slotElement("valueText")?.textContent).toBe("5 of 10");
  });

  // THE FILL WIDTH IS THE ONE THING A STATIC STYLESHEET CANNOT EXPRESS. Every other component in
  // this package renders class names only; a percentage that changes at runtime has no class to
  // hang off, so this is the package's first inline style. It is deliberately the ONLY
  // declaration in it — everything else about the fill is in the recipe.
  it("drives the fill width from the percentage, as its only inline declaration", () => {
    renderProgress({ label: "Uploading", value: 62 });
    const fill = slotElement("fill") as HTMLElement | null;
    expect(fill?.style.inlineSize).toBe("62%");
    expect(fill?.style.length).toBe(1);
  });

  it("carries no inline width while indeterminate, where there is no percentage to render", () => {
    renderProgress({ label: "Syncing", isIndeterminate: true });
    const fill = slotElement("fill") as HTMLElement | null;
    expect(fill?.style.inlineSize).toBe("");
    expect(fill?.style.length).toBe(0);
  });

  // Stamped locally rather than read off the root through a descendant selector, for the reason
  // checkbox.recipe.ts argues at length: an unqualified `[data-indeterminate] .zui-progress__fill`
  // would match ANY ancestor carrying that attribute.
  it("stamps data-indeterminate on the fill, and only while indeterminate", () => {
    renderProgress({ label: "Syncing", isIndeterminate: true });
    expect(slotElement("fill")?.getAttribute("data-indeterminate")).toBe("true");

    cleanup();
    renderProgress({ label: "Uploading", value: 62 });
    expect(slotElement("fill")?.hasAttribute("data-indeterminate")).toBe(false);
  });

  // The fill is the only part that repaints between the two states, so it is the only part that
  // gets the flag. An attribute no rule reads is markup shipped for nobody, and the track's
  // appearance is identical either way.
  it("leaves the track free of a state attribute no rule reads", () => {
    renderProgress({ label: "Syncing", isIndeterminate: true });
    expect(slotElement("track")?.hasAttribute("data-indeterminate")).toBe(false);
  });

  it("renders no value text at all while indeterminate", () => {
    renderProgress({ label: "Syncing", isIndeterminate: true });
    expect(slotElement("valueText")).toBeNull();
  });

  // The progressbar role already announces the value through aria-valuetext. The visible copy of
  // that same text, and the track drawing it, are decoration: exposing them would announce the
  // value twice. Same argument as Checkbox's decorative box.
  it("hides the track and the visible value text from assistive tech", () => {
    renderProgress({ label: "Uploading", value: 62 });
    expect(slotElement("track")?.getAttribute("aria-hidden")).toBe("true");
    expect(slotElement("valueText")?.getAttribute("aria-hidden")).toBe("true");
    // The label is NOT hidden: aria-labelledby points at it, and it is the visible name.
    expect(slotElement("label")?.hasAttribute("aria-hidden")).toBe(false);
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  });

  it("applies exactly the default slot classes with no size prop", () => {
    renderProgress({ label: "Uploading", value: 62 });
    const expected = slotRecipeClassNames(progressRecipe, {});
    expect(screen.getByRole("progressbar", { name: "Uploading" }).className).toBe(expected.root);
    expect(slotElement("header")?.className).toBe(expected.header);
    expect(slotElement("label")?.className).toBe(expected.label);
    expect(slotElement("valueText")?.className).toBe(expected.valueText);
    expect(slotElement("track")?.className).toBe(expected.track);
    expect(slotElement("fill")?.className).toBe(expected.fill);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderProgress({ label: "Uploading", value: 62, size: "lg" });
    const expected = slotRecipeClassNames(progressRecipe, { size: "lg" });
    expect(slotElement("track")?.className).toBe(expected.track);
    // `size` styles the `track` only, so no other slot may pick a size class up.
    expect(expected.track).toMatch(/--size_lg/);
    for (const slot of ["root", "header", "label", "valueText", "fill"] as const) {
      expect(expected[slot]).not.toMatch(/--size_/);
    }
  });

  // react-aria-components stamps its own `react-aria-*` class on any part rendered without an
  // explicit className. Those would become a public styling hook the design system never agreed
  // to expose, so every slot passes one.
  it("never ships react-aria's default class names", () => {
    renderProgress({ label: "Uploading", value: 62 });
    for (const element of document.querySelectorAll("*")) {
      expect(element.getAttribute("class") ?? "").not.toMatch(/react-aria-/);
    }
  });
});

// Routed through a plain function typed as `ProgressProps` (rather than a direct call to
// `createElement`) so the excess-property/type checks below apply to a fresh object literal.
function progressElement(props: ProgressProps) {
  return createElement(Progress, props);
}

describe("Progress public API surface (type-level)", () => {
  it("rejects className, style, an unknown size, and a missing label at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half of the contract — a rejected prop
    // still constructs a valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      progressElement({ label: "Uploading", className: "x" }),
      // @ts-expect-error style is not part of the public API
      progressElement({ label: "Uploading", style: {} }),
      // @ts-expect-error unknown size value
      progressElement({ label: "Uploading", size: "xl" }),
      // @ts-expect-error label is required, not optional
      progressElement({ value: 62 } as Omit<ProgressProps, "label">),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

describe("the emitted CSS Progress owes", () => {
  const css = emittedStylesheet();
  const heads = selectorParts(css);
  const hasRule = (className: string): boolean => {
    const pattern = classSelectorPattern(className);
    return heads.some((head) => pattern.test(head));
  };

  it("emits a rule for every slot the recipe declares base styles for", () => {
    for (const slot of progressRecipe.slots) {
      expect({ [slot]: hasRule(`zui-progress__${slot}`) }).toEqual({ [slot]: true });
    }
  });

  it("emits the size rules on the track slot only", () => {
    for (const size of Object.keys(progressRecipe.variants.size)) {
      expect({ [size]: hasRule(`zui-progress__track--size_${size}`) }).toEqual({ [size]: true });
      expect(hasRule(`zui-progress__root--size_${size}`)).toBe(false);
      expect(hasRule(`zui-progress__fill--size_${size}`)).toBe(false);
    }
  });

  // The cascade guard every stateful component in this package owes: a state attribute must be
  // attached directly to one of Progress's own classes, never left bare where any ancestor
  // carrying it would match.
  it("never lets an ancestor's state attribute paint one of its parts", () => {
    expect(ancestorStateSelectors(css, "zui-progress")).toEqual([]);
  });

  // The indeterminate motion is the package's first @keyframes animation. It must be reachable
  // (some rule references it) and it must be cancelled under prefers-reduced-motion, which is
  // what makes the visual baselines deterministic: the Playwright context pins
  // `reducedMotion: "reduce"` for every capture.
  it("declares the indeterminate keyframes and runs them from the fill", () => {
    expect(css).toMatch(/@keyframes\s+zui-progress-indeterminate\s*\{/);
    expect(css).toMatch(/animation-name:\s*zui-progress-indeterminate/);
  });

  it("cancels the sweep inside a prefers-reduced-motion block, not merely somewhere", () => {
    // Brace-matched rather than substring-sliced: `animation-name: none` sitting anywhere in the
    // sheet would satisfy a looser check while the rule actually lived outside the media query,
    // which is the exact defect this asserts against — and it would also make every visual
    // baseline non-deterministic, since the Playwright context pins `reducedMotion: "reduce"`.
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
      (block) =>
        block.includes(".zui-progress__fill[data-indeterminate]") &&
        /animation-name:\s*none/.test(block),
    );
    expect(cancelling.length).toBeGreaterThan(0);
  });
});
