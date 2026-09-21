// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the same reason as date-field.test.ts: the file stays
// `.test.ts` so this package's Vitest setup needs no JSX transform plugin, while
// `React.createElement` preserves the excess-property/type-mismatch checking the
// `@ts-expect-error` assertions at the bottom depend on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Calendar } from "../src/calendar/Calendar.js";
import { calendarRecipe } from "../src/calendar/calendar.recipe.js";
import type { CalendarProps } from "../src/calendar/calendar.types.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";

afterEach(() => {
  cleanup();
});

const renderCalendar = (props: CalendarProps) => render(createElement(Calendar, props));

/** The cell a user would read as selected. */
const selectedCell = () => document.querySelector("[data-selected]");

describe("Calendar", () => {
  it("renders a labelled calendar with a month heading and a grid", () => {
    renderCalendar({ label: "Event date", value: "2026-09-21" });
    expect(screen.getByRole("grid")).toBeTruthy();
    // The heading names the visible month, which is what makes paging comprehensible.
    expect(screen.getByRole("heading").textContent).toMatch(/September/i);
  });

  // MEASURED, not assumed: RAC does not use the label verbatim — it COMPOSES the accessible name
  // as "<label>, <visible month>", so a screen reader user always hears which month they are in
  // after paging. The test asserts the composition rather than equality, because asserting
  // equality would have meant "fixing" a behaviour that is correct.
  it("composes the accessible name from the label and the visible month", () => {
    renderCalendar({ label: "Event date", value: "2026-09-21" });
    const calendar = screen.getByRole("application", { name: /^Event date/ });
    expect(calendar.getAttribute("aria-label")).toBe("Event date, September 2026");
  });

  it("marks the cell matching an ISO value as selected", () => {
    renderCalendar({ label: "Event date", value: "2026-09-21" });
    expect(selectedCell()?.textContent).toBe("21");
  });

  // The whole point of the ISO decision, restated for this component: a consumer passes a string
  // and never imports @internationalized/date.
  it("accepts a plain string with no date library at the call site", () => {
    const props: CalendarProps = { label: "Event date", value: "1999-12-31" };
    renderCalendar(props);
    expect(selectedCell()?.textContent).toBe("31");
    expect(screen.getByRole("heading").textContent).toMatch(/December/i);
  });

  it("treats an unparseable value as nothing selected instead of throwing", () => {
    expect(() => renderCalendar({ label: "Event date", value: "31/12/1999" })).not.toThrow();
    expect(selectedCell()).toBeNull();
  });

  it("emits an ISO string, not a Date or a CalendarDate, when a day is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderCalendar({ label: "Event date", defaultValue: "2026-09-21", onChange });

    // Day cells are named with the full localised date — "Tuesday, September 15, 2026" — not with
    // the bare number, which is what makes a screen reader announcement comprehensible out of
    // grid context. Measured, not assumed.
    await user.click(screen.getByRole("button", { name: "Tuesday, September 15, 2026" }));

    expect(onChange).toHaveBeenCalled();
    const [emitted] = onChange.mock.calls.at(-1) ?? [];
    expect(emitted).toBe("2026-09-15");
  });

  // `isDateUnavailable` is the reason most teams need a calendar at all — blocked holidays,
  // booked days, weekends. Handing it a `CalendarDate` would leak react-aria's type back into the
  // public API through the BACK door, after the front door was closed. It receives an ISO string.
  it("hands isDateUnavailable an ISO string, not a CalendarDate", () => {
    const seen: unknown[] = [];
    renderCalendar({
      label: "Event date",
      value: "2026-09-21",
      isDateUnavailable: (date) => {
        seen.push(date);
        return false;
      },
    });
    expect(seen.length).toBeGreaterThan(0);
    for (const date of seen) {
      expect(typeof date).toBe("string");
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("marks unavailable days so they cannot be selected", () => {
    renderCalendar({
      label: "Event date",
      value: "2026-09-21",
      // Every 15th is blocked.
      isDateUnavailable: (date) => date.endsWith("-15"),
    });
    const unavailable = document.querySelector("[data-unavailable]");
    expect(unavailable?.textContent).toBe("15");
  });

  it("refuses to page before minValue", () => {
    renderCalendar({
      label: "Event date",
      value: "2026-09-21",
      minValue: "2026-09-01",
      maxValue: "2026-09-30",
    });
    const previous = screen.getByRole("button", { name: /previous/i });
    expect(previous.hasAttribute("disabled")).toBe(true);
  });

  it("applies exactly the default slot classes with no props", () => {
    renderCalendar({ label: "Event date", value: "2026-09-21" });
    const expected = slotRecipeClassNames(calendarRecipe, {});
    expect(screen.getByRole("application", { name: /^Event date/ }).className).toBe(expected.root);
    expect(screen.getByRole("grid").className).toBe(expected.grid);
    expect(selectedCell()?.className).toBe(expected.cell);
  });

  it("marks today so the grid has an anchor", () => {
    renderCalendar({ label: "Event date" });
    expect(document.querySelector("[data-today]")).toBeTruthy();
  });

  // MEASURED, and it corrected the assertion this test started as. A disabled calendar renders NO
  // `[data-selected]` cell at all — not a selected-but-dimmed one — so asserting on the selected
  // cell's disabled state would have asserted on an element that does not exist. RAC marks the
  // root instead and sets aria-disabled on every day.
  it("marks the calendar and every day disabled, and stops marking a selection", () => {
    renderCalendar({ label: "Event date", value: "2026-09-21", isDisabled: true });
    const calendar = screen.getByRole("application", { name: /^Event date/ });
    expect(calendar.hasAttribute("data-disabled")).toBe(true);
    expect(selectedCell()).toBeNull();

    const days = [...document.querySelectorAll(".zui-calendar__cell")];
    expect(days.length).toBeGreaterThan(0);
    for (const day of days) {
      expect(day.getAttribute("aria-disabled")).toBe("true");
    }
  });
});

describe("Calendar types", () => {
  it("refuses className and style", () => {
    // @ts-expect-error className is owned by the design system.
    const withClassName: CalendarProps = { label: "Event date", className: "mine" };
    // @ts-expect-error style is owned by the design system.
    const withStyle: CalendarProps = { label: "Event date", style: { color: "red" } };
    expect(withClassName).toBeTruthy();
    expect(withStyle).toBeTruthy();
  });

  it("refuses a Date object where an ISO string is required", () => {
    // @ts-expect-error a timestamp is not a calendar date — see calendar.types.ts.
    const withDate: CalendarProps = { label: "Event date", value: new Date() };
    expect(withDate).toBeTruthy();
  });
});
