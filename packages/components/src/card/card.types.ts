import type { ReactNode } from "react";
import type { cardRecipe } from "./card.recipe.js";

export type CardSurface = keyof typeof cardRecipe.variants.surface;

/**
 * Hand-picked, never a re-export of anything: Card renders plain elements only (no
 * react-aria-components), so there is no upstream prop type to diverge from in the first place.
 *
 * Card composes through typed slot PARTS (`Card.Header`, `Card.Body`, `Card.Footer`), not a
 * `children`-only content prop like Dialog/Menu — see card.recipe.ts for why that split is
 * correct rather than a contradiction of ADR-0005 D4.
 */
export type CardProps = {
  readonly children: ReactNode;
  readonly surface?: CardSurface;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};

/** Shared shape of every Card part (`Header`, `Body`, `Footer`): content only, no styling escape hatch. */
export type CardPartProps = {
  readonly children: ReactNode;
  readonly className?: never;
  readonly style?: never;
};
