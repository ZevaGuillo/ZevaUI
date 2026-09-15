import type { spinnerRecipe } from "./spinner.recipe.js";

export type SpinnerSize = keyof typeof spinnerRecipe.variants.size;

export type SpinnerLabelVisibility = keyof typeof spinnerRecipe.variants.labelVisibility;

export type SpinnerProps = {
  /**
   * What is busy, and therefore the accessible name. Required for the same reason `Progress`'s and
   * `Input`'s are: a control without a programmatic name fails the blocking accessibility gate, so
   * the type system refuses it rather than letting a story catch it later. "Loading" is a fine
   * default sentence for a consumer to pass, but this component will not invent one — a spinner
   * that names itself says the same thing everywhere on the page, which is the same as saying
   * nothing.
   *
   * `string`, not `ReactNode`: it is rendered into a span react-aria-components points
   * `aria-labelledby` at, and a name assembled from arbitrary markup is a name nobody can predict.
   */
  readonly label: string;
  /**
   * Whether `label` is DRAWN. It is always present in the DOM and always the accessible name —
   * this only chooses whether a sighted user reads it too.
   *
   * Defaults to `"hidden"`, which is the spinner people mean: a bare ring in a button, a cell, or
   * the corner of a card. `"visible"` puts the text beside the ring, which is the right shape when
   * the spinner owns a whole region and there is nothing else on screen to say what is happening.
   *
   * This is a prop rather than something a consumer hides with their own CSS because `className`
   * is `never` in this package: with no escape hatch, a layout knob a consumer genuinely needs has
   * to be a real typed prop. Hiding it is done with the clip-rect pattern, never `display: none` —
   * that would drop the element from the accessibility tree and leave the spinner unnamed.
   */
  readonly labelVisibility?: SpinnerLabelVisibility;
  /**
   * The ring's outer diameter, derived from the body type scale rather than fixed in pixels.
   * Defaults to `"md"`.
   */
  readonly size?: SpinnerSize;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
