import type { RecipeConfig } from "@pandacss/dev";

export const TOOLTIP_RECIPE_KEY = "tooltip";

/**
 * The third overlay in this package, and the first one that is NOT a surface. `Dialog` and `Menu`
 * both raise a panel out of the page and paint it `bg.surface` — the same colour the page's own
 * cards use — separated from what is behind it only by a shadow. A tooltip is a different object:
 * it is a fragment of text that appears over content the user is already reading, and it has to be
 * distinguishable from that content at a glance, without being mistaken for a panel it can
 * interact with.
 *
 * SO IT INVERTS, AND THE INVERSION IS THE ONE THE CONTRACT ALREADY VALIDATES. `bg.inverse` with
 * `text.inverse` is the conventional tooltip look, and it is also the single inverse text pair
 * `@zevaui/constraints` gates — `contract.json` carries
 * `{ color-text-inverse, color-bg-inverse }` and measures it in all three themes. Painting a
 * tooltip any other way would mean either reusing the surface tokens (and producing something
 * that looks exactly like a `Menu` you cannot click) or opening a contrast pair nothing validates.
 *
 * NO ARROW, AND THIS IS THE DECISION MOST LIKELY TO BE REVISITED, SO HERE IS THE ARGUMENT.
 * react-aria-components ships `OverlayArrow` and it would work. What it costs is a seam: the
 * bubble is separated from the page by `shadow.dropdown`, and a shadow follows the bubble's own
 * box, not the box plus a triangle glued to one edge. Every implementation of an arrowed tooltip
 * therefore either drops the shadow, or draws the arrow as a rotated square that has to be
 * clipped and re-shadowed per placement — four extra rules keyed off `[data-placement]` for a
 * decoration that says nothing the proximity of the bubble does not already say. `Menu`'s popover
 * has no arrow either, for the same reason and with the same trade already accepted.
 *
 * NO VARIANTS AT ALL — the first recipe in this package with none, and the honest outcome rather
 * than an oversight. Every axis this package ships answers a question a caller genuinely has:
 * how big is the control, how wide against its container, which tone does this state carry. A
 * tooltip has none of those. Its size is its text, its placement is a BEHAVIOUR that react-aria
 * may override at paint time (see the `[data-placement]` rules below), and it has no tone because
 * it carries no intent — it is the same object whether it explains a save button or a delete one.
 * Inventing an axis to look like the others would be inventing API.
 *
 * `maxWidth` IS THE ONE OPINION IN THE GEOMETRY. A tooltip that grows to the viewport is a
 * paragraph, and a paragraph is not what a tooltip is for — `tooltip.types.ts` makes `content` a
 * plain string for the same reason. 18rem is roughly two lines of body text at the default scale.
 */
export const tooltipRecipe = {
  className: "zui-tooltip",
  base: {
    boxSizing: "border-box",
    maxWidth: "18rem",
    paddingInline: "calc({spacing.button.px} * 0.75)",
    paddingBlock: "calc({spacing.button.py} * 0.5)",
    borderRadius: "input",
    backgroundColor: "bg.inverse",
    color: "text.inverse",
    fontFamily: "body",
    // A shade under body size: a tooltip annotates the thing it points at rather than being the
    // page's own prose, the same reasoning `badge.recipe.ts` applies to its label.
    fontSize: "calc({fontSizes.body} * 0.9375)",
    fontWeight: "body",
    lineHeight: "body",
    boxShadow: "dropdown",
    /**
     * ONLY `transform` ANIMATES, never `opacity` — the rule `Menu` and `Dialog` already follow, so
     * that no ancestor can dim the text inside an overlay mid-transition and drop it below the
     * ratio it was measured at.
     *
     * The slide is driven off `[data-placement]`, which reports the placement react-aria
     * RESOLVED rather than the one the caller asked for: a tooltip requested at `top` with no room
     * above is painted at `bottom`, and keying the animation off the request would slide it the
     * wrong way exactly when it moved.
     */
    transitionProperty: "transform",
    transitionDuration: "120ms",
    transitionTimingFunction: "ease-out",
    '&[data-placement="bottom"][data-entering]': { transform: "translateY(-0.25rem)" },
    '&[data-placement="bottom"][data-exiting]': { transform: "translateY(-0.25rem)" },
    '&[data-placement="top"][data-entering]': { transform: "translateY(0.25rem)" },
    '&[data-placement="top"][data-exiting]': { transform: "translateY(0.25rem)" },
    '&[data-placement="left"][data-entering]': { transform: "translateX(0.25rem)" },
    '&[data-placement="left"][data-exiting]': { transform: "translateX(0.25rem)" },
    '&[data-placement="right"][data-entering]': { transform: "translateX(-0.25rem)" },
    '&[data-placement="right"][data-exiting]': { transform: "translateX(-0.25rem)" },
    "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
  },
  variants: {},
  defaultVariants: {},
} satisfies RecipeConfig;
