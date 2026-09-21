import type { IsoDate } from "../internal/iso-date.js";

export type CalendarProps = {
  /**
   * The calendar's accessible name.
   *
   * Required, not optional, for the same reason every field's label is: a month grid with no name
   * is announced as an unlabelled application, and the blocking accessibility gate refuses it. It
   * is not rendered visibly — the visible heading is the MONTH, which changes as the user pages
   * and therefore cannot serve as the control's name.
   */
  readonly label: string;
  /**
   * The selected date as an ISO 8601 calendar date: `"2026-09-21"`.
   *
   * A string for the same two reasons `DateField` takes one — a `Date` is a timestamp, and a
   * `CalendarDate` would drag `@internationalized/date` into the public API. `internal/iso-date.ts`
   * holds the argument. An unparseable value selects nothing rather than throwing.
   */
  readonly value?: IsoDate | null;
  readonly defaultValue?: IsoDate | null;
  /** Earliest selectable date, ISO. Unparseable values are ignored rather than throwing. */
  readonly minValue?: IsoDate;
  /** Latest selectable date, ISO. Unparseable values are ignored rather than throwing. */
  readonly maxValue?: IsoDate;
  /**
   * Blocks individual days — holidays, booked dates, weekends.
   *
   * Receives an ISO string, NOT a `CalendarDate`. This is the back door the front door was closed
   * against: a predicate typed over react-aria's value would put that type in the public API just
   * as surely as the `value` prop would have, and a consumer would have to install the date
   * library to write `date.dayOfWeek > 5`. An ISO string keeps the whole surface primitive.
   *
   * Blocked days remain FOCUSABLE — react-aria keeps them in the roving tabindex so a keyboard
   * user can tell a blocked day from one that is simply absent — which is why `calendar.recipe.ts`
   * styles them with a contrast-checked colour and a strikethrough rather than dimming them.
   */
  readonly isDateUnavailable?: (date: IsoDate) => boolean;
  readonly isDisabled?: boolean;
  readonly isReadOnly?: boolean;
  readonly isInvalid?: boolean;
  /**
   * Rendered only while the calendar is invalid. Supplying it does not by itself mark the calendar
   * invalid — pass `isInvalid` for that.
   */
  readonly errorMessage?: string;
  /**
   * Called with the ISO date of the day the user picked.
   *
   * No `null` branch, unlike `DateField`'s: a calendar has no way to express "cleared" — clicking
   * the selected day re-selects it rather than unselecting it. A consumer that needs a clear
   * affordance owns that button.
   */
  readonly onChange?: (value: IsoDate) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
