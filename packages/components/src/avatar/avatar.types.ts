import type { avatarRecipe } from "./avatar.recipe.js";

export type AvatarSize = keyof typeof avatarRecipe.variants.size;
export type AvatarShape = keyof typeof avatarRecipe.variants.shape;

/**
 * Hand-picked, never a re-export of anything: Avatar renders plain elements (no
 * react-aria-components), so there is no upstream prop type to diverge from.
 */
export type AvatarProps = {
  /**
   * WHO THIS IS. Required, and it does three jobs at once rather than one — which is why it is a
   * single prop instead of the `alt` + `fallback` pair most libraries expose.
   *
   * It is the accessible name, carried on the root as `aria-label`. It is the source of the
   * initials drawn when there is no image or the image fails. And it is what makes an unnamed
   * avatar impossible to construct: a picture of a person with no name attached is a
   * `role="img"` that announces nothing, which is exactly the defect the blocking axe gate exists
   * to catch.
   *
   * Splitting it would let the three drift. `alt="Profile photo"` with `fallback="AB"` is a
   * perfectly typeable call that announces the wrong thing and draws initials belonging to nobody.
   */
  readonly name: string;
  /**
   * The image, when there is one. Absent is a first-class state rather than an error case: most
   * people in most systems have no photo, so the initials are the normal appearance and the
   * photograph is the enhancement.
   *
   * A src that FAILS to load lands in the same place, with no state and no flash — the initials
   * are already underneath it. See the argument in `avatar.recipe.ts`.
   */
  readonly src?: string;
  readonly size?: AvatarSize;
  /**
   * `circle` (the default) or `rounded`. Conventionally people are circles and organisations are
   * squared off; nothing here enforces that, because it is a convention rather than a rule and it
   * is not the same convention everywhere.
   */
  readonly shape?: AvatarShape;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
