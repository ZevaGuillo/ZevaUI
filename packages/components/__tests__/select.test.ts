// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as menu.test.ts and textarea.test.ts:
// the file stays `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Select } from "../src/select/Select.js";
import { selectRecipe } from "../src/select/select.recipe.js";
import type { SelectOptionDescriptor, SelectProps } from "../src/select/select.types.js";
import { emittedStylesheet, hoverSelectorsNotExcludingInvalid } from "./support/emitted-css.js";

// jsdom ships no global `CSS` object, and react-aria calls `CSS.escape` when it resolves the DOM
// node of the focused collection item — every arrow-key move and every activation. Same gap, same
// shim, same reasoning as menu.test.ts: it is the TEST ENVIRONMENT that lacks it, not the
// component, and Select.stories.tsx drives the identical path in Chromium with no shim at all.
const globalWithCss = globalThis as unknown as { CSS?: { escape: (value: string) => string } };
globalWithCss.CSS ??= {
  escape: (value: string) => value.replace(/[^\w-]/g, (character) => `\\${character}`),
};

afterEach(() => {
  cleanup();
});

const LABEL = "Billing plan";

const OPTIONS: readonly SelectOptionDescriptor[] = [
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro", description: "Everything in Free, plus priority support." },
  { value: "legacy", label: "Legacy", isDisabled: true },
];

const renderSelect = (props: Omit<SelectProps, "label" | "options"> = {}) =>
  render(createElement(Select, { ...props, label: LABEL, options: OPTIONS }));

const describedByText = (element: HTMLElement) =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .filter(Boolean);

const requireElement = (element: Element | null, what: string): HTMLElement => {
  if (element === null) throw new Error(`expected the select to render a ${what}`);
  return element as HTMLElement;
};

const trigger = () => screen.getByRole("button", { name: new RegExp(LABEL) });

/**
 * Queried by its text, never by `document.querySelector("label")`. RAC renders a Select's `Label`
 * as a `<span>` and points the trigger at it with `aria-labelledby`, while the only real `<label>`
 * in the tree belongs to the visually hidden native `<select>` RAC keeps for form submission —
 * measured on the 1.20 output. A tag query would silently assert against that hidden one.
 */
const labelElement = () => screen.getByText(LABEL);

describe("Select", () => {
  // ---------------------------------------------------------------- structure

  it("renders a labelled trigger button and no listbox while closed", () => {
    renderSelect();
    expect(trigger()).toBeDefined();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("associates the label with the trigger, so the control is never anonymous", () => {
    renderSelect();
    const labelledBy = trigger().getAttribute("aria-labelledby") ?? "";
    const announced = labelledBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
    expect(announced).toContain(LABEL);
  });

  it("renders the trigger as a real button with aria-haspopup=listbox, not a text field", () => {
    renderSelect();
    const control = trigger();
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("aria-haspopup")).toBe("listbox");
  });

  // The affordance that tells a sighted user this is a select rather than a button. It is
  // decorative: the role and the label already carry the meaning, so it must never reach the
  // accessibility tree and add a second, redundant announcement.
  it("renders a decorative chevron inside the trigger, hidden from assistive tech", () => {
    renderSelect();
    const expected = slotRecipeClassNames(selectRecipe, {});
    const icon = requireElement(
      trigger().querySelector(`.${expected.icon.split(" ")[0]}`),
      "chevron",
    );
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("opens the listbox when the trigger is pressed", async () => {
    const user = userEvent.setup();
    renderSelect();
    await user.click(trigger());
    expect(await screen.findByRole("listbox")).toBeDefined();
  });

  it("renders one option per descriptor, in the given order, named by its label", () => {
    renderSelect({ defaultOpen: true });
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Free",
      "ProEverything in Free, plus priority support.",
      "Legacy",
    ]);
  });

  it("keeps the trigger's announced value free of an option's supporting copy", async () => {
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true });
    await user.click(screen.getByRole("option", { name: "Pro" }));
    expect(trigger().textContent).toContain("Pro");
    expect(trigger().textContent).not.toContain("priority support");
  });

  // --------------------------------------------------------------- slot classes

  // The trigger is asserted while CLOSED and the list while OPEN, in that order, rather than both
  // at once off `defaultOpen`. Not a style choice: an open RAC popover marks the rest of the page
  // `aria-hidden`, so the trigger stops being reachable by role the moment the list is up. Opening
  // with a real click is also the only way to prove the two halves agree on the same `size`.
  it("applies exactly the default slot classes with no props", async () => {
    const user = userEvent.setup();
    renderSelect();
    const expected = slotRecipeClassNames(selectRecipe, {});
    const control = trigger();
    expect(control.className).toBe(expected.trigger);
    expect(labelElement().className).toBe(expected.label);

    await user.click(control);
    expect((await screen.findByRole("listbox")).className).toBe(expected.listbox);
    expect(screen.getByRole("option", { name: "Free" }).className).toBe(expected.item);
  });

  it("applies exactly the size=lg slot classes and no others", async () => {
    const user = userEvent.setup();
    renderSelect({ size: "lg" });
    const expected = slotRecipeClassNames(selectRecipe, { size: "lg" });
    const control = trigger();
    expect(control.className).toBe(expected.trigger);
    // `size` styles the trigger, the rows and their text — never the label, so the label must not
    // pick up a size class.
    expect(labelElement().className).toBe(expected.label);

    await user.click(control);
    await screen.findByRole("listbox");
    expect(screen.getByRole("option", { name: "Free" }).className).toBe(expected.item);
  });

  // react-aria-components applies its own `react-aria-*` classes to any part rendered without an
  // explicit className, and those would become a public styling hook the design system never
  // agreed to expose. Every slot passes one. Measured against RAC's real output, not assumed.
  it("never ships react-aria's default class names", () => {
    renderSelect({
      defaultOpen: true,
      description: "Change anytime.",
      errorMessage: "Pick a plan",
      isInvalid: true,
    });
    for (const element of document.querySelectorAll("*")) {
      expect(element.className).not.toMatch(/react-aria-/);
    }
  });

  // ----------------------------------------------------------------- selection

  it("shows the placeholder until something is selected", () => {
    renderSelect({ placeholder: "Choose a plan" });
    expect(trigger().textContent).toContain("Choose a plan");
  });

  it("renders the label of a controlled value rather than its raw key", () => {
    renderSelect({ value: "pro", onChange: () => {} });
    expect(trigger().textContent).toContain("Pro");
    expect(trigger().textContent).not.toContain("pro");
  });

  it("honours defaultValue for an uncontrolled select", () => {
    renderSelect({ defaultValue: "free" });
    expect(trigger().textContent).toContain("Free");
  });

  it("reports the chosen option's value through onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true, onChange });
    await user.click(screen.getByRole("option", { name: "Pro" }));
    expect(onChange).toHaveBeenCalledWith("pro");
  });

  it("marks the chosen option selected, which is the state the item recipe styles", async () => {
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true });
    await user.click(screen.getByRole("option", { name: "Pro" }));
    await user.click(trigger());
    const chosen = await screen.findByRole("option", { name: "Pro" });
    expect(chosen.getAttribute("aria-selected")).toBe("true");
    expect(chosen.getAttribute("data-selected")).toBe("true");
  });

  it("closes the listbox once an option is chosen", async () => {
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true });
    await user.click(screen.getByRole("option", { name: "Free" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // ------------------------------------------------------------------ disabled

  it("announces a disabled option as disabled and never selects it", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true, onChange });
    const legacy = screen.getByRole("option", { name: "Legacy" });
    expect(legacy.getAttribute("aria-disabled")).toBe("true");
    await user.click(legacy);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("skips a disabled option during keyboard navigation", async () => {
    const user = userEvent.setup();
    renderSelect({ defaultOpen: true });
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(screen.getByRole("option", { name: "Legacy" }).getAttribute("data-focused")).not.toBe(
      "true",
    );
  });

  it("marks a disabled select with RAC's data-disabled and blocks the trigger", async () => {
    const user = userEvent.setup();
    renderSelect({ isDisabled: true });
    const control = trigger();
    expect(control.hasAttribute("disabled")).toBe(true);
    expect(control.getAttribute("data-disabled")).toBe("true");
    await user.click(control);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  // --------------------------------------------------------- description / error

  it("wires the description to the control through aria-describedby", () => {
    renderSelect({ description: "You can change this at any time." });
    expect(describedByText(trigger())).toContain("You can change this at any time.");
  });

  it("renders no description element when none is supplied", () => {
    renderSelect();
    const expected = slotRecipeClassNames(selectRecipe, {});
    expect(document.querySelector(`.${expected.description.split(" ")[0]}`)).toBeNull();
  });

  it("announces the error message and marks the control invalid", () => {
    renderSelect({ errorMessage: "Pick a plan", isInvalid: true });
    const control = trigger();
    expect(control.closest("[data-invalid]")).not.toBeNull();
    expect(control.getAttribute("data-invalid")).toBe("true");
    expect(describedByText(control)).toContain("Pick a plan");
  });

  // Pins an upstream GAP rather than a feature, so it is visible instead of forgotten. Measured on
  // react-aria-components 1.20: a Select emits `aria-invalid` nowhere, and feeding one to the
  // trigger does not survive RAC's `Button`, whose DOM-prop allowlist carries `data-*` and the
  // labelling ARIA attributes but not this one. `Input` and `Textarea` both announce the state, so
  // Select announces strictly less. The day RAC closes it, this test fails and says so.
  it("announces no aria-invalid, because RAC's Select emits none and its Button drops one", () => {
    renderSelect({ errorMessage: "Pick a plan", isInvalid: true });
    expect(document.querySelector("[aria-invalid]")).toBeNull();
  });

  it("does not render the error message while the control is valid", () => {
    renderSelect({ errorMessage: "Pick a plan" });
    expect(screen.queryByText("Pick a plan")).toBeNull();
  });

  it("marks a required select so assistive tech can announce it", () => {
    renderSelect({ isRequired: true });
    expect(trigger().closest("[data-required]")).not.toBeNull();
  });

  // ---------------------------------------------------------------- open state

  // `[data-open]` is the first open/closed state attribute any form control in this system has.
  // It is asserted on the ROOT, which is where SelectRenderProps puts it — the same place the six
  // other Select states land, and the opposite of where Input and Textarea carry theirs.
  it("stamps data-open on the root while the listbox is open, and drops it when closed", async () => {
    const user = userEvent.setup();
    renderSelect();
    const expected = slotRecipeClassNames(selectRecipe, {});
    const root = requireElement(
      document.querySelector(`.${expected.root.split(" ")[0]}`),
      "root element",
    );

    expect(root.hasAttribute("data-open")).toBe(false);
    await user.click(trigger());
    await screen.findByRole("listbox");
    expect(root.getAttribute("data-open")).toBe("true");

    await user.keyboard("{Escape}");
    expect(root.hasAttribute("data-open")).toBe(false);
  });

  it("reports open and close through onOpenChange", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderSelect({ onOpenChange });
    await user.click(trigger());
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  // -------------------------------------------------------------------- focus

  it("takes keyboard focus, which is what the focus-visible outline hangs off", async () => {
    const user = userEvent.setup();
    renderSelect();
    const control = trigger();
    await user.tab();
    // `document.activeElement` rather than jest-dom's `toHaveFocus`: this package deliberately
    // does not depend on @testing-library/jest-dom.
    expect(document.activeElement).toBe(control);
    expect(control.getAttribute("data-focus-visible")).toBe("true");
  });

  // The specificity trap review caught on Checkbox and Textarea, asserted against the real
  // emitted stylesheet rather than the recipe object: `[data-hovered]:not([data-disabled])`
  // scores (0,3,0) against `[data-invalid]`'s (0,2,0), so an unguarded hover rule wins in any
  // source order and an invalid control loses its red border under the pointer.
  it("never lets the hover tint outrank an invalid select's border", () => {
    expect(hoverSelectorsNotExcludingInvalid(emittedStylesheet(), "zui-select__trigger")).toEqual(
      [],
    );
  });
});

// G6 (the "use client" boundary assertion) lives in __tests__/emit-gates.test.ts, where it is one
// registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `SelectProps` so the excess-property checks below
// apply to a fresh object literal.
function selectElement(props: SelectProps) {
  return createElement(Select, props);
}

describe("Select public API surface (type-level)", () => {
  it("rejects className, style, unknown sizes, isReadOnly, multiple selection and a missing label at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half of the contract — a rejected prop still
    // constructs a valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      selectElement({ label: LABEL, options: OPTIONS, className: "x" }),
      // @ts-expect-error style is not part of the public API
      selectElement({ label: LABEL, options: OPTIONS, style: {} }),
      // @ts-expect-error unknown size value
      selectElement({ label: LABEL, options: OPTIONS, size: "nope" }),
      // @ts-expect-error RAC omits isReadOnly from SelectProps, so this system does not invent it
      selectElement({ label: LABEL, options: OPTIONS, isReadOnly: true }),
      // @ts-expect-error single selection only: `selectionMode` is deliberately not exposed
      selectElement({ label: LABEL, options: OPTIONS, selectionMode: "multiple" }),
      // @ts-expect-error the deprecated RAC spelling never reaches this system's surface
      selectElement({ label: LABEL, options: OPTIONS, selectedKey: "pro" }),
      // @ts-expect-error an unlabelled control is not constructible
      selectElement({ options: OPTIONS }),
      // @ts-expect-error a select without options is not constructible
      selectElement({ label: LABEL }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
