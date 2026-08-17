import type { SlotRecipeConfig } from "@pandacss/dev";

export const CARD_RECIPE_KEY = "card";

/**
 * Card is multi-part, so it is a Panda SLOT recipe: `panda.config.ts` routes it to
 * `theme.slotRecipes` off the presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> role (all plain elements this component owns; no react-aria-components involved):
 *   root   -> the card's own container
 *   header -> optional top zone, hairline-separated from body
 *   body   -> the card's main content
 *   footer -> optional bottom zone, hairline-separated from body
 *
 * WHY CARD COMPOSES WITH SLOTS WHILE DIALOG AND MENU USE TYPED PROPS. ADR-0005 D4 decided the
 * overlays expose typed content props rather than `children` composition, but that reasoning is
 * semantic and specific to overlays: `role="menu"` only admits `menuitem` children, react-aria's
 * collection needs a stable key per row, and `MenuTrigger` derives the menu's accessible name from
 * the trigger — exposing those seams would export STRUCTURE, not content. Card has none of those
 * constraints: no ARIA role, no collection, no accessible-name requirement, and its zones are
 * arbitrary content a consumer cannot structurally break. So slot composition is correct here and
 * does NOT contradict D4 — `Card.Header` / `Card.Body` / `Card.Footer` (see Card.tsx) are plain
 * dot-notation parts attached with `Object.assign` at module scope, each rendering its own slot
 * class independently: no React context, no `Children.map`, no cloning, no ordering enforcement.
 *
 * ONE AXIS, PURELY GEOMETRIC. `surface` decides how the card separates itself from the page:
 * `elevated` lifts it off the page with `shadow.card`, `outlined` draws a 1px boundary instead.
 * Neither is a tone/intent axis, so the WCAG 1.4.11 non-text-contrast failure that keeps Dialog
 * and Menu off `color-border-strong` for THEIR boundary is not in play here either way — the
 * hairlines and the outlined boundary both use `border.default`, exactly as Dialog already does
 * for its own header/footer hairlines.
 *
 * `satisfies` (not a type annotation) preserves the literal slot/variant shape, which
 * `card.types.ts` derives `CardSurface` from.
 */
export const cardRecipe = {
  className: "zui-card",
  slots: ["root", "header", "body", "footer"],
  base: {
    root: {
      borderRadius: "card",
      backgroundColor: "bg.surface",
      overflow: "hidden",
    },
    header: {
      paddingInline: "card.px",
      paddingBlock: "card.py",
      borderBottomWidth: "1px",
      borderBottomStyle: "solid",
      borderBottomColor: "border.default",
    },
    body: {
      paddingInline: "card.px",
      paddingBlock: "card.py",
    },
    footer: {
      paddingInline: "card.px",
      paddingBlock: "card.py",
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: "border.default",
    },
  },
  variants: {
    surface: {
      elevated: {
        root: { boxShadow: "card" },
      },
      outlined: {
        root: {
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "border.default",
        },
      },
    },
  },
  defaultVariants: {
    surface: "elevated",
  },
} satisfies SlotRecipeConfig;
