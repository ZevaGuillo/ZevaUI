// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "../src/button/Button.js";
import type { ButtonProps } from "../src/button/button.types.js";
import { recipeClassName } from "../src/internal/recipe-class.js";
import { Tooltip } from "../src/tooltip/Tooltip.js";
import { tooltipRecipe } from "../src/tooltip/tooltip.recipe.js";
import type { TooltipProps } from "../src/tooltip/tooltip.types.js";
import {
  declarationBodies,
  emittedStylesheet,
  styledClassPredicate,
} from "./support/emitted-css.js";

const css = emittedStylesheet();

afterEach(() => {
  cleanup();
});

// Routed through a plain function typed as `ButtonProps` rather than a direct `createElement`
// call with a `children` key, for the reason `badge.test.ts` documents: Biome's `noChildrenProp`
// rule fires on the raw call, and `ButtonProps.children` is required so the third-argument
// spelling will not type-check either.
const buttonElement = (props: ButtonProps) => createElement(Button, props);
const trigger = (label = "Archive") => buttonElement({ children: label });

function renderTooltip(props: Partial<TooltipProps> = {}) {
  return render(
    createElement(Tooltip, {
      content: "Moves the project out of your active list",
      children: trigger(),
      ...props,
    } as TooltipProps),
  );
}

describe("Tooltip", () => {
  it("renders the trigger it was handed, untouched", () => {
    renderTooltip();
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
  });

  // A bubble that is in the DOM while nothing is hovered or focused would be read by anyone
  // walking the page linearly, which is the opposite of what a tooltip is.
  it("puts nothing in the DOM until the trigger is focused or hovered", () => {
    const { container } = renderTooltip();
    expect(container.querySelector(".zui-tooltip")).toBeNull();
  });
});

/**
 * THE CONTRACT THIS WHOLE COMPONENT RESTS ON, asserted rather than described.
 *
 * react-aria points the trigger's `aria-describedby` at the bubble and never its
 * `aria-labelledby`. The consequence is the caller's obligation: an icon-only button still needs
 * its own `aria-label`, because a description is announced after the name, many screen-reader
 * configurations suppress descriptions entirely, and a tooltip does not exist at all on touch.
 *
 * These assertions exist so that a future react-aria which started contributing to the NAME would
 * fail here — loudly, with this comment attached — rather than silently making every icon button
 * in every consumer app look correctly labelled while being labelled by something a phone never
 * shows.
 */
describe("Tooltip describes the trigger and never names it", () => {
  it("shows the bubble on keyboard focus and wires aria-describedby to it", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();

    const bubble = await screen.findByRole("tooltip");
    expect(bubble.textContent).toBe("Moves the project out of your active list");

    const button = screen.getByRole("button", { name: "Archive" });
    expect(button.getAttribute("aria-describedby")).toBe(bubble.id);
  });

  it("leaves the trigger's accessible name to the trigger", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    await screen.findByRole("tooltip");

    // Still "Archive" — not "Archive Moves the project…", and not the tooltip's text alone.
    const button = screen.getByRole("button", { name: "Archive" });
    expect(button.hasAttribute("aria-labelledby")).toBe(false);
    expect(button.hasAttribute("aria-label")).toBe(false);
  });

  it("takes the bubble back out of the DOM when focus leaves", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    await screen.findByRole("tooltip");

    await user.tab();
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });
});

describe("Tooltip class contract", () => {
  it("renders exactly the base class, because the recipe declares no variants", async () => {
    const user = userEvent.setup();
    renderTooltip();

    await user.tab();
    const bubble = await screen.findByRole("tooltip");

    expect(bubble.className).toBe("zui-tooltip");
    expect(bubble.className).toBe(recipeClassName(tooltipRecipe, {}));
  });

  it("suppresses the bubble entirely when disabled, without unmounting the trigger", async () => {
    const user = userEvent.setup();
    renderTooltip({ isDisabled: true });

    await user.tab();

    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});

function tooltipElement(props: TooltipProps) {
  return createElement(Tooltip, props);
}

describe("Tooltip public API surface (type-level)", () => {
  it("rejects className, style, markup content and an unknown placement at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      tooltipElement({ className: "x", content: "x", children: trigger() }),
      // @ts-expect-error style is not part of the public API
      tooltipElement({ style: {}, content: "x", children: trigger() }),
      // @ts-expect-error content is a plain string: a tooltip holds a phrase, not markup
      tooltipElement({ content: createElement("b", null, "x"), children: trigger() }),
      // @ts-expect-error placement is narrowed to the four logical sides
      tooltipElement({ placement: "top left", content: "x", children: trigger() }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // The honest limit of the `children` type, asserted so nobody later "tightens" it to
  // `ReactElement<ButtonProps>` believing that buys enforcement: JSX produces `ReactElement<any>`,
  // which is assignable to any narrower element type, so the narrower annotation would reject
  // nothing while reading as though it did. What `ReactElement` DOES refuse is the set of mistakes
  // that silently produce a tooltip-less control.
  it("refuses a trigger that is not a single element", () => {
    const constructed = [
      // @ts-expect-error a bare string is not a focusable element
      tooltipElement({ content: "x", children: "Archive" }),
      // @ts-expect-error TooltipTrigger takes exactly one trigger
      tooltipElement({ content: "x", children: [trigger(), trigger()] }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

describe("the emitted CSS Tooltip owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits the base .zui-tooltip rule", () => {
    expect(hasRule("zui-tooltip")).toBe(true);
  });

  // The measured half of "no variants": Panda is handed an empty `staticCss` variant map for this
  // recipe, and the base rule still lands. If a future Panda stopped emitting it, this component
  // would ship unstyled with no other test noticing.
  it("emits no variant class for a recipe that declares no variants", () => {
    expect(css.match(/\.zui-tooltip--[a-z]+_/)).toBeNull();
  });

  /**
   * Every overlay in this package animates `transform` and never `opacity`, so that no ancestor
   * can dim the text inside one mid-transition and drop it below the ratio it was measured at.
   * Asserted against the emitted sheet rather than the recipe, because the sheet is what cascades.
   */
  it("never animates opacity", () => {
    const bodies = declarationBodies(css, (selector) => selector.includes(".zui-tooltip"));
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toMatch(/(^|[;\s])opacity\s*:/);
    }
  });

  /**
   * The bubble inverts, and `{color-text-inverse, color-bg-inverse}` is the ONE inverse text pair
   * `@zevaui/constraints` validates (contract.json), in all three themes. Painting it any other
   * way would either reuse the surface tokens — producing something indistinguishable from a
   * `Menu` the user cannot click — or open a contrast pair nothing checks.
   */
  it("paints the one inverse pair the contract validates", () => {
    const bodies = declarationBodies(css, (selector) => selector.trim() === ".zui-tooltip");
    expect(bodies.length).toBeGreaterThan(0);
    const body = bodies.join(";");
    expect(body).toMatch(/background-color:\s*var\(--zuip-colors-bg-inverse\)/);
    expect(body).toMatch(/color:\s*var\(--zuip-colors-text-inverse\)/);
  });
});
