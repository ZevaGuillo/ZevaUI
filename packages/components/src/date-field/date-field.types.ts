import type { IsoDate } from "../internal/iso-date.js";
import type { dateFieldRecipe } from "./date-field.recipe.js";

/**
 * Re-exported from the component that owns it rather than from `internal/`, so the public surface
 * keeps its one rule: a consumer imports types from the component they are using, never from a
 * path this package does not promise to keep.
 */
export type { IsoDate } from "../internal/iso-date.js";

export type DateFieldSize = keyof typeof dateFieldRecipe.variants.size;

export type DateFieldProps = {
  /**
   * Required, not optional, for the same reason Input's is: a field without a programmatic label
   * fails the blocking accessibility gate, so the type system refuses it rather than letting a
   * story catch it later.
   */
  readonly label: string;
  /** Wired to the input through aria-describedby by react-aria-components. */
  readonly description?: string;
  /**
   * Rendered only while the field is invalid, and announced through aria-describedby. Supplying
   * it does not by itself mark the field invalid — pass `isInvalid` for that.
   */
  readonly errorMessage?: string;
  readonly size?: DateFieldSize;
  readonly name?: string;
  /**
   * The selected date as an ISO 8601 calendar date: `"2026-09-21"`.
   *
   * A STRING, not a `Date` and not a `CalendarDate`, and each exclusion is deliberate:
   *
   * - `Date` is a timestamp. Putting one here would mean a date picked in Buenos Aires can read
   *   as the previous day in Berlin, because the value carries an instant the consumer never
   *   asked for. A calendar date has no instant, and an ISO string is the only primitive that
   *   says so.
   * - `CalendarDate` is react-aria's type, and accepting it would force every consumer to install
   *   and import `@internationalized/date` to pass a date in — making a third-party type part of
   *   this package's public API. `../internal/iso-date.ts` holds that argument and the 24-byte
   *   measurement behind it.
   *
   * `null` is the cleared field. An unparseable string is treated as cleared rather than thrown,
   * so a bad value degrades instead of taking down the render; `__tests__/iso-date.test.ts` pins
   * every shape that degrades.
   *
   * WHAT THIS GIVES UP: non-Gregorian calendars and timezones. Both are expressible in RAC's own
   * API and neither is expressible in an ISO calendar date. A future component that genuinely
   * needs them will have to make its own argument rather than widening this one.
   */
  readonly value?: IsoDate | null;
  readonly defaultValue?: IsoDate | null;
  /** Earliest selectable date, ISO. Unparseable values are ignored rather than throwing. */
  readonly minValue?: IsoDate;
  /** Latest selectable date, ISO. Unparseable values are ignored rather than throwing. */
  readonly maxValue?: IsoDate;
  readonly isDisabled?: boolean;
  readonly isRequired?: boolean;
  readonly isInvalid?: boolean;
  readonly isReadOnly?: boolean;
  /**
   * Called with the ISO date, or `null` when the user clears the field.
   *
   * The `null` branch is not an edge case to paper over: a date field with every segment blank is
   * a real, reachable state, and collapsing it to `""` would make "cleared" and "never set"
   * indistinguishable to a consumer driving a controlled form.
   */
  readonly onChange?: (value: IsoDate | null) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
