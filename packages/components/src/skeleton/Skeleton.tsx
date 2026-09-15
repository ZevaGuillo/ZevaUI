import { recipeClassName } from "../internal/recipe-class.js";
import { skeletonRecipe } from "./skeleton.recipe.js";
import type { SkeletonProps } from "./skeleton.types.js";

/**
 * The fourth server-renderable component, after Card, Alert and Badge: Skeleton needs no
 * react-aria-components and no hooks, so it carries no "use client" directive. `Progress` is
 * `clientOnly: true` only because RAC 1.20's `ProgressBar` module does `import 'client-only'`;
 * nothing here imports it, so that constraint does not reach this component.
 *
 * A `<span>`, not a `<div>`, and `skeleton.recipe.ts` makes it a block. A skeleton stands in for
 * content wherever that content was, including inside a `<p>` — and a `<div>` there is invalid
 * markup, which a consumer cannot work around because this package exposes no element override.
 * A `<span>` is phrasing content, so it is valid in every position the real content could have
 * occupied, and `display: block` makes it lay out as the box it is replacing.
 *
 * `aria-hidden="true"`, ALWAYS, AND NOT OVERRIDABLE. This is the deliberate accessibility
 * decision, and it is the opposite of what a skeleton's name suggests:
 *
 *   A skeleton has nothing to read. It is a shape, not a message, so `role="status"` with a
 *   "Loading" label would announce a word this component invented rather than anything the page
 *   actually said.
 *
 *   Skeletons come in crowds. A list of eight rows is eight to twenty-four of these elements, and
 *   a per-element announcement turns one loading state into two dozen. The loading state belongs
 *   to the REGION that is loading, exactly once, not to each shape inside it.
 *
 *   This package already has the component that announces work in progress. `Progress` renders
 *   RAC's `ProgressBar` and owns `role="progressbar"`, including the indeterminate case; a
 *   skeleton that also announced would be a second, weaker answer to a question already answered.
 *
 * So the contract lands on the CALLER, the same way Badge's missing role does: the container that
 * is waiting carries `aria-busy="true"` (and, when the wait is worth interrupting for, a
 * `Progress` or a live region of the consumer's own). That obligation is demonstrated in every
 * story in `Skeleton.stories.tsx` rather than only written down here.
 */
export function Skeleton({ shape, width }: SkeletonProps) {
  return <span aria-hidden="true" className={recipeClassName(skeletonRecipe, { shape, width })} />;
}
