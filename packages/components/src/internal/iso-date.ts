import { type CalendarDate, parseDate } from "@internationalized/date";

/**
 * The one place this package translates between the ISO date strings its public API speaks and
 * the `CalendarDate` values react-aria-components requires.
 *
 * WHY THIS MODULE EXISTS AT ALL. Every other component in this package takes primitives — string,
 * number, boolean, ReactNode — and a date control is the first one whose upstream API does not.
 * RAC's `DateField` is generic over `DateValue`, and constructing one of those means the CONSUMER
 * installs and imports `@internationalized/date`. That would make a third-party type part of this
 * package's public surface, in a library whose whole argument is that it owns its own API
 * (`className` is `never`, layout arrives as typed props). So the dependency stays INTERNAL: it is
 * a direct dependency of @zevaui/components, bundled, and never named in a public type.
 *
 * The measured cost of that choice is 24 bytes gzip. RAC already bundles
 * `@internationalized/date` to implement `DateField`, so importing `parseDate` beside it adds
 * almost nothing — and the tree-shaken import drops the eleven non-Gregorian calendars the full
 * package carries (3,613 B for what we use, against 11,222 B for the whole module).
 *
 * THE PRICE. ISO strings cannot express a non-Gregorian calendar or a timezone. That is the half
 * of RAC's API this boundary deliberately gives up; see date-field.types.ts for the scope that
 * follows from it.
 */

/** ISO 8601 calendar date, zero-padded: `YYYY-MM-DD`. */
export type IsoDate = string;

/**
 * Parses an ISO date, returning `null` for anything unparseable.
 *
 * `parseDate` THROWS on malformed input, and a design system that takes down the host application
 * because a prop held `"2026-9-1"` instead of `"2026-09-01"` is a trap rather than a contract. The
 * public components therefore route every consumer-supplied string through here, where a bad value
 * degrades to "no date" — the same state an empty field is already in, so nothing downstream needs
 * a third case.
 *
 * This is the one behaviour the ISO decision costs, and it is paid once here rather than at each
 * call site. `__tests__/iso-date.test.ts` pins every malformed shape it swallows.
 */
export const isoToCalendarDate = (value: IsoDate | null | undefined): CalendarDate | null => {
  if (value === null || value === undefined || value === "") return null;
  try {
    return parseDate(value);
  } catch {
    return null;
  }
};

/**
 * The strict twin, for internal call sites that have already validated their input.
 *
 * Nothing reachable from the public API calls this: it exists so that an internal bug surfaces as
 * a real failure instead of silently becoming an empty field, which is exactly the outcome
 * `isoToCalendarDate` is designed to produce for CONSUMER input and would be wrong for our own.
 */
export const isoToCalendarDateOrThrow = (value: IsoDate): CalendarDate => parseDate(value);

/**
 * Serialises back to a zero-padded ISO date, preserving `null` for a cleared field.
 *
 * `CalendarDate#toString()` already emits `YYYY-MM-DD`; this wrapper exists for the null branch,
 * so that callers never have to spell the cleared case themselves.
 */
export const calendarDateToIso = (date: CalendarDate | null | undefined): IsoDate | null =>
  date === null || date === undefined ? null : date.toString();
