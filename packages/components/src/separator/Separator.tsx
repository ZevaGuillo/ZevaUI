import { recipeClassName } from "../internal/recipe-class.js";
import { separatorRecipe } from "./separator.recipe.js";
import type { SeparatorProps } from "./separator.types.js";

/**
 * The fifth server-renderable component, after Card, Alert, Badge and Skeleton: nothing here needs
 * react-aria-components or a hook, so it carries no "use client" directive.
 *
 * That matters more for this component than for the other four. A divider is the single most
 * likely thing to appear in a server-rendered marketing page or document layout, and
 * react-aria-components' own `Separator` could not be used there at all — its 1.20 entry point
 * (`dist/types/exports/Separator.d.ts`) does `import 'client-only'`, which is a build-time error
 * inside a React Server Component. A handful of lines of `<hr>` buys back a whole rendering
 * environment.
 *
 * `<hr>` IN BOTH ORIENTATIONS, WHICH IS A CHOICE AND NOT THE ONLY ONE. The alternative is a
 * `<div role="separator">` for the vertical case, on the reading that `<hr>` means "thematic break
 * between paragraphs". But `<hr>`'s implicit ARIA role IS `separator`, and ARIA's own mechanism
 * for saying which way a separator runs is `aria-orientation` — so one element plus one attribute
 * expresses the whole thing, while branching on the element would mint two DOM shapes for one
 * component and give a consumer's own `hr` stylesheet rule an inconsistent target.
 *
 * `aria-orientation` IS OMITTED FOR HORIZONTAL RATHER THAN SET TO "horizontal". That is already
 * the implicit value for `role="separator"`, so writing it changes nothing in any accessibility
 * tree and only adds an attribute a reader has to check against the spec to know is redundant.
 */
export function Separator({ orientation, decorative }: SeparatorProps) {
  // `orientation` is left possibly-undefined on purpose: `recipeClassName` resolves it through the
  // recipe's own `defaultVariants`, so the default lives in exactly one place. The check below
  // needs no default of its own either — `undefined` is not `"vertical"`, which is the same answer.
  const className = recipeClassName(separatorRecipe, { orientation });

  // `role="presentation"` rather than `aria-hidden`: the element has no content and no focusable
  // descendants, so stripping the role is enough, and it keeps the escape hatch narrow — this is a
  // separator that chose not to announce itself, not a subtree removed from the tree.
  if (decorative) return <hr className={className} role="presentation" />;

  return (
    <hr
      className={className}
      aria-orientation={orientation === "vertical" ? "vertical" : undefined}
    />
  );
}
