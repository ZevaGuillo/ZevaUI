// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as checkbox.test.ts and input.test.ts:
// the file stays `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Switch } from "../src/switch/Switch.js";
import { switchRecipe } from "../src/switch/switch.recipe.js";
import type { SwitchProps } from "../src/switch/switch.types.js";
import {
  ancestorStateSelectors,
  emittedStylesheet,
  hoverSelectorsFor,
  hoverSelectorsNotExcludingInvalid,
  selectorsMentioning,
} from "./support/emitted-css.js";

afterEach(() => {
  cleanup();
});

const renderSwitch = (props: SwitchProps) => render(createElement(Switch, props));

/** The first (structural) class of a slot, which is what the DOM query hangs off. */
const slotClass = (slot: keyof ReturnType<typeof slotRecipeClassNames>) =>
  slotRecipeClassNames(switchRecipe, {})[slot].split(" ")[0];

/** The decorative pill, which is `aria-hidden` and therefore unreachable by role. */
const track = () => document.querySelector(`.${slotClass("track")}`);

describe("Switch", () => {
  // The role is `switch`, not `checkbox`, and that is measured against RAC 1.20 rather than
  // assumed: the hidden input renders `role="switch" type="checkbox"`. It is what makes
  // assistive tech announce "on"/"off" instead of "checked", and it is half of why the moved
  // thumb is not a colour-only signal.
  it("renders a switch whose accessible name comes from its children", () => {
    renderSwitch({ children: "Enable notifications" });
    const control = screen.getByRole("switch", { name: "Enable notifications" });
    expect(control.tagName).toBe("INPUT");
    expect(control.getAttribute("type")).toBe("checkbox");
  });

  it("associates the label with the input, so clicking the text toggles the control", async () => {
    const user = userEvent.setup();
    renderSwitch({ children: "Enable notifications" });
    const control = screen.getByRole("switch", {
      name: "Enable notifications",
    }) as HTMLInputElement;

    await user.click(screen.getByText("Enable notifications"));

    expect(control.checked).toBe(true);
  });

  it("applies exactly the default slot classes with no props", () => {
    renderSwitch({ children: "Enable notifications" });
    const expected = slotRecipeClassNames(switchRecipe, {});
    // Queried by class, not by tag: Testing Library renders into a wrapper `<div>` of its own,
    // so `querySelector("div")` finds that container rather than the SwitchField.
    expect(document.querySelector(`.${slotClass("root")}`)?.className).toBe(expected.root);
    expect(document.querySelector("label")?.className).toBe(expected.control);
    expect(track()?.className).toBe(expected.track);
    expect(document.querySelector(`.${slotClass("thumb")}`)?.className).toBe(expected.thumb);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderSwitch({ children: "Enable notifications", size: "lg" });
    const expected = slotRecipeClassNames(switchRecipe, { size: "lg" });
    expect(document.querySelector("label")?.className).toBe(expected.control);
    expect(track()?.className).toBe(expected.track);
    // `size` styles only `track` and `control`, so the other three slots must NOT pick one up.
    expect(expected.root).not.toMatch(/--size_/);
    expect(expected.thumb).not.toMatch(/--size_/);
    expect(expected.label).not.toMatch(/--size_/);
  });

  // react-aria-components stamps `react-aria-SwitchField` and `react-aria-SwitchButton` on the
  // two wrappers when they are rendered without an explicit className. Those would become a
  // public styling hook the design system never agreed to expose, so both get one. Measured
  // against RAC's real output: the visually-hidden span RAC wraps the input in carries no class
  // at all, which is why this sweep passes rather than needing an exception.
  it("never ships react-aria's default class names", () => {
    renderSwitch({ children: "Enable notifications", isSelected: true, isInvalid: true });
    for (const element of document.querySelectorAll("*")) {
      expect(element.getAttribute("class") ?? "").not.toMatch(/react-aria-/);
    }
  });

  it("hides the decorative track from assistive tech so the control announces once", () => {
    renderSwitch({ children: "Enable notifications" });
    expect(track()?.getAttribute("aria-hidden")).toBe("true");
    // One switch, not two: the track must not have become a second reachable control.
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("reports the new value through onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSwitch({ children: "Enable notifications", onChange });

    await user.click(screen.getByRole("switch", { name: "Enable notifications" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("does not fire onChange while disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSwitch({ children: "Enable notifications", isDisabled: true, onChange });

    await user.click(screen.getByRole("switch", { name: "Enable notifications" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not change value while read-only", async () => {
    const user = userEvent.setup();
    renderSwitch({ children: "Enable notifications", isReadOnly: true });
    const control = screen.getByRole("switch", {
      name: "Enable notifications",
    }) as HTMLInputElement;

    await user.click(control);

    expect(control.checked).toBe(false);
  });

  it("renders a controlled selected value", () => {
    renderSwitch({ children: "Enable notifications", isSelected: true, onChange: () => {} });
    const control = screen.getByRole("switch", {
      name: "Enable notifications",
    }) as HTMLInputElement;
    expect(control.checked).toBe(true);
  });

  // `isRequired` and `isInvalid` exist ONLY because this component is built on SwitchField +
  // SwitchButton. RAC 1.20's flat `Switch` omits both from its props outright, so these two
  // tests are the guard on that architectural choice: if someone "simplifies" this back to the
  // deprecated flat component, they fail rather than silently dropping two states.
  it("marks a required control so assistive tech can announce it", () => {
    renderSwitch({ children: "Enable notifications", isRequired: true });
    expect(document.querySelector("input")?.hasAttribute("required")).toBe(true);
  });

  it("marks an invalid control through aria-invalid, not colour alone", () => {
    renderSwitch({ children: "Enable notifications", isInvalid: true });
    expect(
      screen.getByRole("switch", { name: "Enable notifications" }).getAttribute("aria-invalid"),
    ).toBe("true");
  });

  it("takes keyboard focus, which is what the focus-visible outline hangs off", async () => {
    const user = userEvent.setup();
    renderSwitch({ children: "Enable notifications" });
    const control = screen.getByRole("switch", { name: "Enable notifications" });

    await user.tab();

    // `document.activeElement` rather than jest-dom's `toHaveFocus`: this package deliberately
    // does not depend on @testing-library/jest-dom.
    expect(document.activeElement).toBe(control);
    expect(track()?.getAttribute("data-focus-visible")).toBe("true");
  });

  // The space bar is the switch's keyboard contract and it is genuinely distinct from a click:
  // a control that only responded to the pointer would pass every test above.
  it("toggles on the space bar", async () => {
    const user = userEvent.setup();
    renderSwitch({ children: "Enable notifications" });
    const control = screen.getByRole("switch", {
      name: "Enable notifications",
    }) as HTMLInputElement;

    await user.tab();
    await user.keyboard(" ");

    expect(control.checked).toBe(true);
  });
});

// The state attributes on the decorative track are not cosmetic duplication: they are what every
// `&[data-*]` rule in the recipe hangs off. Reading the field's state through a descendant
// selector instead would emit an UNQUALIFIED `[data-selected] .zui-switch__track`, which any
// ancestor carrying the attribute matches. Inherited from Checkbox, guarded the same way.
describe("Switch state attributes are stamped on the track the recipe styles", () => {
  it("mirrors selected onto the track", () => {
    renderSwitch({ children: "Enable notifications", isSelected: true, onChange: () => {} });
    expect(track()?.getAttribute("data-selected")).toBe("true");
  });

  it("mirrors disabled and invalid onto the track", () => {
    renderSwitch({ children: "Enable notifications", isDisabled: true, isInvalid: true });
    expect(track()?.getAttribute("data-disabled")).toBe("true");
    expect(track()?.getAttribute("data-invalid")).toBe("true");
  });

  it("omits an unset state entirely rather than rendering it false", () => {
    renderSwitch({ children: "Enable notifications" });
    const pill = track();
    expect(pill?.hasAttribute("data-selected")).toBe(false);
    expect(pill?.hasAttribute("data-invalid")).toBe(false);
    expect(pill?.hasAttribute("data-disabled")).toBe(false);
  });

  // The `control` slot is the one place this recipe styles state it does NOT stamp itself: the
  // `&[data-disabled]` and `&[data-readonly]` rules rely on react-aria-components putting those
  // attributes on the `SwitchButton` label. Every other stateful rule keys off an attribute
  // `Switch.tsx` writes explicitly, so this is the only assumption in the file about upstream
  // behaviour — and an unasserted assumption is exactly how a rule stops applying in silence
  // when a dependency changes. Measured against RAC 1.20 rather than assumed, after a first
  // measurement that omitted `cleanup()` between renders reported `data-disabled` on a read-only
  // control and was wrong.
  it("lets react-aria stamp disabled and read-only on the control the recipe styles", () => {
    renderSwitch({ children: "Enable notifications", isDisabled: true });
    expect(document.querySelector("label")?.getAttribute("data-disabled")).toBe("true");

    cleanup();
    renderSwitch({ children: "Enable notifications", isReadOnly: true });
    const control = document.querySelector("label");
    // Read-only is its OWN state, not a flavour of disabled: the rules differ (`cursor: default`
    // rather than `not-allowed` plus `opacity: 0.5`), and a read-only control stays focusable.
    expect(control?.getAttribute("data-readonly")).toBe("true");
    expect(control?.hasAttribute("data-disabled")).toBe(false);
    expect(document.querySelector("input")?.getAttribute("aria-readonly")).toBe("true");
    expect(document.querySelector("input")?.hasAttribute("disabled")).toBe(false);
  });

  // The same specificity bug review caught on Checkbox, guarded before it can be re-introduced:
  // `[data-hovered]:not([data-disabled])` scores (0,3,0) against `[data-invalid]`'s (0,2,0),
  // because a `:not()` argument carries its own weight. Without the `:not([data-invalid])` guard
  // an invalid switch loses its red border the moment the pointer touches it.
  it("never lets the hover tint outrank the invalid border", () => {
    const css = emittedStylesheet();
    // Guarded against vacuity first, and the guard has to be on HOVER rules specifically: an
    // empty offender list reads as a pass, so proving only that the class is mentioned somewhere
    // proves nothing — base rules for it always exist. Review caught that exact hole here.
    expect(hoverSelectorsFor(css, "zui-switch__track").length).toBeGreaterThan(0);
    expect(hoverSelectorsNotExcludingInvalid(css, "zui-switch__track")).toEqual([]);
  });

  it("emits no rule that could reach a switch from an ancestor's state", () => {
    const css = emittedStylesheet();
    expect(selectorsMentioning(css, "zui-switch").length).toBeGreaterThan(0);
    expect(ancestorStateSelectors(css, "zui-switch")).toEqual([]);
  });
});

// G6 (the "use client" boundary assertion) lives in __tests__/emit-gates.test.ts, where it is one
// registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `SwitchProps` so the excess-property checks below
// apply to a fresh object literal.
function switchElement(props: SwitchProps) {
  return createElement(Switch, props);
}

describe("Switch public API surface (type-level)", () => {
  it("rejects className, style, unknown variant values and a missing label at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half of the contract — a rejected prop
    // still constructs a valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      switchElement({ children: "Enable", className: "x" }),
      // @ts-expect-error style is not part of the public API
      switchElement({ children: "Enable", style: {} }),
      // @ts-expect-error unknown size value
      switchElement({ children: "Enable", size: "nope" }),
      // @ts-expect-error an unlabelled control is not constructible
      switchElement({}),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
