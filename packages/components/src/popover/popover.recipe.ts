import type { SlotRecipeConfig } from "@pandacss/dev";

export const POPOVER_RECIPE_KEY = "popover";

/**
 * Popover is multi-part, so it is a Panda SLOT recipe, routed to `theme.slotRecipes` off the
 * presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> react-aria-components element:
 *   popover -> <Popover>  the raised surface, portalled to document.body
 *   dialog  -> <Dialog>   the <div role="dialog"> inside it
 *   title   -> <Heading slot="title">  the dialog's accessible name, drawn
 *   body    -> a plain <div>           whatever the caller put in it
 *
 * The trigger is NOT a slot, exactly as in `menu.recipe.ts`: `Popover.tsx` renders this design
 * system's own `Button` for it, so the trigger's styling belongs to the button recipe and the
 * manifest keeps the two components' token lists disjoint.
 *
 * IT BORROWS MENU'S SURFACE, NOT DIALOG'S, AND THE DIFFERENCE IS THE SHADOW. Both are panels of
 * `bg.surface` with `radius.card` and no border — `color-border-strong` was measured failing WCAG
 * 1.4.11 when ADR-0005 D2 made the call, and the structural decision stands (see the README's "Why
 * neither overlay has a tone variant"). What separates them is depth: `shadow.modal` says "the
 * page behind this is unavailable", which is true of a modal and false here. A popover is
 * non-modal — the page stays interactive, clicking outside dismisses it — so it takes
 * `shadow.dropdown`, the same elevation `Menu` sits at, because it sits at the same distance from
 * the page.
 *
 * NO SCRIM, WHICH IS WHY THERE IS NO `overlay` SLOT. `Dialog` has one because a modal must stop
 * the page behind it from being read or clicked. A popover that dimmed the page would be claiming
 * a modality it does not enforce.
 *
 * NO `opacity` ANYWHERE, and only `transform` animates — the rule every overlay here follows, so
 * that no ancestor can dim the text inside one mid-transition.
 */
export const popoverRecipe = {
  className: "zui-popover",
  slots: ["popover", "dialog", "title", "body"],
  base: {
    popover: {
      boxSizing: "border-box",
      backgroundColor: "bg.surface",
      color: "text.default",
      borderRadius: "card",
      boxShadow: "dropdown",
      // react-aria writes the available height onto the popover as an inline `max-height`, so a
      // long body scrolls inside the surface instead of running off the viewport.
      overflowY: "auto",
      // The slide is keyed off the placement react-aria RESOLVED, not the one the caller asked
      // for: a popover requested at `top` with no room above is painted at `bottom`, and animating
      // off the request would move it the wrong way exactly when it flipped.
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
    dialog: {
      display: "flex",
      flexDirection: "column",
      // react-aria moves focus into the dialog when it opens, and a ring drawn on this container
      // would frame the whole panel for something the user never targeted. The focusable content
      // inside draws its own.
      outline: "none",
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      color: "text.default",
    },
    title: {
      margin: "0",
      fontFamily: "heading",
      fontWeight: "heading",
      lineHeight: "body",
      color: "text.default",
    },
    body: {
      color: "text.secondary",
    },
  },
  variants: {
    /**
     * PURELY GEOMETRIC, for the reason the README states once for every overlay: a tone axis needs
     * a coloured boundary to read as one, and this package does not give its overlays borders.
     *
     * The axis moves the padding, the title's size and the surface's own `maxWidth` together,
     * because those three are one decision — a wide panel with tight padding reads as a table, and
     * a narrow one with generous padding has no room left for content. The values derive from
     * `spacing.card.*`, the tokens `Dialog` and `Menu` already build their surfaces from, rather
     * than introducing a `space.popover.*` that would have to be declared in all three themes to
     * say the same thing.
     */
    size: {
      sm: {
        popover: { maxWidth: "16rem" },
        dialog: {
          gap: "calc({spacing.card.py} * 0.375)",
          paddingInline: "calc({spacing.card.px} * 0.75)",
          paddingBlock: "calc({spacing.card.py} * 0.75)",
        },
        title: { fontSize: "body" },
        body: { fontSize: "calc({fontSizes.body} * 0.9375)" },
      },
      md: {
        popover: { maxWidth: "22rem" },
        dialog: {
          gap: "calc({spacing.card.py} * 0.5)",
          paddingInline: "card.px",
          paddingBlock: "card.py",
        },
        title: { fontSize: "calc({fontSizes.body} * 1.125)" },
        body: { fontSize: "body" },
      },
      lg: {
        popover: { maxWidth: "30rem" },
        dialog: {
          gap: "calc({spacing.card.py} * 0.75)",
          paddingInline: "calc({spacing.card.px} * 1.25)",
          paddingBlock: "calc({spacing.card.py} * 1.25)",
        },
        title: { fontSize: "calc({fontSizes.body} * 1.25)" },
        body: { fontSize: "body" },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
