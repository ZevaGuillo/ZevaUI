import type { SlotRecipeConfig } from "@pandacss/dev";

export const PAGINATION_RECIPE_KEY = "pagination";

/**
 * Pagination is multi-part, so it is a Panda SLOT recipe, routed to `theme.slotRecipes` off the
 * presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> element:
 *   nav     -> <nav aria-label>   the landmark, so the control can be jumped to
 *   list    -> <ol>               the pages, in order, which is what they are
 *   item    -> <li>               one page, one gap, or one edge control
 *   current -> <span aria-current="page">  the page you are on
 *   gap     -> <span aria-hidden>          the ellipsis standing in for hidden pages
 *   edge    -> <span aria-hidden>          where Previous or Next would be at a boundary
 *
 * THE LINKS ARE NOT A SLOT, exactly as in `breadcrumb.recipe.ts`: every page you can go to is this
 * package's own `Link` with `tone="neutral"` and `underline="hover"`, the pair `link.recipe.ts`
 * documents as correct in a navigation structure. Their styling belongs to the link recipe, so the
 * manifest keeps the two components' token lists disjoint.
 *
 * NO VARIANTS, the third recipe here with none, and for the reason `tooltip.recipe.ts` argued
 * first: every axis this package ships answers a question a caller genuinely has, and pagination
 * raises none of them. How many pages to show either side is `siblings`, which is behaviour rather
 * than appearance — it changes what is rendered, not how it looks, so it is a prop and not a
 * variant.
 *
 * EVERY CELL IS THE SAME WIDTH, AND THAT IS THE ONE PIECE OF GEOMETRY WORTH ARGUING FOR. Page
 * numbers are one, two or three digits, so a row sized to its content reflows every time you
 * paginate past 9 or 99 — and the control you are clicking moves out from under the pointer that
 * just clicked it. A `min-inline-size` floor derived from the body type gives every cell the width
 * of its widest realistic content and keeps the row still.
 */
export const paginationRecipe = {
  className: "zui-pagination",
  slots: ["nav", "list", "item", "current", "gap", "edge"],
  base: {
    nav: {
      fontFamily: "body",
      fontSize: "calc({fontSizes.body} * 0.9375)",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
    },
    list: {
      display: "flex",
      // A trail of twenty pages on a narrow viewport has to wrap rather than push the page
      // sideways — the same declaration `breadcrumb.recipe.ts` leans on, and the same regression
      // it prevents: one that appears at exactly one viewport width.
      flexWrap: "wrap",
      alignItems: "center",
      gap: "calc({spacing.button.px} * 0.25)",
      listStyle: "none",
      margin: "0",
      padding: "0",
    },
    item: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // The floor that keeps the row from reflowing as the digits grow. Derived from the body type
      // rather than tokenised, the precedent `badge.recipe.ts` set: a cell is a typographic
      // measure, and a fixed `2rem` would stop tracking a theme that changes its type scale.
      minInlineSize: "calc({fontSizes.body} * 2)",
      paddingInline: "calc({spacing.button.px} * 0.25)",
      paddingBlock: "calc({spacing.button.py} * 0.25)",
    },
    current: {
      // Weight and a fully-opaque colour against the muted gaps around it — not a colour of its
      // own, for the reason `breadcrumb.recipe.ts` gives: `text.default` is what the page's prose
      // uses, which is exactly the claim being made.
      fontWeight: "heading",
      color: "text.default",
    },
    gap: {
      color: "text.muted",
      // `aria-hidden` keeps it out of the accessibility tree; this keeps it out of the pointer's
      // way, so a click between two page numbers does not read as a missed link.
      pointerEvents: "none",
    },
    edge: {
      // The placeholder where Previous or Next would be at a boundary. It reserves the cell so the
      // row does not shift when you reach the first or last page — see Pagination.tsx for why it
      // is a silent placeholder rather than a dimmed control.
      color: "text.muted",
      pointerEvents: "none",
    },
  },
  variants: {},
  defaultVariants: {},
} satisfies SlotRecipeConfig;
