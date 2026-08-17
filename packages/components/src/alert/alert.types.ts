import type { ReactNode } from "react";
import type { alertRecipe } from "./alert.recipe.js";

export type AlertTone = keyof typeof alertRecipe.variants.tone;

/**
 * Hand-picked, never a re-export of anything: Alert renders a plain element (no
 * react-aria-components), so there is no upstream prop type to diverge from in the first place.
 *
 * `tone` is required, not optional. An Alert without a stated tone is a caller bug: a default
 * would silently pick a semantic meaning the caller never stated, unlike Button's
 * `visual: "solid"`, which is a safe neutral default (see alert.recipe.ts).
 *
 * Content is plain `children`, not typed content props: unlike the overlays (ADR-0005 D4),
 * `role="alert"`/`role="status"` accept arbitrary content, so there is no structural ARIA
 * constraint a typed prop would need to enforce.
 */
export type AlertProps = {
  readonly tone: AlertTone;
  readonly children: ReactNode;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
