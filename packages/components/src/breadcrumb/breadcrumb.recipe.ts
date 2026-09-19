import type { SlotRecipeConfig } from "@pandacss/dev";

export const BREADCRUMB_RECIPE_KEY = "breadcrumb";

/**
 * Breadcrumb is multi-part, so it is a Panda SLOT recipe, routed to `theme.slotRecipes` off the
 * presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> element:
 *   nav       -> <nav aria-label>   the landmark, so the trail can be jumped to
 *   list      -> <ol>               the ordered list the hierarchy actually is
 *   item      -> <li>               one crumb plus the separator that follows it
 *   separator -> <span aria-hidden> the "/" between crumbs
 *   current   -> <span aria-current="page">  where you are
 *
 * THE LINKS ARE NOT A SLOT. Each ancestor crumb is this package's own `Link`, rendered with
 * `tone="neutral"` and `underline="hover"` — the exact combination `link.recipe.ts` documented as
 * correct in a navigation structure and wrong inside prose, and the reason that axis exists at
 * all. Their styling belongs to the link recipe, so the manifest keeps the two components' token
 * lists disjoint, the same split `Menu` and `Dialog` make with `Button`.
 *
 * NO VARIANTS, for the reason `tooltip.recipe.ts` argues at length and which applies unchanged
 * here: every axis this package ships answers a question a caller genuinely has, and a breadcrumb
 * raises none of them. It is navigation chrome — one line of small text above a page — with no
 * hit target to size, no container to span and no intent to tone. This is the second recipe here
 * with none, and the consistency is the point: an axis invented to look like the others is API
 * that can never be taken back.
 *
 * THE SEPARATOR IS A REAL ELEMENT, NOT A `::before`. Generated content is the conventional
 * implementation and it is the wrong one twice over. Some screen readers announce CSS `content`,
 * which would read "slash" between every crumb — noise that no `aria-hidden` can reach, because a
 * pseudo-element has no node to put it on. This one does, so it is silenced properly.
 *
 * IT IS DELIBERATELY LEFT SELECTABLE, which is the opposite of what most implementations do.
 * `user-select: none` on the separator is a reflex borrowed from interactive chrome, and here it
 * makes a copied trail read "HomeProjectsAlpha". The slashes are what make it legible as a path
 * when pasted, and a separator has nothing to accidentally drag-select.
 */
export const breadcrumbRecipe = {
  className: "zui-breadcrumb",
  slots: ["nav", "list", "item", "separator", "current"],
  base: {
    nav: {
      fontFamily: "body",
      // A shade under body size: a breadcrumb sits above the page's own content and orients it
      // rather than being it — the same reasoning `badge.recipe.ts` applies to its label.
      fontSize: "calc({fontSizes.body} * 0.9375)",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
    },
    list: {
      display: "flex",
      // A trail is as long as the hierarchy is deep, and a deep one on a narrow viewport has to
      // wrap rather than push the page sideways. This is the declaration that keeps a breadcrumb
      // from being the thing that gives a layout a horizontal scrollbar.
      flexWrap: "wrap",
      alignItems: "center",
      gap: "calc({spacing.button.px} * 0.5)",
      listStyle: "none",
      margin: "0",
      padding: "0",
    },
    item: {
      display: "flex",
      alignItems: "center",
      gap: "calc({spacing.button.px} * 0.5)",
    },
    separator: {
      color: "text.muted",
      // `aria-hidden` already keeps it out of the accessibility tree; this keeps it out of the
      // pointer's way, so a stray click between two crumbs does not look like a missed link.
      pointerEvents: "none",
    },
    current: {
      // The one crumb that is not a link, and the only thing marking it visually is weight and a
      // fully-opaque text colour against the muted separators around it. Not a colour of its own:
      // `text.default` is what the page's own prose uses, which is exactly the claim being made —
      // this crumb is the page.
      fontWeight: "heading",
      color: "text.default",
    },
  },
  variants: {},
  defaultVariants: {},
} satisfies SlotRecipeConfig;
