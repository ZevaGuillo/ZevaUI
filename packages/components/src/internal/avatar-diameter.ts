/**
 * The one diameter scale two components share, and the reason it is not declared inside either.
 *
 * `skeleton.recipe.ts` refused a `circle` shape when it shipped, and named this exact hazard as
 * one of the two reasons: "a diameter scale would have to be invented here and then MATCHED
 * there; if the two ever drifted, the skeleton would reserve the wrong space and the page would
 * jump at the exact moment the real avatar arrived." A shared constant is what makes drift
 * impossible rather than merely unlikely — the two recipes cannot disagree about a value neither
 * of them owns.
 *
 * Extracted on arrival rather than in advance, the same rule `internal/text-surface.ts` and
 * `internal/progress-surface.ts` were written under: it exists because a SECOND consumer showed
 * up, not because one was predicted.
 *
 * DERIVED FROM THE BODY TYPE, NOT TOKENISED, which is the precedent `checkbox.recipe.ts` set and
 * `badge.recipe.ts` and `skeleton.recipe.ts` both reused. An avatar sits beside a name in a list
 * row, a comment header or a table cell, so its diameter is a typographic measure: a theme that
 * changes its type scale moves the avatars with the text they belong to. A `size.avatar.*` token
 * would have to be declared in all three themes to say the same thing, and would then stop
 * tracking the type it sits next to.
 *
 * The multipliers are chosen against what the avatar sits BESIDE rather than as a geometric
 * series. At the default scale (`font.body.size` -> `fontSize.sm`, 0.875rem):
 *
 *   sm  2x    -> the height of one line of body text plus its leading. An avatar in a dense
 *                table row or inline beside a name, where it must not change the row's height.
 *   md  2.5x  -> a list row: a name on one line with supporting text under it.
 *   lg  3.5x  -> a profile header, where the avatar is the subject rather than an annotation.
 */
export const AVATAR_DIAMETER = {
  sm: "calc({fontSizes.body} * 2)",
  md: "calc({fontSizes.body} * 2.5)",
  lg: "calc({fontSizes.body} * 3.5)",
} as const;

/** The size names both recipes offer, derived from the scale rather than restated beside it. */
export type AvatarDiameter = keyof typeof AVATAR_DIAMETER;
