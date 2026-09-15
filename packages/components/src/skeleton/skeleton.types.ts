import type { skeletonRecipe } from "./skeleton.recipe.js";

export type SkeletonShape = keyof typeof skeletonRecipe.variants.shape;
export type SkeletonWidth = keyof typeof skeletonRecipe.variants.width;

/**
 * Hand-picked, never a re-export of anything: Skeleton renders a plain element (no
 * react-aria-components), so there is no upstream prop type to diverge from in the first place.
 *
 * NO `children`, AND THAT IS THE LOAD-BEARING OMISSION. Some libraries let a skeleton wrap the
 * real content and hide it, so the placeholder inherits the exact size of the thing it replaces.
 * That is a sizing escape hatch wearing a content prop's clothes, and it would put arbitrary
 * markup inside an element this component hides from assistive tech (see Skeleton.tsx) — text a
 * screen reader can never reach, in a tree a consumer can never reason about. Sizing is what
 * `shape` and `width` are for, and they are the entire answer.
 *
 * Both axes are optional. A shape asserts nothing about meaning the way Alert's tone does, so
 * defaulting costs nothing — the argument is in skeleton.recipe.ts.
 */
export type SkeletonProps = {
  /** What the placeholder stands in for: a line of body copy, a heading line, or a panel. */
  readonly shape?: SkeletonShape;
  /** Inline extent, as a fraction of the container the consumer put the skeleton in. */
  readonly width?: SkeletonWidth;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
