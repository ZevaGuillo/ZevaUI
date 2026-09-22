"use client";

import {
  DatePicker as AriaDatePicker,
  Dialog as AriaDialog,
  Popover as AriaPopover,
  Button,
  DateInput,
  DateSegment,
  FieldError,
  Group,
  Label,
  Text,
} from "react-aria-components";
import { Calendar } from "../calendar/Calendar.js";
import { calendarDateToIso, isoToCalendarDate } from "../internal/iso-date.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { datePickerRecipe } from "./date-picker.recipe.js";
import type { DatePickerProps } from "./date-picker.types.js";

/**
 * A date typed into segments, or picked from a calendar in a popover. The two halves of the date
 * set, joined — `DateField` is the first alone, `Calendar` the second.
 *
 * THE PANEL IS THIS PACKAGE'S OWN `Calendar`, NOT A SECOND MONTH GRID WRITTEN FOR A POPOVER, and
 * that was measured before it was decided. A probe rendered our public `Calendar` inside RAC's
 * `DatePicker` and checked the three things that could have made it impossible:
 *
 *   1. Does the picker's value reach it? Yes — react-aria passes the calendar's props down through
 *      context, and our component forwards the `...behaviour` rest it does not consume.
 *   2. Do our explicit `undefined`s wipe the picker's own state? NO, and this was the real
 *      question. `Calendar.tsx` always passes `minValue`, `maxValue`, `onChange` and
 *      `isDateUnavailable` as props, spelling them `undefined` when the consumer gave none —
 *      and react-aria's `mergeProps` ignores an `undefined` local value rather than letting it
 *      override the context. Had it not, opening the panel would have silently cleared the
 *      picker's bounds and broken selection outright. `date-picker.test.ts` pins it.
 *   3. Does the inner `FieldError` duplicate the picker's message? No — it renders nothing,
 *      because it is handed no `errorMessage` of its own.
 *
 * The alternative was to render RAC's `Calendar` primitives here with `calendarRecipe`'s class
 * names. That would have duplicated the month grid's MARKUP — the header, the two paging arrows,
 * the grid body, the pure-CSS chevrons — in a second file, and this package already has one story
 * about what a paste of a near-identical implementation costs: `Textarea` was written by copying
 * `Input` and inherited a real bug through the copy. The calendar a consumer sees in the popover
 * is now, structurally, the calendar they see standalone.
 *
 * `clientOnly: true` for the ordinary upstream reason rather than a judgement call: RAC 1.20's
 * `dist/types/exports/DatePicker.d.ts` reaches `react-stately`, and the export does
 * `import 'client-only'`.
 */
export function DatePicker({
  label,
  description,
  errorMessage,
  size,
  value,
  defaultValue,
  minValue,
  maxValue,
  isDateUnavailable,
  onChange,
  ...behaviour
}: DatePickerProps) {
  // Every slot gets an explicit className, for the same reason Input and DateField do it: RAC
  // applies its own `react-aria-DatePicker` / `react-aria-Group` classes when className is
  // omitted, and those would ship as public API surface consumers could target.
  const slots = slotRecipeClassNames(datePickerRecipe, { size });

  // `value` and `defaultValue` are forwarded as two separate props rather than merged, because
  // RAC distinguishes controlled from uncontrolled by which one is PRESENT. Passing
  // `value: undefined` explicitly would look controlled-then-undefined to React and warn.
  const controlled = value === undefined ? {} : { value: isoToCalendarDate(value) };
  const uncontrolled =
    defaultValue === undefined ? {} : { defaultValue: isoToCalendarDate(defaultValue) };

  return (
    <AriaDatePicker
      {...behaviour}
      {...controlled}
      {...uncontrolled}
      // A bound that cannot be parsed is dropped rather than applied: an unparseable `minValue`
      // must not silently become "no date is selectable".
      minValue={isoToCalendarDate(minValue) ?? undefined}
      maxValue={isoToCalendarDate(maxValue) ?? undefined}
      // `date.toString()` on a CalendarDate is already the zero-padded ISO form, so the predicate
      // the consumer wrote against strings receives exactly what `value` speaks.
      isDateUnavailable={
        isDateUnavailable === undefined ? undefined : (date) => isDateUnavailable(date.toString())
      }
      onChange={onChange === undefined ? undefined : (date) => onChange(calendarDateToIso(date))}
      className={slots.root}
    >
      {/*
        The render-prop form is load-bearing, not a style, exactly as in `Select.tsx`: RAC 1.20
        puts `data-open` on the ROOT, and the chevron is a `<span>` that carries nothing. Reading
        it back down with an ancestor-conditioned selector is the approach `checkbox.recipe.ts`
        rejected — an unqualified attribute matches on ANY ancestor carrying it — so it is stamped
        onto the one part that needs it and every rule in the recipe stays a local `&[data-*]`.
      */}
      {({ isOpen }) => (
        <>
          <Label className={slots.label}>{label}</Label>
          {/*
            The `Group` is the control's boundary and the trigger lives INSIDE it. A button next to
            the box would read as a separate control that happens to sit nearby, and a `DateInput`
            may contain only segments — so the composite wrapper react-aria provides for exactly
            this shape is what carries the border, the focus ring and the accessible name.
          */}
          <Group className={slots.group}>
            <DateInput className={slots.input}>
              {(segment) => <DateSegment segment={segment} className={slots.segment} />}
            </DateInput>
            {/*
              A RAC `Button`, not this package's `Button`, for the reason `Calendar.tsx` gives about
              its paging arrows: it takes its behaviour from the picker through context, which the
              public component does not forward, and a square icon-only control is not what that
              component's size and visual axes describe.

              NO CHILDREN AND NO LABEL OF OUR OWN — measured, not assumed. `useDatePicker` stamps a
              localised `aria-label="Calendar"` onto this button and composes it with the field's
              label, so the rendered name is already "Calendar, Trip date" in the user's language.
              Any text put here would be overridden by that attribute, and a hand-written English
              label would have been a regression in every other locale. The glyph is therefore pure
              decoration and `aria-hidden`.
            */}
            <Button className={slots.trigger}>
              <span
                aria-hidden="true"
                className={slots.triggerIcon}
                data-open={isOpen || undefined}
              />
            </Button>
          </Group>
          {description !== undefined && (
            <Text slot="description" className={slots.description}>
              {description}
            </Text>
          )}
          {/* Renders nothing at all while the field is valid — the same measured RAC behaviour
              Input, DateField and Calendar rely on, so no empty element occupies layout in the
              common case. */}
          <FieldError className={slots.error}>{errorMessage}</FieldError>
          <AriaPopover className={slots.popover}>
            <AriaDialog className={slots.dialog}>
              {/*
                The field's label names the calendar too, which is what makes an open panel
                traceable back to the control it belongs to: react-aria composes it with the
                visible month into "Trip date, September 2026".

                Nothing else is passed. The value, the bounds and `isDateUnavailable` all reach it
                through react-aria's context from the picker above — see the argument at the top of
                this file, and the test that proves the context wins over our `undefined`s.
              */}
              <Calendar label={label} />
            </AriaDialog>
          </AriaPopover>
        </>
      )}
    </AriaDatePicker>
  );
}
