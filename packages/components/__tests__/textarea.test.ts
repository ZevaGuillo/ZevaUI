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
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Textarea } from "../src/textarea/Textarea.js";
import { textareaRecipe } from "../src/textarea/textarea.recipe.js";
import type { TextareaProps } from "../src/textarea/textarea.types.js";
import {
  emittedStylesheet,
  hoverSelectorsFor,
  hoverSelectorsNotExcludingInvalid,
} from "./support/emitted-css.js";

afterEach(() => {
  cleanup();
});

const renderTextarea = (props: TextareaProps) => render(createElement(Textarea, props));

const describedByText = (field: HTMLElement) =>
  (field.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .filter(Boolean);

describe("Textarea", () => {
  it("renders a real textarea element, not an input", () => {
    renderTextarea({ label: "Bio" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field.tagName).toBe("TEXTAREA");
  });

  it("associates the label with the textarea through a real for/id pair", () => {
    renderTextarea({ label: "Bio" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    const label = document.querySelector("label");
    expect(label?.getAttribute("for")).toBe(field.id);
    expect(field.id).not.toBe("");
  });

  it("forwards rows to the native attribute, which is what sets the initial height", () => {
    renderTextarea({ label: "Bio", rows: 6 });
    expect(document.querySelector("textarea")?.getAttribute("rows")).toBe("6");
  });

  it("applies exactly the default slot classes with no props", () => {
    renderTextarea({ label: "Bio" });
    const expected = slotRecipeClassNames(textareaRecipe, {});
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field.className).toBe(expected.textarea);
    expect(document.querySelector("label")?.className).toBe(expected.label);
    expect(field.closest("div")?.className).toBe(expected.root);
  });

  // The default has to be a real class from the `resize` axis, not an absent one: `vertical` is
  // the whole reason the axis exists, since the browser default is `resize: both` and that is
  // what breaks a layout horizontally.
  it("defaults to the vertical resize class rather than leaving the axis unset", () => {
    renderTextarea({ label: "Bio" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field.className).toBe(
      slotRecipeClassNames(textareaRecipe, { resize: "vertical" }).textarea,
    );
    expect(field.className).toContain("resize_vertical");
  });

  it("applies exactly the resize=none slot classes and no others", () => {
    renderTextarea({ label: "Bio", resize: "none" });
    const expected = slotRecipeClassNames(textareaRecipe, { resize: "none" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field.className).toBe(expected.textarea);
    // `resize` styles only the textarea slot, so the label must NOT pick up a resize class.
    expect(document.querySelector("label")?.className).toBe(expected.label);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderTextarea({ label: "Bio", size: "lg" });
    const expected = slotRecipeClassNames(textareaRecipe, { size: "lg" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field.className).toBe(expected.textarea);
    expect(document.querySelector("label")?.className).toBe(expected.label);
  });

  it("composes the size and resize axes on the one slot they both style", () => {
    renderTextarea({ label: "Bio", size: "sm", resize: "none" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field.className).toBe(
      slotRecipeClassNames(textareaRecipe, { size: "sm", resize: "none" }).textarea,
    );
    expect(field.className).toContain("size_sm");
    expect(field.className).toContain("resize_none");
  });

  // react-aria-components stamps its own `react-aria-*` class on any part rendered without an
  // explicit className. Those would become a public styling hook the design system never agreed
  // to expose, so every slot passes one. Measured against RAC's real output, not assumed.
  it("never ships react-aria's default class names", () => {
    renderTextarea({
      label: "Bio",
      description: "A short introduction",
      errorMessage: "Too long",
      isInvalid: true,
    });
    for (const element of document.querySelectorAll("*")) {
      expect(element.className).not.toMatch(/react-aria-/);
    }
  });

  it("wires the description to the textarea through aria-describedby", () => {
    renderTextarea({ label: "Bio", description: "Max 200 characters" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(describedByText(field)).toContain("Max 200 characters");
  });

  it("renders no description element when none is supplied", () => {
    renderTextarea({ label: "Bio" });
    const expected = slotRecipeClassNames(textareaRecipe, {});
    expect(document.querySelector(`.${expected.description.replace(/ .*/, "")}`)).toBeNull();
  });

  it("announces the error message and marks the field invalid", () => {
    renderTextarea({ label: "Bio", errorMessage: "Tell us something", isInvalid: true });
    const field = screen.getByRole("textbox", { name: "Bio" });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(describedByText(field)).toContain("Tell us something");
  });

  it("does not render the error message while the field is valid", () => {
    renderTextarea({ label: "Bio", errorMessage: "Tell us something" });
    expect(screen.queryByText("Tell us something")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Bio" }).getAttribute("aria-invalid")).not.toBe(
      "true",
    );
  });

  it("keeps the accessible name intact while invalid", () => {
    renderTextarea({ label: "Bio", errorMessage: "Required", isInvalid: true });
    expect(screen.getByRole("textbox", { name: "Bio" })).toBeTruthy();
  });

  it("marks a disabled field with the disabled attribute and RAC's data-disabled", () => {
    renderTextarea({ label: "Bio", isDisabled: true });
    const field = document.querySelector("textarea");
    expect(field?.hasAttribute("disabled")).toBe(true);
    expect(field?.getAttribute("data-disabled")).toBe("true");
  });

  it("marks a required field so assistive tech can announce it", () => {
    renderTextarea({ label: "Bio", isRequired: true });
    expect(document.querySelector("textarea")?.hasAttribute("required")).toBe(true);
  });

  it("marks a read-only field", () => {
    renderTextarea({ label: "Bio", isReadOnly: true });
    expect(document.querySelector("textarea")?.hasAttribute("readonly")).toBe(true);
  });

  it("reports each typed value through onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderTextarea({ label: "Bio", onChange });
    await user.type(screen.getByRole("textbox", { name: "Bio" }), "ab");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith("ab");
  });

  // The multi-line half of the contract, and the one thing Input cannot be asked to prove: a
  // newline has to survive into the value rather than submit or be swallowed.
  it("keeps newlines in the value, which is the whole point of a textarea", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderTextarea({ label: "Bio", onChange });
    await user.type(screen.getByRole("textbox", { name: "Bio" }), "a{Enter}b");
    expect(onChange).toHaveBeenLastCalledWith("a\nb");
  });

  it("does not fire onChange while disabled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderTextarea({ label: "Bio", isDisabled: true, onChange });
    await user.type(document.querySelector("textarea") as HTMLElement, "abc");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders a controlled value", () => {
    renderTextarea({ label: "Bio", value: "hello", onChange: () => {} });
    expect((screen.getByRole("textbox", { name: "Bio" }) as HTMLTextAreaElement).value).toBe(
      "hello",
    );
  });

  it("takes keyboard focus, which is what the focus-visible outline hangs off", async () => {
    const user = userEvent.setup();
    renderTextarea({ label: "Bio" });
    const field = screen.getByRole("textbox", { name: "Bio" });
    await user.tab();
    // `document.activeElement` rather than jest-dom's `toHaveFocus`: this package deliberately
    // does not depend on @testing-library/jest-dom.
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("data-focus-visible")).toBe("true");
  });

  // The guard `hoverSelectorsNotExcludingInvalid` exists for: a hover rule spelled
  // `[data-hovered]:not([data-disabled])` scores (0,3,0) against the invalid rule's (0,2,0), so it
  // wins in any source order and the red border disappears under the pointer. Review caught this
  // on Checkbox; `Input` still carries the unguarded spelling, which is why this assertion reads
  // the real emitted stylesheet rather than trusting the recipe object.
  it("never lets the hover tint outrank an invalid textarea's border", () => {
    const css = emittedStylesheet();
    // Vacuity is guarded FIRST, the same order `assertHoverDoesNotOutrankInvalid` uses: with no
    // hover rule emitted at all — a deleted rule, a renamed slot, a stale stylesheet — the
    // emptiness assertion below passes while checking nothing. Review caught that exact hole
    // once, and the targeted validator caught this test missing it.
    expect(hoverSelectorsFor(css, "zui-textarea__textarea").length).toBeGreaterThan(0);
    expect(hoverSelectorsNotExcludingInvalid(css, "zui-textarea__textarea")).toEqual([]);
  });
});

// G6 (the "use client" boundary assertion) lives in __tests__/emit-gates.test.ts, where it is one
// registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `TextareaProps` so the excess-property checks below
// apply to a fresh object literal.
function textareaElement(props: TextareaProps) {
  return createElement(Textarea, props);
}

describe("Textarea public API surface (type-level)", () => {
  it("rejects className, style, unknown variant values, `type` and a missing label at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the
    // typecheck the moment its error disappears. What runs here is the
    // runtime half of the contract — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      textareaElement({ label: "Bio", className: "x" }),
      // @ts-expect-error style is not part of the public API
      textareaElement({ label: "Bio", style: {} }),
      // @ts-expect-error unknown size value
      textareaElement({ label: "Bio", size: "nope" }),
      // @ts-expect-error unknown resize value; `both` is deliberately not offered
      textareaElement({ label: "Bio", resize: "both" }),
      // @ts-expect-error a textarea has no `type`; that axis belongs to Input
      textareaElement({ label: "Bio", type: "text" }),
      // @ts-expect-error an unlabelled field is not constructible
      textareaElement({}),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
