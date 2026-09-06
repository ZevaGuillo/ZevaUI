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
    /**
     * The box `Button.tsx` wraps `iconStart`/`iconEnd` in. Selected by ATTRIBUTE, not by class,
     * and that is a constraint rather than a preference: `G5 (reverse)` fails any emitted
     * `zui-button__*` class no registered recipe declares, and only a SLOT recipe derives `__slot`
     * classes — this recipe is flat. Converting it would rename `.zui-button` to
     * `.zui-button__root` and break every consumer stylesheet plus `Menu`, which renders a
     * `Button`. The attribute costs no class-contract change and reads like the `&[data-disabled]`
     * hook right above it.
     *
     * `flexShrink: 0` is the load-bearing declaration. With `width="full"` and a long label the
     * icon is an ordinary flex item, and the label would squash it; the other two only keep an
     * `svg` centred on the label's baseline box rather than sitting on the text baseline.
     */
    "& > [data-zui-icon]": {
      display: "flex",
      alignItems: "center",
      flexShrink: 0,
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
    /**
     * `gap` rides on `size` rather than on `base` so the space between an icon and its label
     * scales with the button, the same way the padding already does. Each value is
     * `spacing.button.px` times HALF that size's own padding ratio (0.75 -> 0.375, 1 -> 0.5,
     * 1.5 -> 0.75), which keeps the gap visibly tighter than the horizontal padding at every
     * size — an icon that sits as far from its label as the label sits from the button edge
     * reads as two separate things rather than one.
     *
     * DERIVED IN THE RECIPE, NOT A TOKEN, deliberately. The alternative — a semantic
     * `space.button.gap` — would have to be declared in all three themes and would then be ONE
     * value that does not scale across `sm`/`md`/`lg` unless it were three. This mirrors how
     * `sm`/`lg` already derive their padding from `md`'s tokens by fixed ratio. The trade is
     * real and worth naming: because `className` is `never`, a consumer cannot retune this gap.
     * If that ever needs to be themeable, three tokens are the answer, not one.
     *
     * WHAT THIS CHANGES FOR BUTTONS THAT ALREADY EXIST, stated precisely rather than reassuringly.
     * A text-only button is a single anonymous flex item, and `gap` between one item and nothing
     * has no effect, so the overwhelmingly common call site is untouched. But `children` is an
     * unrestricted `ReactNode`, so a caller who already passes MULTIPLE element children —
     * `<Button><span>a</span><span>b</span></Button>` — now gets this gap between them where they
     * had none. That is a real, if narrow, visual change and it is disclosed in the README and the
     * changeset rather than described here as "no effect".
     *
     * The second consequence is cascade, not layout: `gap` is a declaration this component did not
     * previously emit, and it lands in `@layer recipes`. A consumer rule setting `gap` on
     * `.zui-button` from an earlier layer (`reset`, `base`, `tokens`) is now suppressed regardless
     * of its specificity. Unlayered CSS and the `utilities` layer still win. Same shape as the
     * `width` axis before it, and named for the same reason.
     */
    size: {
      sm: {
        paddingInline: "calc({spacing.button.px} * 0.75)",
        paddingBlock: "calc({spacing.button.py} * 0.75)",
        gap: "calc({spacing.button.px} * 0.375)",
      },
      md: {
        paddingInline: "button.px",
        paddingBlock: "button.py",
        gap: "calc({spacing.button.px} * 0.5)",
      },
      lg: {
        paddingInline: "calc({spacing.button.px} * 1.5)",
        paddingBlock: "calc({spacing.button.py} * 1.5)",
        gap: "calc({spacing.button.px} * 0.75)",
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
