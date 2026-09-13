import type { progressRecipe } from "./progress.recipe.js";

export type ProgressSize = keyof typeof progressRecipe.variants.size;

export type ProgressProps = {
  /**
   * The visible label, and therefore the accessible name. Required for the same reason `Input`'s
   * is: a progress bar without a programmatic name fails the blocking accessibility gate, so the
   * type system refuses it rather than letting a story catch it later. Use a visually-hidden
   * pattern at the consumer level if a visible label is unwanted — that is a layout decision, not
   * a reason to ship an unnamed control.
   *
   * `string`, not `ReactNode`: it is rendered into a span react-aria-components points
   * `aria-labelledby` at, and a name assembled from arbitrary markup is a name nobody can predict.
   */
  readonly label: string;
  /** Clamped between `minValue` and `maxValue` by react-aria-components. Defaults to 0. */
  readonly value?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  /**
   * How the value is formatted for `aria-valuetext` and the visible value text. Defaults to
   * `{ style: "percent" }`, which formats the POSITION IN THE RANGE rather than the raw value —
   * measured in react-aria's `useProgressBar`, which formats `percentage` for the percent style
   * and `value` for every other one. So `value={5} maxValue={10}` reads "50%" by default and "5"
   * under `{ style: "decimal" }`.
   */
  readonly formatOptions?: Intl.NumberFormatOptions;
  /**
   * Replaces the formatted text outright — "5 of 10" instead of "50%".
   *
   * `string`, not react-aria-components' `ReactNode`: this value lands in `aria-valuetext`, which
   * is a DOM attribute. A node there would stringify into something no assistive tech can read.
   */
  readonly valueLabel?: string;
  /**
   * Progress of unknown extent. The bar sweeps instead of filling, no value text is rendered, and
   * `aria-valuenow`/`aria-valuetext` are dropped — which is exactly what react-aria-components'
   * own `:not([aria-valuenow])` selector keys off.
   *
   * For a busy indicator with no measurable extent at all, reach for `Spinner`, not for this flag:
   * an indeterminate `Progress` still claims a bar-shaped operation is under way.
   */
  readonly isIndeterminate?: boolean;
  readonly size?: ProgressSize;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
