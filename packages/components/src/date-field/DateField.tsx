"use client";

import {
  DateField as AriaDateField,
  DateInput,
  DateSegment,
  FieldError,
  Label,
  Text,
} from "react-aria-components";
import { calendarDateToIso, isoToCalendarDate } from "../internal/iso-date.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { dateFieldRecipe } from "./date-field.recipe.js";
import type { DateFieldProps } from "./date-field.types.js";

/**
 * A date entered by typing, one segment at a time. No calendar — that is `Calendar`, and the two
 * composed behind a popover is `DatePicker`.
 *
 * This is the first component in the package whose props are TRANSLATED rather than forwarded:
 * `value`/`defaultValue`/`minValue`/`maxValue` arrive as ISO strings and are parsed on the way in,
 * `onChange` is serialised on the way out. `../internal/iso-date.ts` holds why the public API
 * refuses react-aria's `CalendarDate`.
 *
 * `clientOnly: true` for the ordinary upstream reason rather than a judgement call: RAC 1.20's
 * `dist/types/exports/DateField.d.ts` reaches `react-stately`, and the export does
 * `import 'client-only'`.
 */
export function DateField({
  label,
  description,
  errorMessage,
  size,
  value,
  defaultValue,
  minValue,
  maxValue,
  onChange,
  ...behaviour
}: DateFieldProps) {
  // Every slot gets an explicit className, for the same reason Input does it: RAC applies its own
  // `react-aria-DateField` / `react-aria-DateSegment` classes when className is omitted, and those
  // would ship as public API surface consumers could target.
  const classNames = slotRecipeClassNames(dateFieldRecipe, { size });

  // `value` and `defaultValue` are forwarded as two separate props rather than merged, because
  // RAC distinguishes controlled from uncontrolled by which one is PRESENT. Passing
  // `value: undefined` explicitly would look controlled-then-undefined to React and warn.
  const controlled = value === undefined ? {} : { value: isoToCalendarDate(value) };
  const uncontrolled =
    defaultValue === undefined ? {} : { defaultValue: isoToCalendarDate(defaultValue) };

  return (
    <AriaDateField
      {...behaviour}
      {...controlled}
      {...uncontrolled}
      // A bound that cannot be parsed is dropped rather than applied: an unparseable `minValue`
      // must not silently become "no date is selectable".
      minValue={isoToCalendarDate(minValue) ?? undefined}
      maxValue={isoToCalendarDate(maxValue) ?? undefined}
      onChange={onChange === undefined ? undefined : (date) => onChange(calendarDateToIso(date))}
      className={classNames.root}
    >
      <Label className={classNames.label}>{label}</Label>
      <DateInput className={classNames.input}>
        {(segment) => <DateSegment segment={segment} className={classNames.segment} />}
      </DateInput>
      {description !== undefined && (
        <Text slot="description" className={classNames.description}>
          {description}
        </Text>
      )}
      {/* Renders nothing at all while the field is valid — the same measured RAC behaviour Input
          relies on, so no empty element occupies layout in the common case. */}
      <FieldError className={classNames.error}>{errorMessage}</FieldError>
    </AriaDateField>
  );
}
