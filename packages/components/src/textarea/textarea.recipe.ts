import type { SlotRecipeConfig } from "@pandacss/dev";
import {
  textFieldDescription,
  textFieldError,
  textFieldLabel,
  textFieldRoot,
  textSurfaceBase,
  textSurfacePadding,
} from "../internal/text-surface.js";

export const TEXTAREA_RECIPE_KEY = "textarea";

// The multi-line sibling of Input. Both read their shared declarations from
// `../internal/text-surface.js`, which carries the argument for why these two share a source while
// the other eight recipes import nothing but Panda's type. `Select` reads the field chrome from
// there as well, but not `textSurfaceBase`: only these two are driven by one `InputRenderProps`
// contract.
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
    root: textFieldRoot,
    label: textFieldLabel,
    textarea: {
      width: "100%",
      // A textarea inherits neither of these from the page the way an input does: without them
      // Chrome hands it a baseline-aligned box that sits a few pixels off the inputs beside it in
      // the same form.
      display: "block",
      verticalAlign: "top",
      ...textSurfaceBase,
    },
    description: textFieldDescription,
    error: textFieldError,
  },
  variants: {
    // Both axes style the `textarea` slot only. Panda therefore emits `--size_*` and `--resize_*`
    // rules for that slot alone, which is why slotRecipeClassNames filters per slot instead of
    // stamping every axis onto every slot.
    size: {
      sm: { textarea: textSurfacePadding.sm },
      md: { textarea: textSurfacePadding.md },
      lg: { textarea: textSurfacePadding.lg },
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
