import type { RecipeConfig } from "@pandacss/dev";

export const SEPARATOR_RECIPE_KEY = "separator";

/**
 * The smallest recipe in this package, and the only one whose base exists mostly to UNDO things.
 * `<hr>` is one of the last elements still carrying a decorative user-agent stylesheet — a
 * `border-style: inset`, a `border-width: 1px` and `margin-block: 0.5em` — and every one of those
 * is a value this design system's spacing and colour scales are supposed to own. So the base
 * resets all three and then paints the rule as a BACKGROUND rather than as a border, which is what
 * lets one declaration serve both orientations instead of four (`borderBlockStart` for horizontal,
 * `borderInlineStart` for vertical, each needing its own reset of the other).
 *
 * `border.default`, NOT `border.strong`. WCAG 1.4.11 measures the boundary that IDENTIFIES a
 * user-interface component, and a separator identifies nothing — it is not a component, it has no
 * state, and there is nothing to operate. It divides content that stays perfectly legible without
 * it, which is exactly why `role="separator"` exists to carry the meaning for anyone who cannot
 * see the line at all. Reaching for the 3:1-gated `border.strong` would paint a divider heavier
 * than the borders of the real controls around it, inverting the visual hierarchy to satisfy a
 * criterion that does not apply. Same reading Badge applied when it shipped with no border.
 *
 * NO `size` OR `thickness` AXIS. A divider is 1px; a thicker one is a section boundary, and a
 * section boundary wants a background change, not a fatter line.
 */
export const separatorRecipe = {
  className: "zui-separator",
  base: {
    borderStyle: "none",
    margin: "0",
    // A separator between flex items IS an ordinary flex item, and an ordinary flex item with a
    // 1px basis is the first thing a crowded row squashes to nothing. This one declaration is why
    // a vertical divider survives a toolbar that runs out of space.
    flexShrink: 0,
    backgroundColor: "border.default",
  },
  variants: {
    /**
     * `horizontal` FILLS ITS CONTAINER, `vertical` STRETCHES TO ITS FLEX PARENT — and those are
     * not the same mechanism, because CSS offers no cross-axis equivalent of `width: 100%` that
     * works in normal flow. A block element takes its width from its container and its height from
     * its content, and a separator has no content.
     *
     * So the vertical value is honest about its one precondition rather than pretending otherwise:
     * `alignSelf: stretch` resolves against a flex or grid parent and nothing else. Outside one it
     * computes to `auto`, the element gets no height, and the divider is invisible. That is stated
     * here, in `separator.types.ts` and in the changeset, because the alternative — a hardcoded
     * `height` — would be wrong for every row it did not happen to match. A vertical divider lives
     * in a toolbar, a breadcrumb trail or a button group, and all three are flex rows already.
     */
    orientation: {
      horizontal: { width: "100%", height: "1px" },
      vertical: { width: "1px", alignSelf: "stretch" },
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
} satisfies RecipeConfig;
