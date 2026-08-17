import type { RecipeConfig } from "@pandacss/dev";

export const BUTTON_RECIPE_KEY = "button";

// `satisfies` (not a type annotation) preserves the literal variant/value shape,
// which slice B derives `ButtonVisual`/`ButtonSize` from.
export const buttonRecipe = {
  className: "zui-button",
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "button",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    fontFamily: "body",
    fontSize: "body",
    fontWeight: "body",
    lineHeight: "body",
    cursor: "pointer",
    "&[data-focus-visible]": {
      outlineWidth: "2px",
      outlineStyle: "solid",
      outlineColor: "focusRing",
      outlineOffset: "2px",
    },
    "&[data-disabled]": {
      cursor: "not-allowed",
      opacity: 0.5,
    },
  },
  variants: {
    visual: {
      solid: {
        backgroundColor: "accent.default",
        color: "text.inverse",
        borderColor: "accent.default",
        "&[data-hovered]:not([data-disabled])": { backgroundColor: "accent.strong" },
        "&[data-pressed]:not([data-disabled])": { backgroundColor: "accent.strong" },
      },
      subtle: {
        backgroundColor: "bg.surface",
        color: "text.default",
        borderColor: "border.default",
        "&[data-hovered]:not([data-disabled])": { backgroundColor: "accent.subtle" },
        "&[data-pressed]:not([data-disabled])": { backgroundColor: "accent.subtle" },
      },
      danger: {
        backgroundColor: "danger.default",
        color: "text.inverse",
        borderColor: "danger.default",
        "&[data-hovered]:not([data-disabled])": { backgroundColor: "danger.subtle" },
        "&[data-pressed]:not([data-disabled])": { backgroundColor: "danger.subtle" },
      },
    },
    size: {
      sm: {
        paddingInline: "calc({spacing.button.px} * 0.75)",
        paddingBlock: "calc({spacing.button.py} * 0.75)",
      },
      md: {
        paddingInline: "button.px",
        paddingBlock: "button.py",
      },
      lg: {
        paddingInline: "calc({spacing.button.px} * 1.5)",
        paddingBlock: "calc({spacing.button.py} * 1.5)",
      },
    },
  },
  defaultVariants: {
    visual: "solid",
    size: "md",
  },
} satisfies RecipeConfig;
