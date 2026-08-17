import type { RecipeConfig } from "@pandacss/dev";

export const ALERT_RECIPE_KEY = "alert";

/**
 * Alert is single-part (a flat recipe, like Button): it is one styled box, never a composed
 * structure, so it needs no slots and lands in `theme.recipes` (see `isSlotRecipe` in
 * src/registry.ts).
 *
 * ONE AXIS, NO DEFAULT. `tone` is danger | success | warning, and deliberately carries no
 * `defaultVariants` entry — unlike Button's `visual: "solid"`, which is a safe neutral default.
 * An Alert without a stated tone is a caller bug, not a case for a silent fallback: defaulting
 * would silently pick a semantic meaning ("this message is a warning") the caller never stated.
 * `alert.types.ts` mirrors this by making `tone` a REQUIRED prop, so omitting it is a compile
 * error rather than a runtime fallback.
 *
 * NO `info` TONE. Verified against @zevaui/tokens: zero `color-info-*` or `color-neutral-*`
 * tokens exist in any theme (light/dark/high-contrast), so an `info` tone would have nothing to
 * bridge. Three tones only, each backed by real tokens.
 *
 * TEXT COLOR IS FIXED ACROSS EVERY TONE, MEASURED — NOT THE CONVENTIONAL LOOK. The obvious
 * design (`{tone}.default` text on `{tone}.subtle` background) was measured against the light
 * theme's real OKLCH values (relative luminance / WCAG contrast ratio) and REJECTED: it fails
 * the 4.5:1 AA floor in every tone — danger 3.90, success 2.93, warning 1.93. The chosen design
 * — `color.text.default` on `{tone}.subtle` — passes comfortably in every tone: danger 14.54,
 * success 16.14, warning 15.94. So the tone colour is a NON-TEXT ACCENT ONLY (a left border);
 * text stays `text.default` in all three tones. Do not "fix" the look to per-tone text — that
 * reintroduces a measured accessibility failure this comment exists to prevent.
 *
 * GEOMETRY REUSES CARD'S TOKENS. No Alert-specific radius or spacing token exists in
 * @zevaui/tokens, and adding one for a single component would ripple across that package for no
 * reason: `radius.card` and `spacing.card.px/py` are already bridged in panda.config.ts and are
 * geometrically identical to what an Alert needs.
 */
export const alertRecipe = {
  className: "zui-alert",
  base: {
    display: "block",
    borderRadius: "card",
    paddingInline: "card.px",
    paddingBlock: "card.py",
    borderInlineStartWidth: "4px",
    borderInlineStartStyle: "solid",
    color: "text.default",
    fontFamily: "body",
    fontSize: "body",
    fontWeight: "body",
    lineHeight: "body",
  },
  variants: {
    tone: {
      danger: {
        backgroundColor: "danger.subtle",
        borderInlineStartColor: "danger.default",
      },
      success: {
        backgroundColor: "success.subtle",
        borderInlineStartColor: "success.default",
      },
      warning: {
        backgroundColor: "warning.subtle",
        borderInlineStartColor: "warning.default",
      },
    },
  },
} satisfies RecipeConfig;
