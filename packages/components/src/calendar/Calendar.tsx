"use client";

import {
  Calendar as AriaCalendar,
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  FieldError,
  Heading,
} from "react-aria-components";
import { calendarDateToIso, isoToCalendarDate } from "../internal/iso-date.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { calendarRecipe } from "./calendar.recipe.js";
import type { CalendarProps } from "./calendar.types.js";

/**
 * A month of days, picked by clicking or by walking the grid with the arrow keys.
 *
 * THE FIRST COLLECTION IN THIS PACKAGE THAT KEEPS REACT-ARIA'S MACHINERY ON PURPOSE. Breadcrumb,
 * Pagination and Table each refused it, because a row of links needs no keyboard delegate and Tab
 * already walks links. A month is two-dimensional: arrow keys must move by day AND by week, wrap
 * across month boundaries, skip disabled days and keep a roving tabindex. That is precisely what
 * the collection machinery implements, so here it is worth its weight rather than dead cargo.
 *
 * Its props are translated, not forwarded, exactly as `DateField`'s are — including
 * `isDateUnavailable`, whose callback would otherwise hand react-aria's `CalendarDate` back to the
 * consumer through the back door. See calendar.types.ts.
 */
export function Calendar({
  label,
  value,
  defaultValue,
  minValue,
  maxValue,
  isDateUnavailable,
  errorMessage,
  onChange,
  ...behaviour
}: CalendarProps) {
  const classNames = slotRecipeClassNames(calendarRecipe, {});

  // `value` and `defaultValue` are forwarded as separate props rather than merged, because RAC
  // distinguishes controlled from uncontrolled by which one is PRESENT — the same reason
  // DateField.tsx spreads them this way.
  const controlled = value === undefined ? {} : { value: isoToCalendarDate(value) };
  const uncontrolled =
    defaultValue === undefined ? {} : { defaultValue: isoToCalendarDate(defaultValue) };

  return (
    <AriaCalendar
      {...behaviour}
      {...controlled}
      {...uncontrolled}
      aria-label={label}
      // A bound that cannot be parsed is dropped rather than applied: an unparseable `minValue`
      // must not silently become "no date is selectable".
      minValue={isoToCalendarDate(minValue) ?? undefined}
      maxValue={isoToCalendarDate(maxValue) ?? undefined}
      // `date.toString()` on a CalendarDate is already the zero-padded ISO form, so the predicate
      // the consumer wrote against strings receives exactly what `value` speaks.
      isDateUnavailable={
        isDateUnavailable === undefined ? undefined : (date) => isDateUnavailable(date.toString())
      }
      // A day can always be re-selected but never un-selected, so RAC never emits null here and
      // the public callback has no null branch. The fallback keeps that promise honest rather
      // than assuming it.
      onChange={
        onChange === undefined
          ? undefined
          : (date) => {
              const iso = calendarDateToIso(date);
              if (iso !== null) onChange(iso);
            }
      }
      className={classNames.root}
    >
      {/* A PLAIN DIV, NOT A `<header>`, and the difference is not cosmetic. `<header>` maps to the
          `banner` landmark, and the blocking a11y gate caught it: a banner nested inside this
          calendar's `role="application"` is a landmark violation, and it failed all eight stories
          across both themes. The month navigation is a control strip, not the heading of the page
          — the semantic element was reached for out of habit and bought nothing. */}
      <div className={classNames.header}>
        {/* The arrows are RAC Buttons rather than this package's `Button`: they take their
            behaviour from the calendar through `slot`, which the public component does not
            forward, and a square icon-only control is not what that component's size axis
            describes. The glyph is a pure-CSS chevron owned by the recipe — see `navIcon` in
            calendar.recipe.ts — and `aria-hidden` because the Button already carries react-aria's
            localised "Previous"/"Next" name. */}
        <Button slot="previous" className={classNames.navButton}>
          <span aria-hidden="true" data-direction="previous" className={classNames.navIcon} />
        </Button>
        <Heading className={classNames.heading} />
        <Button slot="next" className={classNames.navButton}>
          <span aria-hidden="true" data-direction="next" className={classNames.navIcon} />
        </Button>
      </div>
      <CalendarGrid className={classNames.grid}>
        <CalendarGridHeader>
          {(day) => (
            <CalendarHeaderCell className={classNames.headerCell}>{day}</CalendarHeaderCell>
          )}
        </CalendarGridHeader>
        <CalendarGridBody>
          {(date) => <CalendarCell date={date} className={classNames.cell} />}
        </CalendarGridBody>
      </CalendarGrid>
      {/* Renders nothing at all while the calendar is valid — the same measured RAC behaviour
          Input and DateField rely on. */}
      <FieldError className={classNames.error}>{errorMessage}</FieldError>
    </AriaCalendar>
  );
}
