import type { SlotRecipeConfig } from "@pandacss/dev";

export const DIALOG_RECIPE_KEY = "dialog";

/**
 * Dialog is multi-part, so it is a Panda SLOT recipe: `panda.config.ts` routes it to
 * `theme.slotRecipes` off the presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> react-aria-components element:
 *   overlay     -> <ModalOverlay>  the full-screen scrim, portalled to document.body
 *   modal       -> <Modal>         the raised surface, a child of the overlay
 *   content     -> <Dialog>        the <section role="dialog"> itself
 *   header/title/description/body/footer -> plain elements this component owns
 *
 * THE SCRIM. `Modal` renders inside `ModalOverlay`, so `opacity` on the overlay would fade the
 * dialog along with the backdrop — the child cannot opt out of an ancestor's opacity. The
 * translucency therefore lives in the scrim's own color channel instead: `color-mix` puts the
 * alpha on the background-color, which composites behind the modal without touching it. A literal
 * color is forbidden (G2), so the mix is taken over the `color-bg-inverse` SEMANTIC token, which
 * keeps the emitted value a pure `var(--zuip-*)` reference and leaves the token bridge intact (G4).
 * `__tests__/dialog.test.ts` asserts all of this against the emitted stylesheet, not this source.
 *
 * NO BORDER SEPARATES THE MODAL FROM THE PAGE. `color-border-strong` measurably fails WCAG 1.4.11
 * non-text contrast (2.49:1 light, 2.66:1 dark, against a 3.0 floor — see
 * packages/constraints/README.md), so the surface is separated by `shadow-modal` over an opaque
 * `color-bg-surface`. `color-border-default` is used only for the internal header/footer hairlines,
 * exactly as Button uses it.
 *
 * NO SCROLL LOCK IS EMITTED. react-aria-components prevents page scroll in JavaScript while the
 * modal is open; shipping `body { overflow: hidden }` from here would be a global reset (G3).
 *
 * `satisfies` (not a type annotation) preserves the literal slot/variant shape, which
 * `dialog.types.ts` derives `DialogSize` / `DialogPlacement` from.
 */
export const dialogRecipe = {
  className: "zui-dialog",
  slots: ["overlay", "modal", "content", "header", "title", "description", "body", "footer"],
  base: {
    overlay: {
      position: "fixed",
      inset: "0",
      // The overlay is portalled to the end of <body>, but a consumer's own stacking contexts can
      // still sit above it. No z-index token exists (and inventing one is out of scope here), so
      // this is a deliberate raw value.
      zIndex: 50,
      display: "flex",
      justifyContent: "center",
      paddingInline: "card.px",
      paddingBlock: "card.py",
      backgroundColor: "color-mix(in srgb, {colors.bg.inverse} 60%, transparent)",
      // Only the scrim's own color animates. Nothing here may animate `opacity`.
      transitionProperty: "background-color",
      transitionDuration: "150ms",
      transitionTimingFunction: "ease-out",
      "&[data-entering]": { backgroundColor: "transparent" },
      "&[data-exiting]": { backgroundColor: "transparent" },
      "@media (prefers-reduced-motion: reduce)": { transitionDuration: "0ms" },
    },
    modal: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      maxHeight: "100%",
      backgroundColor: "bg.surface",
      color: "text.default",
      borderRadius: "card",
      // No semantic radius exists for overlays; `radius-card` is the surface radius this design
      // system already ships. Do not invent `radius-modal`.
      boxShadow: "modal",
      overflow: "hidden",
      transitionProperty: "transform",
      transitionDuration: "150ms",
      transitionTimingFunction: "ease-out",
      "&[data-entering]": { transform: "scale(0.96)" },
      "&[data-exiting]": { transform: "scale(0.96)" },
      "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
    },
    content: {
      display: "flex",
      flexDirection: "column",
      minHeight: "0",
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      color: "text.default",
    },
    header: {
      // Two columns so the close control sits beside the title while the description spans the
      // full width underneath, using plain auto-placement in DOM order.
      display: "grid",
      gridTemplateColumns: "1fr auto",
      columnGap: "button.px",
      rowGap: "button.py",
      alignItems: "start",
      paddingInline: "card.px",
      paddingBlock: "card.py",
      borderBottomWidth: "1px",
      borderBottomStyle: "solid",
      borderBottomColor: "border.default",
    },
    title: {
      gridColumn: "1",
      margin: "0",
      fontFamily: "heading",
      fontWeight: "heading",
      fontSize: "calc({fontSizes.body} * 1.25)",
      lineHeight: "body",
      color: "text.default",
    },
    description: {
      gridColumn: "1 / -1",
      margin: "0",
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      color: "text.secondary",
    },
    body: {
      flex: "1",
      minHeight: "0",
      overflowY: "auto",
      paddingInline: "card.px",
      paddingBlock: "card.py",
    },
    footer: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: "button.px",
      paddingInline: "card.px",
      paddingBlock: "card.py",
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: "border.default",
    },
  },
  variants: {
    // Both axes are purely geometric. A tone/intent axis would need a colored boundary, and the
    // only strong-enough neutral this system ships fails WCAG 1.4.11 — see the note above.
    size: {
      sm: { modal: { maxWidth: "24rem" } },
      md: { modal: { maxWidth: "32rem" } },
      lg: { modal: { maxWidth: "48rem" } },
    },
    placement: {
      center: { overlay: { alignItems: "center" } },
      top: { overlay: { alignItems: "flex-start" } },
    },
  },
  defaultVariants: {
    size: "md",
    placement: "center",
  },
} satisfies SlotRecipeConfig;
