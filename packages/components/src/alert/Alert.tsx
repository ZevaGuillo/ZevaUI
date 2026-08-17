import { recipeClassName } from "../internal/recipe-class.js";
import { alertRecipe } from "./alert.recipe.js";
import type { AlertProps } from "./alert.types.js";

/**
 * The second server-renderable component after Card: Alert needs no react-aria-components and
 * no hooks, so it carries no "use client" directive.
 *
 * Role is derived from `tone`, never a prop: `danger` and `warning` get `role="alert"` (an
 * implicit assertive live region), `success` gets `role="status"` (an implicit polite live
 * region). Neither needs a manual `aria-live` attribute — the role itself already carries the
 * correct live-region politeness.
 */
const ROLE_BY_TONE = {
  danger: "alert",
  success: "status",
  warning: "alert",
} as const;

export function Alert({ tone, children }: AlertProps) {
  return (
    <div role={ROLE_BY_TONE[tone]} className={recipeClassName(alertRecipe, { tone })}>
      {children}
    </div>
  );
}
