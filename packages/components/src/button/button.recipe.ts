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
    /**
     * PURELY GEOMETRIC, AND IT EXISTS BECAUSE THE ALTERNATIVE WAS IMPOSSIBLE. The base is
     * `inline-flex`, so a button shrink-wraps its label, and this package types `className` and
     * `style` as `never` — leaving a consumer no way to stretch one. Measured in a bare consumer
     * app: of the wrappers a consumer might reach for, only `display: grid` stretched a 54px
     * button to its 600px container; `display: block` and both flex spellings left it at 54px. A
     * contract that depends on knowing grid stretches its children, and only grid, is not a
     * contract. So the axis is real API.
     *
     * SPELLED AS AN AXIS, NOT A `fullWidth` BOOLEAN, to match `Menu`'s existing
     * `width: auto | trigger`. Two components with a width concern should spell it the same way,
     * and an axis has room for a third value that a boolean would have to be deprecated to grow.
     *
     * `auto` DECLARES `width: auto` RATHER THAN NOTHING. An empty variant value emits no rule, and
     * `G5` fails any declared value the stylesheet has no rule for — correctly, since a class the
     * component renders but nothing styles does nothing. The declaration is also the honest one:
     * `auto` is the initial value this restores when a consumer sets the axis back.
     */
    width: {
      auto: { width: "auto" },
      full: { width: "100%" },
    },
  },
  defaultVariants: {
    visual: "solid",
    size: "md",
    width: "auto",
  },
} satisfies RecipeConfig;
