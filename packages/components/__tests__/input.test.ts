// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as button.test.ts: the file stays
// `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Input } from "../src/input/Input.js";
import { inputRecipe } from "../src/input/input.recipe.js";
import type { InputProps } from "../src/input/input.types.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";

afterEach(() => {
  cleanup();
});

const renderInput = (props: InputProps) => render(createElement(Input, props));

const describedByText = (input: HTMLElement) =>
  (input.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .filter(Boolean);

describe("Input", () => {
  it("renders a textbox whose accessible name comes from the label", () => {
    renderInput({ label: "Email" });
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("text");
  });

  it("associates the label with the input through a real for/id pair", () => {
    renderInput({ label: "Email" });
    const input = screen.getByRole("textbox", { name: "Email" });
    const label = document.querySelector("label");
    expect(label?.getAttribute("for")).toBe(input.id);
    expect(input.id).not.toBe("");
  });

  it("honours the type prop", () => {
    renderInput({ label: "Password", type: "password" });
    // A password field has no textbox role, so it is queried by label association instead.
    const input = document.querySelector("input");
    expect(input?.getAttribute("type")).toBe("password");
  });

  it("applies exactly the default slot classes with no props", () => {
    renderInput({ label: "Email" });
    const expected = slotRecipeClassNames(inputRecipe, {});
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.className).toBe(expected.input);
    expect(document.querySelector("label")?.className).toBe(expected.label);
    expect(input.closest("div")?.className).toBe(expected.root);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderInput({ label: "Email", size: "lg" });
    const expected = slotRecipeClassNames(inputRecipe, { size: "lg" });
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.className).toBe(expected.input);
    // `size` styles only the input slot, so the label must NOT pick up a size class.
    expect(document.querySelector("label")?.className).toBe(expected.label);
  });

  // react-aria-components stamps its own `react-aria-*` class on any part rendered without an
  // explicit className. Those would become a public styling hook the design system never agreed
  // to expose, so every slot passes one. Measured against RAC's real output, not assumed.
  it("never ships react-aria's default class names", () => {
    renderInput({
      label: "Email",
      description: "Work address",
      errorMessage: "Bad",
      isInvalid: true,
    });
    for (const element of document.querySelectorAll("*")) {
      expect(element.className).not.toMatch(/react-aria-/);
    }
  });

  it("wires the description to the input through aria-describedby", () => {
    renderInput({ label: "Email", description: "We never share it" });
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(describedByText(input)).toContain("We never share it");
  });

  it("renders no description element when none is supplied", () => {
    renderInput({ label: "Email" });
    const expected = slotRecipeClassNames(inputRecipe, {});
    expect(document.querySelector(`.${expected.description.replace(/ .*/, "")}`)).toBeNull();
  });

  it("announces the error message and marks the field invalid", () => {
    renderInput({ label: "Email", errorMessage: "Enter a valid address", isInvalid: true });
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(describedByText(input)).toContain("Enter a valid address");
  });

  it("does not render the error message while the field is valid", () => {
    renderInput({ label: "Email", errorMessage: "Enter a valid address" });
    expect(screen.queryByText("Enter a valid address")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Email" }).getAttribute("aria-invalid")).not.toBe(
      "true",
    );
  });

  it("keeps the accessible name intact while invalid", () => {
    renderInput({ label: "Email", errorMessage: "Required", isInvalid: true });
    expect(screen.getByRole("textbox", { name: "Email" })).toBeTruthy();
  });

  it("marks a disabled field with the disabled attribute and RAC's data-disabled", () => {
    renderInput({ label: "Email", isDisabled: true });
    const input = document.querySelector("input");
    expect(input?.hasAttribute("disabled")).toBe(true);
    expect(input?.getAttribute("data-disabled")).toBe("true");
  });

  it("marks a required field so assistive tech can announce it", () => {
    renderInput({ label: "Email", isRequired: true });
    const input = document.querySelector("input");
    expect(input?.hasAttribute("required")).toBe(true);
  });

  it("marks a read-only field", () => {
    renderInput({ label: "Email", isReadOnly: true });
    expect(document.querySelector("input")?.hasAttribute("readonly")).toBe(true);
  });

  it("reports each typed value through onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderInput({ label: "Email", onChange });
    await user.type(screen.getByRole("textbox", { name: "Email" }), "ab");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("ab");
  });

  it("does not fire onChange while disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderInput({ label: "Email", isDisabled: true, onChange });
    await user.type(document.querySelector("input") as HTMLElement, "abc");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a controlled value", () => {
    renderInput({ label: "Email", value: "someone@example.com", onChange: () => {} });
    expect((screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement).value).toBe(
      "someone@example.com",
    );
  });

  it("takes keyboard focus, which is what the focus-visible outline hangs off", async () => {
    const user = userEvent.setup();
    renderInput({ label: "Email" });
    const input = screen.getByRole("textbox", { name: "Email" });
    await user.tab();
    // `document.activeElement` rather than jest-dom's `toHaveFocus`: this package deliberately
    // does not depend on @testing-library/jest-dom.
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute("data-focus-visible")).toBe("true");
  });
});

// G6 (the "use client" boundary assertion) moved to __tests__/emit-gates.test.ts, where it is
// now one registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `InputProps` so the excess-property checks below
// apply to a fresh object literal.
function inputElement(props: InputProps) {
  return createElement(Input, props);
}

describe("Input public API surface (type-level)", () => {
  it("rejects className, style, unknown variant values and a missing label at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the
    // typecheck the moment its error disappears. What runs here is the
    // runtime half of the contract — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      inputElement({ label: "Email", className: "x" }),
      // @ts-expect-error style is not part of the public API
      inputElement({ label: "Email", style: {} }),
      // @ts-expect-error unknown size value
      inputElement({ label: "Email", size: "nope" }),
      // @ts-expect-error an unlabelled field is not constructible
      inputElement({}),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
