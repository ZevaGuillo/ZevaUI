import type { SlotRecipeConfig } from "@pandacss/dev";

export const INPUT_RECIPE_KEY = "input";

// The first slot recipe in the system. `satisfies` (not a type annotation) preserves the literal
// slot/variant shape, which input.types.ts derives `InputSize` from and the manifest builder
// derives the emitted class list from.
//
// State is expressed through RAC's data attributes rather than variant axes, matching Button.
// The attributes below were measured against react-aria-components 1.20 output, not assumed:
//   root  -> data-disabled, data-invalid, data-required
//   input -> data-hovered, data-focused, data-focus-visible, data-disabled, data-invalid
//   label / description / error carry no state attributes, so anything state-dependent on them
//   has to be driven from the input itself.
export const inputRecipe = {
  className: "zui-input",
  slots: ["root", "label", "input", "description", "error"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      // No generic spacing scale is exposed (only component-scoped space tokens), so the field's
      // internal rhythm is derived from its own vertical padding rather than a foreign token.
      gap: "calc({spacing.input.py} * 0.5)",
    },
    label: {
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
    },
    input: {
      width: "100%",
      boxSizing: "border-box",
      borderRadius: "input",
      borderWidth: "1px",
      borderStyle: "solid",
      // `border.strong` (not `border.default`) because this boundary is what identifies the
      // control, which is exactly what WCAG 1.4.11 measures. It now clears the 3.0 floor
      // against both backgrounds the input can sit on (4.84 light / 3.67 dark against
      // bg-surface, its own background; 4.63 light / 4.16 dark against bg-canvas), since the
      // PR2 token repoint — see packages/constraints/README.md and docs/adrs/0010.
      borderColor: "border.strong",
      backgroundColor: "bg.surface",
      color: "text.default",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      "&[data-hovered]:not([data-disabled])": {
        borderColor: "accent.default",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      // Colour is not the sole invalid signal: FieldError renders real text, and RAC sets
      // aria-invalid plus aria-describedby on the input, so the state survives without it.
      "&[data-invalid]": {
        borderColor: "danger.default",
      },
      "&[data-disabled]": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
    },
    description: {
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      color: "text.secondary",
    },
    error: {
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      color: "text.danger",
    },
  },
  variants: {
    // Styles the `input` slot only. Panda therefore emits `--size_*` rules for that slot alone,
    // which is why slotRecipeClassNames filters per slot instead of stamping every axis onto
    // every slot.
    size: {
      sm: {
        input: {
          paddingInline: "calc({spacing.input.px} * 0.75)",
          paddingBlock: "calc({spacing.input.py} * 0.75)",
        },
      },
      md: {
        input: {
          paddingInline: "input.px",
          paddingBlock: "input.py",
        },
      },
      lg: {
        input: {
          paddingInline: "calc({spacing.input.px} * 1.5)",
          paddingBlock: "calc({spacing.input.py} * 1.5)",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
