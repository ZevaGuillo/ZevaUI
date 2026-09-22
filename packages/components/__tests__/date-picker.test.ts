// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as date-field.test.ts and
// calendar.test.ts: the file stays `.test.ts` so this package's Vitest setup needs no JSX
// transform plugin, while `React.createElement` preserves the excess-property/type-mismatch
// checking the `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarRecipe } from "../src/calendar/calendar.recipe.js";
import { dateFieldRecipe } from "../src/date-field/date-field.recipe.js";
import { DatePicker } from "../src/date-picker/DatePicker.js";
import { datePickerRecipe } from "../src/date-picker/date-picker.recipe.js";
import type { DatePickerProps } from "../src/date-picker/date-picker.types.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";

afterEach(() => {
  cleanup();
});

const renderPicker = (props: DatePickerProps) => render(createElement(DatePicker, props));

/**
 * The trigger is queried by ITS OWN name rather than by position, and that name is react-aria's,
 * not ours: `useDatePicker` stamps a localised `aria-label="Calendar"` onto the button and composes
 * it with the field's label. MEASURED against RAC 1.20 — the test would have been written against
 * a made-up name otherwise, and the button's visible content is decoration (see DatePicker.tsx).
 */
const trigger = () => screen.getByRole("button", { name: /Calendar/ });

/** The boxed row that holds the segments and the trigger. */
const fieldGroup = () => screen.getByRole("group", { name: /Trip date/ });

const openCalendar = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(trigger());
  return screen.getByRole("application", { name: /^Trip date/ });
};

describe("DatePicker", () => {
  it("renders a labelled field of segments with a calendar trigger beside them", () => {
    renderPicker({ label: "Trip date", value: "2026-09-21" });
    expect(screen.getByText("Trip date")).toBeTruthy();
    expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0);
    expect(trigger()).toBeTruthy();
  });

  it("keeps the calendar shut until the trigger is pressed", () => {
    renderPicker({ label: "Trip date", value: "2026-09-21" });
    expect(screen.queryByRole("application")).toBeNull();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  // MEASURED, and it corrected this test as first written. The trigger is captured BEFORE the
  // panel opens, because react-aria calls `ariaHideOutside` when a `Popover` mounts: while the
  // calendar is up, the field and its own trigger are `aria-hidden`, so a role query cannot reach
  // the button at all. "Non-modal" means the page behind stays CLICKABLE, not that it stays
  // readable to a screen reader — which is a sharper statement than the one popover.recipe.ts
  // makes in prose, and the reason this assertion holds a node rather than re-querying for one.
  it("opens a calendar in a popover and marks the trigger expanded", async () => {
    const user = userEvent.setup();
    renderPicker({ label: "Trip date", value: "2026-09-21" });
    const button = trigger();

    await user.click(button);

    expect(screen.getByRole("application", { name: /^Trip date/ })).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  // The whole argument of this component: the panel is not a second calendar written for the
  // popover, it is THIS PACKAGE'S `Calendar`. Asserting on its slot classes is what makes that
  // structural rather than a claim in a comment — a reimplementation would not carry them.
  it("puts this package's own Calendar in the popover, not a reimplementation of one", async () => {
    const user = userEvent.setup();
    renderPicker({ label: "Trip date", value: "2026-09-21" });
    const calendar = await openCalendar(user);
    const calendarSlots = slotRecipeClassNames(calendarRecipe, {});
    expect(calendar.className).toBe(calendarSlots.root);
    expect(screen.getByRole("grid").className).toBe(calendarSlots.grid);
  });

  it("marks the segments and the calendar cell from one ISO value", async () => {
    const user = userEvent.setup();
    renderPicker({ label: "Trip date", value: "2026-09-21" });
    expect(screen.getByRole("spinbutton", { name: /day/ }).getAttribute("aria-valuenow")).toBe(
      "21",
    );
    await openCalendar(user);
    expect(document.querySelector("[data-selected]")?.textContent).toBe("21");
  });

  // The point of the ISO decision, restated for the component that finally joins the field and
  // the calendar: one primitive string drives both halves.
  it("accepts a plain string with no date library at the call site", () => {
    const props: DatePickerProps = { label: "Trip date", value: "1999-12-31" };
    renderPicker(props);
    expect(screen.getByRole("spinbutton", { name: /year/ }).getAttribute("aria-valuenow")).toBe(
      "1999",
    );
  });

  it("treats null as a cleared field", () => {
    renderPicker({ label: "Trip date", value: null });
    expect(document.querySelectorAll("[data-placeholder]").length).toBeGreaterThan(0);
  });

  it("treats an unparseable value as a cleared field instead of throwing", () => {
    expect(() => renderPicker({ label: "Trip date", value: "21/09/2026" })).not.toThrow();
    expect(document.querySelectorAll("[data-placeholder]").length).toBeGreaterThan(0);
  });

  it("emits an ISO string, not a Date or a CalendarDate, when a day is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ label: "Trip date", defaultValue: "2026-09-21", onChange });
    await openCalendar(user);

    // Day cells are named with the full localised date, as calendar.test.ts measured.
    await user.click(screen.getByRole("button", { name: "Tuesday, September 15, 2026" }));

    expect(onChange).toHaveBeenCalled();
    const [emitted] = onChange.mock.calls.at(-1) ?? [];
    expect(emitted).toBe("2026-09-15");
  });

  it("emits an ISO string when a segment is typed instead of picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ label: "Trip date", defaultValue: "2026-09-21", onChange });

    const [firstSegment] = screen.getAllByRole("spinbutton");
    await user.click(firstSegment);
    await user.keyboard("{ArrowUp}");

    expect(onChange).toHaveBeenCalled();
    const [emitted] = onChange.mock.calls.at(-1) ?? [];
    expect(typeof emitted).toBe("string");
    expect(emitted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // MEASURED against RAC 1.20 rather than assumed: picking a day DISMISSES the popover. A picker
  // that stayed open would leave the user to find the way out of a panel whose job is done.
  it("dismisses the popover once a day is picked", async () => {
    const user = userEvent.setup();
    renderPicker({ label: "Trip date", defaultValue: "2026-09-21" });
    await openCalendar(user);

    await user.click(screen.getByRole("button", { name: "Tuesday, September 15, 2026" }));

    expect(screen.queryByRole("application")).toBeNull();
  });

  it("hands isDateUnavailable an ISO string, not a CalendarDate", async () => {
    const user = userEvent.setup();
    const seen: unknown[] = [];
    renderPicker({
      label: "Trip date",
      value: "2026-09-21",
      isDateUnavailable: (date) => {
        seen.push(date);
        return false;
      },
    });
    await openCalendar(user);

    expect(seen.length).toBeGreaterThan(0);
    for (const date of seen) {
      expect(typeof date).toBe("string");
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("marks unavailable days in the popover calendar", async () => {
    const user = userEvent.setup();
    renderPicker({
      label: "Trip date",
      value: "2026-09-21",
      isDateUnavailable: (date) => date.endsWith("-15"),
    });
    await openCalendar(user);
    expect(document.querySelector("[data-unavailable]")?.textContent).toBe("15");
  });

  // The bounds live on the PICKER and have to reach the calendar through react-aria's context.
  // This is the assertion that a probe was written for before a line of this component existed:
  // the inner `Calendar` passes `minValue={undefined}` when the consumer gave it none, and if
  // react-aria let an explicit `undefined` override the context, the picker's bounds would be
  // silently wiped the moment the panel opened.
  it("carries the picker's bounds into the calendar rather than letting them be wiped", async () => {
    const user = userEvent.setup();
    renderPicker({
      label: "Trip date",
      value: "2026-09-15",
      minValue: "2026-09-10",
      maxValue: "2026-09-20",
    });
    await openCalendar(user);

    const outsideMin = screen.getByRole("button", { name: /September 5, 2026/ });
    const inside = screen.getByRole("button", { name: /September 15, 2026/ });
    const outsideMax = screen.getByRole("button", { name: /September 25, 2026/ });

    expect(outsideMin.getAttribute("aria-disabled")).toBe("true");
    expect(inside.hasAttribute("aria-disabled")).toBe(false);
    expect(outsideMax.getAttribute("aria-disabled")).toBe("true");
  });

  it("wires the description through aria-describedby", () => {
    renderPicker({ label: "Trip date", description: "Arrival day" });
    const describedBy = fieldGroup().getAttribute("aria-describedby") ?? "";
    const text = describedBy
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    expect(text).toContain("Arrival day");
  });

  it("renders no error element while the field is valid", () => {
    renderPicker({ label: "Trip date", errorMessage: "Pick a date" });
    expect(screen.queryByText("Pick a date")).toBeNull();
  });

  it("announces the error message once the field is invalid", () => {
    renderPicker({ label: "Trip date", errorMessage: "Pick a date", isInvalid: true });
    expect(screen.getByText("Pick a date")).toBeTruthy();
  });

  // The inner Calendar renders a `FieldError` of its own. It must stay silent, or an invalid
  // picker would say the same sentence twice — once under the field and once inside the panel.
  it("states an error once, not once per FieldError in the tree", async () => {
    const user = userEvent.setup();
    renderPicker({
      label: "Trip date",
      value: "2026-09-21",
      isInvalid: true,
      errorMessage: "That day is fully booked.",
    });
    await openCalendar(user);
    const occurrences = (document.body.textContent?.match(/That day is fully booked\./g) ?? [])
      .length;
    expect(occurrences).toBe(1);
  });

  it("disables the trigger along with the field", () => {
    renderPicker({ label: "Trip date", value: "2026-09-21", isDisabled: true });
    expect(trigger().hasAttribute("disabled")).toBe(true);
    expect(fieldGroup().hasAttribute("data-disabled")).toBe(true);
  });

  it("applies exactly the default slot classes with no props", () => {
    renderPicker({ label: "Trip date", value: "2026-09-21" });
    const expected = slotRecipeClassNames(datePickerRecipe, {});
    expect(fieldGroup().className).toBe(expected.group);
    expect(screen.getByText("Trip date").className).toBe(expected.label);
    expect(trigger().className).toBe(expected.trigger);
  });

  it("applies exactly the size=lg slot classes and no others", () => {
    renderPicker({ label: "Trip date", size: "lg" });
    const expected = slotRecipeClassNames(datePickerRecipe, { size: "lg" });
    expect(fieldGroup().className).toBe(expected.group);
    // The axis moves the BOX only, exactly as DateField's does, so the segments inside carry no
    // size class at all — `slotRecipeClassNames` filters per slot.
    const segments = screen.getAllByRole("spinbutton");
    const bare = slotRecipeClassNames(datePickerRecipe, {});
    for (const segment of segments) {
      expect(segment.className).toBe(bare.segment);
    }
  });

  it("marks the trigger glyph decorative, since react-aria already names the button", () => {
    renderPicker({ label: "Trip date", value: "2026-09-21" });
    const glyph = trigger().querySelector("span");
    expect(glyph?.getAttribute("aria-hidden")).toBe("true");
  });
});

// This is the drift guard, and it is the reason the segment declarations were moved into
// `internal/text-surface.ts` rather than copied. `Textarea` was written by copying `Input` and
// inherited a real bug through the paste; a date picker written by copying a date field would be
// the same story with the same ending. Identity, not equality: both recipes must read the ONE
// exported object, so a change to either lands on both or the test fails.
describe("DatePicker and DateField share one segment contract", () => {
  it("reads the same segment declarations, by identity", () => {
    expect(datePickerRecipe.base.segment).toBe(dateFieldRecipe.base.segment);
  });

  it("reads the same field chrome as every other text field", () => {
    expect(datePickerRecipe.base.root).toBe(dateFieldRecipe.base.root);
    expect(datePickerRecipe.base.label).toBe(dateFieldRecipe.base.label);
    expect(datePickerRecipe.base.description).toBe(dateFieldRecipe.base.description);
    expect(datePickerRecipe.base.error).toBe(dateFieldRecipe.base.error);
  });
});

describe("DatePicker types", () => {
  it("refuses className and style", () => {
    // @ts-expect-error className is owned by the design system.
    const withClassName: DatePickerProps = { label: "Trip date", className: "mine" };
    // @ts-expect-error style is owned by the design system.
    const withStyle: DatePickerProps = { label: "Trip date", style: { color: "red" } };
    expect(withClassName).toBeTruthy();
    expect(withStyle).toBeTruthy();
  });

  it("refuses a Date object where an ISO string is required", () => {
    // @ts-expect-error a timestamp is not a calendar date — see date-picker.types.ts.
    const withDate: DatePickerProps = { label: "Trip date", value: new Date() };
    expect(withDate).toBeTruthy();
  });

  it("accepts null for a cleared field and a nullable onChange", () => {
    const cleared: DatePickerProps = {
      label: "Trip date",
      value: null,
      onChange: (value) => {
        // The null branch is part of the contract: a picker's field can be emptied by keyboard
        // even though its calendar has no way to unselect a day.
        const _typed: string | null = value;
        void _typed;
      },
    };
    expect(cleared).toBeTruthy();
  });
});
