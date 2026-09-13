import type { ReactNode } from "react";
import type { badgeRecipe } from "./badge.recipe.js";

export type BadgeTone = keyof typeof badgeRecipe.variants.tone;

/**
 * Hand-picked, never a re-export of anything: Badge renders a plain element (no
 * react-aria-components), so there is no upstream prop type to diverge from in the first place.
 *
 * `tone` is optional, unlike Alert's. `neutral` asserts nothing about the label it wraps, so
 * defaulting to it invents no meaning — the argument is in badge.recipe.ts.
 *
 * Content is plain `children`, not typed content props: a badge has no ARIA role and no
 * collection, so there is no structural constraint a typed prop would need to enforce (the
 * reasoning ADR-0005 D4 applies to the overlays does not reach here, exactly as it does not
 * reach Alert).
 */
export type BadgeProps = {
  readonly children: ReactNode;
  readonly tone?: BadgeTone;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
