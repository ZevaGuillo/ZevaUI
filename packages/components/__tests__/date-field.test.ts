// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as input.test.ts: the file stays
// `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateField } from "../src/date-field/DateField.js";
import { dateFieldRecipe } from "../src/date-field/date-field.recipe.js";
import type { DateFieldProps } from "../src/date-field/date-field.types.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import {
  emittedStylesheet,
  hoverSelectorsFor,
  hoverSelectorsNotExcludingInvalid,
} from "./support/emitted-css.js";

afterEach(() => {
  cleanup();
});

const renderField = (props: DateFieldProps) => render(createElement(DateField, props));

/** The editable segments, in document order, as the text a user would read. */
const segmentTexts = () =>
  [...document.querySelectorAll("[data-type]")]
    .filter((node) => node.getAttribute("data-type") !== "literal")
    .map((node) => node.textContent);

const describedByText = (control: HTMLElement) =>
  (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent)
    .filter(Boolean);

describe("DateField", () => {
  it("renders a labelled group of editable segments", () => {
    renderField({ label: "Start date" });
    const group = screen.getByRole("group", { name: "Start date" });
    expect(group).toBeTruthy();
    // Each editable segment is its own spinbutton — that is what lets a screen reader announce
    // "month, 9 of 12" rather than reading an opaque text field.
    expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
  });

  it("shows the parts of an ISO value across its segments", () => {
    renderField({ label: "Start date", value: "2026-09-21" });
    expect(segmentTexts()).toEqual(expect.arrayContaining(["2026", "9", "21"]));
  });

  // The whole point of the ISO decision: a consumer passes a string and never imports
  // @internationalized/date. If this ever needs a CalendarDate to pass, the boundary has leaked.
  it("accepts a plain string with no date library at the call site", () => {
    const props: DateFieldProps = { label: "Start date", value: "1999-12-31" };
    renderField(props);
    expect(segmentTexts()).toEqual(expect.arrayContaining(["1999", "12", "31"]));
  });

  it("treats an unparseable value as an empty field instead of throwing", () => {
    expect(() => renderField({ label: "Start date", value: "2026-9-1" })).not.toThrow();
    const group = screen.getByRole("group", { name: "Start date" });
    expect(group).toBeTruthy();
    // Placeholder segments, not a rendered date.
    expect(document.querySelectorAll("[data-placeholder]").length).toBeGreaterThan(0);
  });

  it("treats null as a cleared field", () => {
    renderField({ label: "Start date", value: null });
    expect(document.querySelectorAll("[data-placeholder]").length).toBeGreaterThan(0);
  });

  it("emits an ISO string, not a Date or a CalendarDate, when a segment changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderField({ label: "Start date", defaultValue: "2026-09-21", onChange });

    const [firstSegment] = screen.getAllByRole("spinbutton");
    await user.click(firstSegment);
    await user.keyboard("{ArrowUp}");

    expect(onChange).toHaveBeenCalled();
    const [emitted] = onChange.mock.calls.at(-1) ?? [];
    expect(typeof emitted).toBe("string");
    expect(emitted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // MEASURED, not assumed: RAC renders a DateField's `Label` as a `<span>`, not a `<label>`.
  // A `<label for>` must point at ONE form control and a date field is a group of several, so
  // there is nothing for the attribute to reference — the name reaches the group through
  // aria-labelledby instead. This is the one structural difference from `Input`, whose own test
  // asserts a real for/id pair, and it is why the label is queried by class here.
  it("names the group through aria-labelledby rather than a for/id pair", () => {
    renderField({ label: "Start date" });
    const group = screen.getByRole("group", { name: "Start date" });
    const labelId = group.getAttribute("aria-labelledby");
    expect(labelId).toBeTruthy();
    expect(document.getElementById(labelId ?? "")?.textContent).toBe("Start date");
    expect(document.querySelector("label")).toBeNull();
  });

  it("applies exactly the default slot classes with no props", () => {
    renderField({ label: "Start date" });
    const expected = slotRecipeClassNames(dateFieldRecipe, {});
    const group = screen.getByRole("group", { name: "Start date" });
    expect(group.className).toBe(expected.input);
    const labelId = group.getAttribute("aria-labelledby") ?? "";
    expect(document.getElementById(labelId)?.className).toBe(expected.label);
    const segment = document.querySelector("[data-type]");
    expect(segment?.className).toBe(expected.segment);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderField({ label: "Start date", size: "lg" });
    const expected = slotRecipeClassNames(dateFieldRecipe, { size: "lg" });
    const group = screen.getByRole("group", { name: "Start date" });
    expect(group.className).toBe(expected.input);
  });

  it("wires the description through aria-describedby", () => {
    renderField({ label: "Start date", description: "Use the arrow keys" });
    const group = screen.getByRole("group", { name: "Start date" });
    expect(describedByText(group)).toContain("Use the arrow keys");
  });

  it("renders no error element while the field is valid", () => {
    renderField({ label: "Start date", errorMessage: "Pick a date" });
    expect(screen.queryByText("Pick a date")).toBeNull();
  });

  it("announces the error message once the field is invalid", () => {
    renderField({ label: "Start date", errorMessage: "Pick a date", isInvalid: true });
    expect(screen.getByText("Pick a date")).toBeTruthy();
  });

  it("marks every segment disabled when the field is", () => {
    renderField({ label: "Start date", value: "2026-09-21", isDisabled: true });
    const group = screen.getByRole("group", { name: "Start date" });
    expect(group.hasAttribute("data-disabled")).toBe(true);
  });

  // The defect `internal/text-surface.ts` was extracted to stop: a hover rule that outranks the
  // invalid rule makes the red border vanish under the pointer. This component inherits the fixed
  // declarations, and this gate proves the emitted CSS kept the `:not([data-invalid])` clause.
  it("never lets a hover rule outrank the invalid rule", () => {
    const css = emittedStylesheet();
    // The styled box is the `input` slot, exactly as it is for Input — that is the slot that
    // carries the border the bug made disappear.
    expect(hoverSelectorsFor(css, "zui-date-field__input").length).toBeGreaterThan(0);
    expect(hoverSelectorsNotExcludingInvalid(css, "zui-date-field__input")).toEqual([]);
  });
});

describe("DateField types", () => {
  it("refuses className and style", () => {
    // @ts-expect-error className is owned by the design system.
    const withClassName: DateFieldProps = { label: "Start date", className: "mine" };
    // @ts-expect-error style is owned by the design system.
    const withStyle: DateFieldProps = { label: "Start date", style: { color: "red" } };
    expect(withClassName).toBeTruthy();
    expect(withStyle).toBeTruthy();
  });

  it("refuses a Date object where an ISO string is required", () => {
    // @ts-expect-error a timestamp is not a calendar date — see date-field.types.ts.
    const withDate: DateFieldProps = { label: "Start date", value: new Date() };
    expect(withDate).toBeTruthy();
  });
});
