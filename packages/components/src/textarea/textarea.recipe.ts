import type { SlotRecipeConfig } from "@pandacss/dev";

export const TEXTAREA_RECIPE_KEY = "textarea";

// The multi-line sibling of Input, and deliberately its OWN recipe rather than a shared fragment:
// all nine recipes in this package import nothing but Panda's type, and Checkbox/Switch/RadioGroup
// established that near-identical controls still keep separate recipes and share their TEST
// contract instead. What is shared here is the argument, not the object.
//
// State is expressed through RAC's data attributes rather than variant axes, matching Input.
// `TextArea` reuses `InputRenderProps` in react-aria-components 1.20, so the attributes below are
// exactly Input's — measured in dist/types/src/Input.d.ts, not assumed:
//   root     -> data-disabled, data-invalid, data-required, data-readonly
//   textarea -> data-hovered, data-focused, data-focus-visible, data-disabled, data-invalid
//   label / description / error carry no state attributes, so anything state-dependent on them
//   has to be driven from the textarea itself.
//
// No new token: the plan reserves `space.input.*` and `radius.input` for both text surfaces, so a
// textarea that drifted from the input it sits beside in a form would be the bug, not the saving.
export const textareaRecipe = {
  className: "zui-textarea",
  slots: ["root", "label", "textarea", "description", "error"],
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
    textarea: {
      width: "100%",
      boxSizing: "border-box",
      // A textarea inherits neither of these from the page the way an input does: without them
      // Chrome hands it a monospace-ish UA font and a baseline-aligned box that sits a few pixels
      // off the inputs beside it in the same form.
      display: "block",
      verticalAlign: "top",
      borderRadius: "input",
      borderWidth: "1px",
      borderStyle: "solid",
      // `border.strong` (not `border.default`) because this boundary is what identifies the
      // control, which is exactly what WCAG 1.4.11 measures — the same floor Input clears against
      // both backgrounds it can sit on. See packages/constraints/README.md and docs/adrs/0010.
      borderColor: "border.strong",
      backgroundColor: "bg.surface",
      color: "text.default",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      // `:not([data-invalid])` is load-bearing, and it is the one place this recipe deliberately
      // does NOT copy `input.recipe.ts`. Specificity, counted on the emitted selectors:
      //
      //   .zui-textarea__textarea[data-hovered]:not([data-disabled])  -> (0,3,0)
      //   .zui-textarea__textarea[data-invalid]                       -> (0,2,0)
      //
      // A `:not()` argument contributes its own weight, so without the third clause the hover
      // rule outranks the invalid rule no matter which order the two are written in: the red
      // border vanishes the moment the pointer touches the field — the one moment the user is
      // looking straight at it. `aria-invalid` never changes, so a screen reader is unaffected
      // and only sighted users lose the signal, which is why nothing else catches it.
      //
      // Review caught this exact bug on `Checkbox` (see checkbox.recipe.ts) and the guard is
      // pinned for this component in textarea.test.ts. Hovering an invalid field therefore
      // changes nothing about its border: the error outranks the affordance.
      "&[data-hovered]:not([data-disabled]):not([data-invalid])": {
        borderColor: "accent.default",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      // Colour is not the sole invalid signal: FieldError renders real text, and RAC sets
      // aria-invalid plus aria-describedby on the textarea, so the state survives without it.
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
    // Both axes style the `textarea` slot only. Panda therefore emits `--size_*` and `--resize_*`
    // rules for that slot alone, which is why slotRecipeClassNames filters per slot instead of
    // stamping every axis onto every slot.
    size: {
      sm: {
        textarea: {
          paddingInline: "calc({spacing.input.px} * 0.75)",
          paddingBlock: "calc({spacing.input.py} * 0.75)",
        },
      },
      md: {
        textarea: {
          paddingInline: "input.px",
          paddingBlock: "input.py",
        },
      },
      lg: {
        textarea: {
          paddingInline: "calc({spacing.input.px} * 1.5)",
          paddingBlock: "calc({spacing.input.py} * 1.5)",
        },
      },
    },
    // The axis exists because `className` is `never`: the browser's own default is `resize: both`,
    // and horizontal resize lets a user drag a field out of its container. Without a prop there is
    // no way for a consumer to reach it. `both` is deliberately NOT offered — an axis that ships
    // the broken mode is not a guard rail.
    resize: {
      vertical: {
        textarea: {
          resize: "vertical",
        },
      },
      none: {
        textarea: {
          resize: "none",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
    resize: "vertical",
  },
} satisfies SlotRecipeConfig;
