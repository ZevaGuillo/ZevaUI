import type { RecipeConfig } from "@pandacss/dev";

export const BADGE_RECIPE_KEY = "badge";

/**
 * Badge is single-part (a flat recipe, like Alert and Button): one styled box around a short
 * label, never a composed structure, so it needs no slots and lands in `theme.recipes` (see
 * `isSlotRecipe` in src/registry.ts).
 *
 * ONE AXIS, WITH A DEFAULT — THE OPPOSITE CHOICE TO ALERT'S, AND FOR ALERT'S OWN REASON. Alert
 * makes `tone` required because defaulting would silently pick a semantic meaning ("this message
 * is a warning") the caller never stated. `neutral` states nothing: it is a label on the page's
 * own subtle background, so a caller who omits `tone` gets a chip, not a claim. That is the same
 * kind of default Button's `visual: "solid"` is, and it is why `badge.types.ts` makes `tone`
 * OPTIONAL where `alert.types.ts` makes it required.
 *
 * FIVE TONES, NOT ALERT'S THREE. Alert has no `neutral`/`accent` because a tone-less alert is a
 * caller bug and `info` had no tokens to bridge. Badge's two extra tones both resolve against
 * tokens that already exist and are already bridged in panda.config.ts — `bg.subtle` (Menu's row
 * tint) and `accent.subtle` — so neither invents anything. `info` is still absent for Alert's
 * measured reason: zero `color-info-*` tokens exist in any theme.
 *
 * TEXT COLOUR IS FIXED ACROSS EVERY TONE, AND THAT IS INHERITED MEASUREMENT, NOT TASTE. The
 * conventional look — `{tone}.default` text on `{tone}.subtle` background — was measured for
 * Alert against the light theme's real OKLCH values and REJECTED: it fails the 4.5:1 AA floor in
 * every tone (danger 3.90, success 2.93, warning 1.93), while `text.default` on `{tone}.subtle`
 * passes comfortably (danger 14.54, success 16.14, warning 15.94). Badge paints the same three
 * backgrounds, so it inherits the same verdict rather than re-deriving it. The tone is a
 * BACKGROUND ONLY; `badge.test.ts` pins that no tone rule declares `color` at all, so the
 * conventional look cannot creep back in one tone at a time.
 *
 * THE TWO NEW TONES SIT IN A MEASURED CONTRACT GAP, DELIBERATELY LEFT OPEN. `@zevaui/constraints`
 * validates `color-text-default` over each of the three tone-`subtle` backgrounds, so `danger`,
 * `success` and `warning` are gated at token level in all three themes. It validates NEITHER
 * `color-accent-subtle` NOR `color-bg-subtle` as a text background, and extending it to do so was
 * tried and REVERTED rather than shipped: `contract.test.ts` asserts by name that no text pair
 * references `color-bg-subtle` or `color-bg-muted`, and ADR-0020 P3 reasons from the same fact —
 * `accent-*` and `bg-subtle/muted` being unconstrained is what lets a proposed theme carry a
 * brand colour into `accent` INTACT. Widening the contract to cover a badge would quietly
 * constrain a brand colour, which is not a Badge decision to make.
 *
 * So `neutral` and `accent` are covered the way Menu's hovered row already is — that row paints
 * `text.default` on this very `bg.subtle` and has always sat in the same gap — by axe's
 * `color-contrast` rule running over real stories in a real Chromium, in all three themes. That
 * makes `Badge.stories.tsx` load-bearing rather than illustrative: a tone with no story is a tone
 * with no contrast evidence, which is exactly the fragility ADR-0006's Seguimiento named. Five
 * tones, five stories.
 *
 * NO BORDER, ON PURPOSE. WCAG 1.4.11 measures the boundary that IDENTIFIES a user-interface
 * component; a badge is not one — it is text that reads inline, with no role, no focus and no
 * pointer behaviour (see Badge.tsx). Its own text already carries the 4.5:1 contrast that makes
 * it perceivable, so a 1px boundary would buy nothing and would need a new non-text contrast pair
 * per tone to stay honest.
 *
 * NO NEW TOKENS, AND NO SIZE AXIS. Every dimension is derived from `fontSizes.body`, the
 * precedent `checkbox.recipe.ts` set and argued: a badge sits inside a sentence or beside a
 * heading, so its geometry is a typographic measure and a fixed `space.*` value would stop
 * tracking a theme that changes its type scale. There is deliberately no `size` axis to go with
 * it — the six controls that have one are all things a user operates, where the hit target is the
 * axis, and a badge has no hit target to size. The corner is `radii.input`, not a hardcoded
 * `9999px` pill: `radius.full` is a primitive that no theme bridges into a semantic token, so a
 * pill would be the only geometry in this package that ignores the theme's radius scale entirely.
 */
export const badgeRecipe = {
  className: "zui-badge",
  base: {
    // `inline-flex`, not `inline-block`: the badge centres whatever it holds on the cross axis,
    // which is what keeps a count and a word sitting on the same line inside the same chip.
    display: "inline-flex",
    alignItems: "center",
    gap: "calc({fontSizes.body} * 0.375)",
    paddingInline: "calc({fontSizes.body} * 0.5)",
    paddingBlock: "calc({fontSizes.body} * 0.125)",
    borderRadius: "input",
    fontFamily: "body",
    // Smaller than body, because a badge annotates the text it sits next to rather than being
    // that text. Still a derived multiple of the body size, for the reason above.
    fontSize: "calc({fontSizes.body} * 0.875)",
    fontWeight: "body",
    // `1` rather than the body's line height: the chip's height is its padding plus its text, and
    // a body line-height would add leading the box then has to grow around.
    lineHeight: "1",
    color: "text.default",
    // A badge is a label, not a paragraph. Wrapping one mid-word inside its own background is
    // never the intended reading, and the content is short by construction.
    whiteSpace: "nowrap",
  },
  variants: {
    tone: {
      neutral: { backgroundColor: "bg.subtle" },
      accent: { backgroundColor: "accent.subtle" },
      danger: { backgroundColor: "danger.subtle" },
      success: { backgroundColor: "success.subtle" },
      warning: { backgroundColor: "warning.subtle" },
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
} satisfies RecipeConfig;
