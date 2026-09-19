import type { separatorRecipe } from "./separator.recipe.js";

export type SeparatorOrientation = keyof typeof separatorRecipe.variants.orientation;

/**
 * Hand-picked, never a re-export: `Separator` renders a plain `<hr>` and imports no
 * react-aria-components, so there is no upstream prop type to diverge from.
 *
 * There is no `children` here, and that is the shape of the element rather than an omission —
 * `<hr>` is void content. A divider with a label in the middle of it ("or", "Today") is a real
 * pattern and a DIFFERENT component: it needs a background matching the surface behind it to punch
 * a hole through the line, and which surface it sits on is a thing this one cannot know.
 */
export type SeparatorProps = {
  /**
   * Which way the rule runs. `vertical` requires a flex or grid parent to take its height from —
   * see the argument in `separator.recipe.ts`. In normal flow it renders with no height and is
   * invisible.
   */
  readonly orientation?: SeparatorOrientation;
  /**
   * Whether the line is decoration rather than structure.
   *
   * THE DEFAULT IS `false`, AND THAT IS THE LOAD-BEARING HALF. A separator's whole purpose is to
   * say "these two things are separate", and `role="separator"` is how that reaches someone
   * navigating by structure instead of by sight — for whom the drawn line does not exist at all.
   * Defaulting to decorative would make the common case the silent one.
   *
   * Set it when the division is ALREADY announced by something else and the line merely repeats
   * it: between two `<section>` elements that each carry their own heading, or inside a control
   * whose own role already groups its parts. A second announcement of a boundary a screen-reader
   * user was just told about is noise, and noise is what makes people turn structural navigation
   * off entirely.
   */
  readonly decorative?: boolean;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
