import type { SlotRecipeConfig } from "@pandacss/dev";

export const MENU_RECIPE_KEY = "menu";

/**
 * Menu is multi-part, so it is a Panda SLOT recipe: `panda.config.ts` routes it to
 * `theme.slotRecipes` off the presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> react-aria-components element:
 *   popover         -> <Popover>   the raised surface, portalled to document.body
 *   menu            -> <Menu>      the <div role="menu"> itself
 *   item            -> <MenuItem>  one <div role="menuitem"> row
 *   itemLabel       -> <Text slot="label">        the row's accessible name
 *   itemDescription -> <Text slot="description">  the row's supporting copy
 *
 * The trigger is NOT a slot: `Menu.tsx` renders this design system's own `Button` for it, the
 * same way `Dialog.tsx` renders `Button` for its close control. Its styling therefore belongs to
 * the button recipe, and the manifest keeps the two components' token lists disjoint.
 *
 * NO BORDER SEPARATES THE POPOVER FROM THE PAGE. `color-border-strong` measurably fails WCAG
 * 1.4.11 non-text contrast (2.49:1 light, 2.66:1 dark, against a 3.0 floor — see
 * packages/constraints/README.md), so the surface is separated by `shadow-dropdown` over an
 * opaque `color-bg-surface`, exactly the precedent Dialog set with `shadow-modal`.
 *
 * NO OVERLAY RADIUS TOKEN EXISTS. `radius-card` is the surface radius this design system already
 * ships; there is no semantic `radius-dropdown` and none is invented here.
 *
 * NO `opacity` ANYWHERE. The enter/exit animation moves the surface instead of fading it, so no
 * ancestor can ever dim the text inside it — the same rule Dialog's scrim follows.
 *
 * `satisfies` (not a type annotation) preserves the literal slot/variant shape, which
 * `menu.types.ts` derives `MenuSize` / `MenuWidth` from.
 */
export const menuRecipe = {
  className: "zui-menu",
  slots: ["popover", "menu", "item", "itemLabel", "itemDescription"],
  base: {
    popover: {
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      backgroundColor: "bg.surface",
      color: "text.default",
      borderRadius: "card",
      boxShadow: "dropdown",
      overflow: "hidden",
      // Only `transform` animates. `Popover` emits `data-entering`/`data-exiting` plus a
      // `data-placement` that reflects the placement react-aria RESOLVED (it flips the menu when
      // there is no room below), so the slide direction is driven off that attribute rather than
      // off a variant the consumer picked and the browser then overrode.
      transitionProperty: "transform",
      transitionDuration: "120ms",
      transitionTimingFunction: "ease-out",
      "&[data-entering]": { transform: "translateY(-0.25rem)" },
      "&[data-exiting]": { transform: "translateY(-0.25rem)" },
      '&[data-placement="top"][data-entering]': { transform: "translateY(0.25rem)" },
      '&[data-placement="top"][data-exiting]': { transform: "translateY(0.25rem)" },
      "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
    },
    menu: {
      display: "flex",
      flexDirection: "column",
      margin: "0",
      paddingInline: "0",
      paddingBlock: "calc({spacing.card.py} * 0.5)",
      // react-aria writes the available height onto the popover as an inline `max-height`, so the
      // list inherits it and scrolls inside the surface instead of overflowing the viewport.
      maxHeight: "inherit",
      overflowY: "auto",
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      color: "text.default",
      // The visible focus indicator lives on the focused ROW, not on this container: react-aria
      // moves DOM focus onto the individual `MenuItem`s, so a ring here would only ever flash.
      outline: "none",
    },
    item: {
      display: "flex",
      flexDirection: "column",
      gap: "calc({spacing.button.py} * 0.25)",
      color: "text.default",
      cursor: "pointer",
      userSelect: "none",
      outline: "none",
      // Measured against the installed react-aria-components 1.20.0 dist, not assumed: `MenuItem`
      // emits data-disabled, data-hovered, data-focused, data-focus-visible, data-pressed,
      // data-selected, data-selection-mode, data-has-submenu and data-open. This Menu exposes
      // neither selection nor submenus, so the last four can never appear and are not styled.
      //
      // Every background state excludes a disabled row on purpose. `color-text-muted` is only
      // contrast-validated against `color-bg-surface` and `color-bg-canvas` (see
      // packages/constraints/src/contract.json); tinting a disabled row would leave that
      // validated pairing and quietly drop below 4.5:1.
      "&[data-hovered]:not([data-disabled])": { backgroundColor: "bg.subtle" },
      "&[data-focused]:not([data-disabled])": { backgroundColor: "bg.subtle" },
      "&[data-pressed]:not([data-disabled])": { backgroundColor: "bg.muted" },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        // Inset, because the popover clips its overflow — an outward ring on the first or last
        // row would be cut in half.
        outlineOffset: "-2px",
      },
      "&[data-disabled]": {
        cursor: "not-allowed",
        color: "text.muted",
      },
    },
    itemLabel: {
      fontFamily: "body",
      fontWeight: "body",
      lineHeight: "body",
    },
    itemDescription: {
      fontFamily: "body",
      lineHeight: "body",
      color: "text.secondary",
    },
  },
  variants: {
    // Both axes are purely geometric, for the same reason Dialog's are: a tone axis would need a
    // colored boundary, and the only strong-enough neutral this system ships fails WCAG 1.4.11.
    size: {
      sm: {
        item: {
          paddingInline: "calc({spacing.card.px} * 0.75)",
          paddingBlock: "calc({spacing.button.py} * 0.5)",
        },
        itemLabel: { fontSize: "calc({fontSizes.body} * 0.9375)" },
        itemDescription: { fontSize: "calc({fontSizes.body} * 0.8125)" },
      },
      md: {
        item: { paddingInline: "card.px", paddingBlock: "button.py" },
        itemLabel: { fontSize: "body" },
        itemDescription: { fontSize: "calc({fontSizes.body} * 0.875)" },
      },
      lg: {
        item: {
          paddingInline: "calc({spacing.card.px} * 1.25)",
          paddingBlock: "calc({spacing.button.py} * 1.5)",
        },
        itemLabel: { fontSize: "calc({fontSizes.body} * 1.125)" },
        itemDescription: { fontSize: "body" },
      },
    },
    // `--trigger-width` is written onto the popover as an inline custom property by
    // react-aria-components' own `Popover` (measured on the 1.20.0 dist). It is not a design
    // token and never touches the `--zui-*` bridge, so G1/G4 stay intact.
    width: {
      auto: { popover: { minWidth: "var(--trigger-width)", maxWidth: "20rem" } },
      trigger: { popover: { width: "var(--trigger-width)" } },
    },
  },
  defaultVariants: {
    size: "md",
    width: "auto",
  },
} satisfies SlotRecipeConfig;
