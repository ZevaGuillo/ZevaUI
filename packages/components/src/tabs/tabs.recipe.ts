import type { SlotRecipeConfig } from "@pandacss/dev";

export const TABS_RECIPE_KEY = "tabs";

/**
 * Tabs is multi-part, so it is a Panda SLOT recipe: `panda.config.ts` routes it to
 * `theme.slotRecipes` off the presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> react-aria-components element:
 *   root  -> <Tabs>      the wrapper that owns the orientation
 *   list  -> <TabList>   the <div role="tablist">
 *   tab   -> <Tab>       one <div role="tab">
 *   panel -> <TabPanel>  the <div role="tabpanel"> for the selected tab
 *
 * ORIENTATION IS AN ATTRIBUTE, NOT A VARIANT, and that is the one structural decision here worth
 * arguing. `Tabs` and `TabList` both carry `data-orientation="horizontal | vertical"` from
 * react-aria-components already, so an `orientation` variant would mint a second, parallel
 * encoding of the same fact — two things to keep in step, and a class added to every tab list that
 * exists today. `Button`'s `[data-pending]` rule settled this: when RAC already expresses it,
 * style the attribute. The consumer still picks it through a typed prop; only the CSS hook differs.
 *
 * THE TAB ITSELF DOES NOT GET THAT ATTRIBUTE FROM RAC — measured in the 1.20 types, where
 * `TabsRenderProps` and `TabListRenderProps` both carry `orientation` and `TabRenderProps` does
 * not. `Tabs.tsx` therefore stamps `data-orientation` onto each `Tab` from the prop it already
 * holds. That is `Select`'s precedent, not a new idea: it stamps `data-open` onto its trigger for
 * the same reason, so every rule below stays a local `&[data-*]` instead of an ancestor-
 * conditioned selector.
 *
 * THE SELECTED TAB IS NOT MARKED BY COLOUR ALONE. It carries an accent bar on the edge facing the
 * panel, drawn with `borderColor` rather than a pseudo-element so it occupies real layout. Every
 * tab reserves that edge transparently, so selection changes a colour and never a box size — a tab
 * strip that reflowed on selection would move the row under the pointer that just clicked it,
 * which is the defect `Button`'s pending indicator is shaped to avoid.
 *
 * NO `radius.tab` TOKEN IS INVENTED. `radius.button` is the control radius this design system
 * already ships and a tab is a control; the surface radii (`radius.card`) belong to surfaces.
 *
 * NO ENTER ANIMATION ON THE PANEL. RAC emits `data-entering`/`data-exiting` on `TabPanel`, and
 * using them would make every visual baseline a race against a transition — the reason
 * `toast.recipe.ts` gives, under the same `reducedMotion: "reduce"` Playwright context.
 *
 * `satisfies` (not a type annotation) preserves the literal slot/variant shape, which
 * `tabs.types.ts` derives `TabsSize` from.
 */
export const tabsRecipe = {
  className: "zui-tabs",
  slots: ["root", "list", "tab", "panel"],
  base: {
    root: {
      display: "flex",
      // The axis follows the orientation RAC resolved, so a vertical tab strip sits beside its
      // panel instead of above it. `column` is the horizontal case: list on top, panel below.
      flexDirection: "column",
      '&[data-orientation="vertical"]': {
        flexDirection: "row",
      },
    },
    list: {
      display: "flex",
      // The rule the tab strip sits on. A border rather than a background stripe, so the selected
      // tab's own accent edge can overlap it exactly with no half-pixel seam between two boxes.
      borderColor: "border.default",
      borderStyle: "solid",
      borderWidth: "0",
      borderBlockEndWidth: "1px",
      '&[data-orientation="vertical"]': {
        flexDirection: "column",
        borderBlockEndWidth: "0",
        borderInlineEndWidth: "1px",
      },
    },
    tab: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      cursor: "pointer",
      whiteSpace: "nowrap",
      color: "text.secondary",
      fontFamily: "body",
      // One size token exists for body text, so the `size` axis below moves padding and nothing
      // else. Declaring `fontSize` per size would emit three rules with identical values.
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      borderRadius: "button",
      // THE ACCENT EDGE, RESERVED ON EVERY TAB AND COLOURED ON ONE. Transparent here so an
      // unselected tab occupies exactly the same box as a selected one; only the colour moves.
      // The negative margin pulls the edge over the list's own rule so the two read as one line.
      borderColor: "transparent",
      borderStyle: "solid",
      borderWidth: "0",
      borderBlockEndWidth: "2px",
      marginBlockEnd: "-1px",
      // Vertical strips put the panel to the inline side, so the edge that faces it moves with it.
      // Driven off the attribute `Tabs.tsx` stamps on this element, never off an ancestor.
      '&[data-orientation="vertical"]': {
        justifyContent: "flex-start",
        borderBlockEndWidth: "0",
        marginBlockEnd: "0",
        borderInlineEndWidth: "2px",
        marginInlineEnd: "-1px",
      },
      transitionProperty: "color, border-color",
      transitionDuration: "120ms",
      transitionTimingFunction: "ease-out",
      "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
      "&[data-hovered]": {
        color: "text.default",
      },
      "&[data-selected]": {
        color: "text.default",
        borderColor: "accent.default",
      },
      // `not-allowed` plus the dimmed treatment is the vocabulary `button.recipe.ts` established
      // for "this control is unavailable", and a disabled tab is exactly that.
      "&[data-disabled]": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
      // `outlineOffset` is negative so the ring sits INSIDE the tab. A positive offset would draw
      // it over the neighbouring tab and over the list's rule, since tabs sit edge to edge.
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "-2px",
      },
    },
    panel: {
      color: "text.default",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      // RAC gives the panel `tabIndex={0}` when it holds no focusable child of its own, so a
      // keyboard user can reach the content. A focus ring is therefore not decoration: it is the
      // only thing that says where they landed.
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
    },
  },
  variants: {
    /**
     * Geometry only, exactly as `Button`'s `size` is: the padding of a tab and the breathing room
     * around the panel. It styles the `tab` and `panel` slots, so Panda emits `--size_*` rules for
     * those two and `slotRecipeClassNames` must not stamp the axis onto `root` or `list`.
     */
    size: {
      sm: {
        tab: {
          paddingInline: "button.px",
          paddingBlock: "calc({spacing.button.py} * 0.75)",
        },
        panel: {
          paddingBlock: "card.py",
        },
      },
      md: {
        tab: {
          paddingInline: "calc({spacing.button.px} * 1.25)",
          paddingBlock: "button.py",
        },
        panel: {
          paddingBlock: "card.py",
        },
      },
      lg: {
        tab: {
          paddingInline: "calc({spacing.button.px} * 1.5)",
          paddingBlock: "calc({spacing.button.py} * 1.25)",
        },
        panel: {
          paddingBlock: "calc({spacing.card.py} * 1.25)",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
