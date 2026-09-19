import type { RecipeConfig } from "@pandacss/dev";

export const LINK_RECIPE_KEY = "link";

/**
 * Link is single-part (a flat recipe, like Button and Badge): one styled `<a>`, never a composed
 * structure, so it lands in `theme.recipes` (see `isSlotRecipe` in src/registry.ts).
 *
 * NO FONT DECLARATIONS AT ALL, AND THAT ABSENCE IS THE DESIGN — it is the one thing that
 * separates this recipe from Button's, which fixes `fontFamily`, `fontSize`, `fontWeight` and
 * `lineHeight`. A button is a box that sits BESIDE text; a link is text that sits INSIDE other
 * text. Fixing its type would make a link stop matching the sentence it lives in: a link in an
 * `<h2>` would shrink to body size, and a link in a caption would grow. So the type is inherited,
 * and the only geometry here is the underline's.
 *
 * COLOUR NEVER CHANGES ON HOVER, AND THAT IS A CONTRACT DECISION RATHER THAN A VISUAL ONE.
 * `@zevaui/constraints` gates `color-text-link` and `color-text-default` against BOTH
 * `color-bg-canvas` and `color-bg-surface` in all three themes (see contract.json), so every
 * colour this recipe can paint is validated at the 4.5:1 AA floor — 7.0:1 in high-contrast. The
 * conventional hover treatment, darkening to `accent.strong`, would paint a text colour the
 * contract does NOT cover, which is exactly the gap Badge's two extra tones sit in and the reason
 * Badge ships a story per tone. A link appears in running prose far more often than a badge does,
 * so the gap is not worth opening: the hover affordance is carried by the UNDERLINE instead,
 * which costs no contrast pair and is visible to someone who cannot distinguish the two blues.
 *
 * DISABLED USES `text.muted`, NOT BUTTON'S `opacity: 0.5`, AND THE DIVERGENCE IS DELIBERATE.
 * Dimming with opacity composites the text against whatever is behind it, which drops a colour
 * that was measured at 4.5:1 to roughly half that — acceptable on a button, whose meaning is also
 * carried by its box, and not acceptable on something that is nothing but text. `text.muted` is
 * the one dimmed text colour the contract already validates against both backgrounds, so a
 * disabled link stays readable while still reading as unavailable.
 *
 * `borderRadius: "input"` STYLES NOTHING AT REST. It exists so the focus ring rounds its corners
 * against the theme's own radius scale rather than boxing the text in a hard rectangle, the same
 * value Badge uses and for the same reason: `radius.full` is a primitive no theme bridges into a
 * semantic token, so a pill would be the only geometry in this package ignoring that scale.
 */
export const linkRecipe = {
  className: "zui-link",
  base: {
    borderRadius: "input",
    cursor: "pointer",
    // Far enough off the baseline that the line does not cut through descenders (g, y, p), close
    // enough that it still reads as belonging to the word. An `em` rather than a token, because
    // the type is inherited: the offset has to track whatever size the surrounding text is.
    textUnderlineOffset: "0.2em",
    textDecorationThickness: "1px",
    "&[data-focus-visible]": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: "focusRing",
      outlineOffset: "2px",
    },
    /**
     * Beats both `tone` rules on specificity — `.zui-link[data-disabled]` is (0,2,0) against the
     * variant class's (0,1,0) — so the disabled colour lands whichever tone the caller picked,
     * without this recipe having to repeat itself once per tone.
     *
     * react-aria-components sets `[data-disabled]` from `isDisabled` and, at the same time, drops
     * the `href` so the link stops being a link for the keyboard too. The underline stays: the
     * thing is still a destination, it is just not available right now.
     */
    "&[data-disabled]": {
      cursor: "not-allowed",
      color: "text.muted",
    },
  },
  variants: {
    /**
     * TWO VALUES, AND THE SECOND IS NOT A WEAKER VERSION OF THE FIRST — it is for a different
     * place on the page. `accent` is a link inside prose, where `color-text-link` is the token the
     * three themes already reserve for exactly this. `neutral` is a link inside a navigation
     * structure — a breadcrumb trail, a footer column, a sidebar — where every item is a link and
     * painting them all blue makes the colour carry no information at all.
     */
    tone: {
      accent: { color: "text.link" },
      neutral: { color: "text.default" },
    },
    /**
     * WCAG 1.4.1 LIVES ON THIS AXIS, AND THE DEFAULT IS THE SAFE HALF OF IT. A link inside a block
     * of text that is distinguished from that text ONLY by colour fails 1.4.1; the underline is
     * what makes it perceivable to someone who does not see the hue. `always` is therefore the
     * default, and `hover` is the value a caller opts into — correctly, in a nav bar or a
     * breadcrumb, where the link is not embedded in a sentence and its position already tells you
     * what it is.
     *
     * THE COMBINATION `tone="neutral" underline="hover"` IS THE ONE THIS PACKAGE CANNOT CHECK FOR
     * YOU. At rest it is indistinguishable from the text around it — by construction, since that
     * is what both values ask for. Inside prose that is a 1.4.1 failure; inside a nav list it is
     * the correct treatment. No gate can read which of the two a call site is, so it is stated
     * here and in the changeset rather than silently allowed.
     *
     * `hover` RESTORES THE UNDERLINE ON FOCUS TOO, not only on hover. A keyboard user gets the
     * focus ring either way, but the ring says "you are here" while the underline says "this is a
     * link" — and dropping the second one for the pointerless half of the audience would make the
     * affordance mouse-only.
     */
    underline: {
      always: {
        textDecorationLine: "underline",
        // The whole hover affordance, since the colour deliberately does not move. Specificity
        // (0,3,0) against the base rule's (0,1,0), so the order the two are emitted in is
        // irrelevant.
        "&[data-hovered]:not([data-disabled])": { textDecorationThickness: "2px" },
      },
      hover: {
        textDecorationLine: "none",
        "&[data-hovered]:not([data-disabled])": { textDecorationLine: "underline" },
        "&[data-focus-visible]": { textDecorationLine: "underline" },
      },
    },
  },
  defaultVariants: {
    tone: "accent",
    underline: "always",
  },
} satisfies RecipeConfig;
