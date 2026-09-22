import type { IsoDate } from "../internal/iso-date.js";
import type { datePickerRecipe } from "./date-picker.recipe.js";

export type DatePickerSize = keyof typeof datePickerRecipe.variants.size;

export type DatePickerProps = {
  /**
   * The field's visible label.
   *
   * Required, not optional, for the same reason every field's is: a control without a programmatic
   * label fails the blocking accessibility gate. It does double duty here — it also names the
   * calendar inside the popover, which react-aria composes with the visible month into
   * `"Trip date, September 2026"`, so a screen reader user always knows which field the open panel
   * belongs to.
   */
  readonly label: string;
  /** Wired to the field through aria-describedby by react-aria-components. */
  readonly description?: string;
  /**
   * Rendered only while the field is invalid, and announced through aria-describedby. Supplying it
   * does not by itself mark the field invalid — pass `isInvalid` for that.
   *
   * Stated ONCE, under the field. The `Calendar` inside the popover renders a `FieldError` of its
   * own and it stays silent, so an invalid picker never says the same sentence twice;
   * `__tests__/date-picker.test.ts` pins that.
   */
  readonly errorMessage?: string;
  readonly size?: DatePickerSize;
  readonly name?: string;
  /**
   * The selected date as an ISO 8601 calendar date: `"2026-09-21"`.
   *
   * One primitive string drives BOTH halves of this component — the typed segments and the month
   * grid. A `Date` is a timestamp and a `CalendarDate` is react-aria's type; `date-field.types.ts`
   * holds the full argument against each, and `../internal/iso-date.ts` the measurement behind it.
   *
   * `null` is the cleared field. An unparseable string is treated as cleared rather than thrown.
   */
  readonly value?: IsoDate | null;
  readonly defaultValue?: IsoDate | null;
  /**
   * Earliest selectable date, ISO. Unparseable values are ignored rather than throwing.
   *
   * Applied to the field AND to the calendar: react-aria carries it into the panel through context,
   * so days before it are announced as disabled rather than silently rejected on click.
   */
  readonly minValue?: IsoDate;
  /** Latest selectable date, ISO. Unparseable values are ignored rather than throwing. */
  readonly maxValue?: IsoDate;
  /**
   * Blocks individual days — holidays, booked dates, weekends.
   *
   * Receives an ISO string, NOT a `CalendarDate`, for the reason `calendar.types.ts` gives at
   * length: a predicate typed over react-aria's value would put that type back in the public API
   * through the back door, and a consumer would have to install the date library to write
   * `date.dayOfWeek > 5`.
   */
  readonly isDateUnavailable?: (date: IsoDate) => boolean;
  readonly isDisabled?: boolean;
  readonly isRequired?: boolean;
  readonly isInvalid?: boolean;
  readonly isReadOnly?: boolean;
  /**
   * Called with the ISO date, or `null` when the user clears the field.
   *
   * The `null` branch exists here and not on `Calendar`, and the asymmetry is real rather than an
   * oversight: a month grid cannot express "cleared" — clicking the selected day re-selects it —
   * but this component's segments can be emptied with the keyboard, which is a reachable state a
   * controlled form has to be able to tell apart from "never set".
   */
  readonly onChange?: (value: IsoDate | null) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};

/**
 * WHAT THIS COMPONENT DELIBERATELY DOES NOT TAKE, so the omissions read as decisions:
 *
 * - **`placement`.** `Tooltip` and `Popover` expose one because the consumer attaches them to
 *   arbitrary content and only they know where the room is. This panel belongs to the field
 *   directly above it: react-aria anchors it below and flips it above when the viewport is short,
 *   which is the entire decision. An axis here would let a caller aim a calendar at the left of a
 *   field for no reason the layout could justify — and it would oblige the recipe to carry four
 *   placement animations of which two could never fire.
 *
 * - **A range.** `DateRangePicker` is a different component with a different state shape (two
 *   values, a `RangeCalendar`, and a whole vocabulary of "start"/"end" the segments have to carry).
 *   Widening this one to cover it would make every prop above conditional on a mode flag. It was
 *   measured at 77,652 B isolated against this one's 76,446 B, so it is not being avoided on cost
 *   — it is being kept a separate component because it is one.
 *
 * - **A time.** An ISO calendar date has no instant, which is the property that makes it the right
 *   primitive here (see date-field.types.ts). A date-and-time control needs a value that carries a
 *   timezone, so it needs its own argument about its own public API rather than this one widened.
 */
