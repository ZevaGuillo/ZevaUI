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
 * TYPOGRAPHY IS DECLARED ON `root`, NOT PER ZONE, AND IT IS NOT OPTIONAL. `root` already paints
 * `bg.surface`, so the moment this component owns the background behind text it also owns that
 * text's colour: leaving `color` to inheritance means the card's own surface is composited
 * against whatever the consumer's page last set. It shipped that way in 0.2.0 and the failure was
 * measured from a bare consumer app — no page colours set, exactly what the README's Quick Path
 * produces — at 1.18:1 against a 4.5:1 AA floor in the dark theme: User-Agent black on
 * `bg.surface`'s dark value. Light and high-contrast "passed" only by the accident of UA black
 * landing on a light surface, which is luck, not a contract.
 *
 * The five declarations sit on `root` rather than being repeated across `header`/`body`/`footer`
 * because all five are inherited CSS properties, so one declaration covers every zone including
 * any future one. This differs from Input, which declares its own on `label`/`input`/`description`
 * individually — it has to, because `input` is a replaced element that does NOT inherit font from
 * its ancestors. Card has no such element, so the inherited spelling is both correct and smaller.
 * The token choices mirror Alert's exactly (`text.default` + the four `body` type tokens): a card
 * is body copy on a surface, the same as an alert is.
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
      color: "text.default",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
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
