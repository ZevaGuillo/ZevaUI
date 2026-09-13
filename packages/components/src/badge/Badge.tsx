import { recipeClassName } from "../internal/recipe-class.js";
import { badgeRecipe } from "./badge.recipe.js";
import type { BadgeProps } from "./badge.types.js";

/**
 * The third server-renderable component, after Card and Alert: Badge needs no
 * react-aria-components and no hooks, so it carries no "use client" directive.
 *
 * A `<span>` with NO role, and that absence is the design. Alert derives a live-region role from
 * its tone because an alert interrupts; a badge does not announce, it annotates — it has no
 * focus, no pointer behaviour and nothing to operate, so there is no role in the ARIA taxonomy
 * that describes it and `role="status"` would turn a static label into a live region that
 * re-announces itself on every render.
 *
 * The consequence is a contract on the CALLER, not a gap: whatever meaning the tone's colour
 * carries has to be in the text too, because a screen reader hears only the text. That is WCAG
 * 1.4.1 (use of colour) and it is why no story here ships a badge whose content is empty.
 */
export function Badge({ tone, children }: BadgeProps) {
  return <span className={recipeClassName(badgeRecipe, { tone })}>{children}</span>;
}
