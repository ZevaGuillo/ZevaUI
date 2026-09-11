import type { SlotRecipeConfig } from "@pandacss/dev";
import {
  textFieldDescription,
  textFieldError,
  textFieldLabel,
  textFieldRoot,
  textSurfaceBase,
  textSurfacePadding,
} from "../internal/text-surface.js";

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
//
// The shared declarations live in `../internal/text-surface.js`, which `Textarea` reads from too.
// That module carries the argument for why this one pair shares a source while the other eight
// recipes import nothing but Panda's type — short version: these two drifted, and the drift
// shipped the hover/invalid specificity bug twice.
export const inputRecipe = {
  className: "zui-input",
  slots: ["root", "label", "input", "description", "error"],
  base: {
    root: textFieldRoot,
    label: textFieldLabel,
    input: {
      width: "100%",
      ...textSurfaceBase,
    },
    description: textFieldDescription,
    error: textFieldError,
  },
  variants: {
    // Styles the `input` slot only. Panda therefore emits `--size_*` rules for that slot alone,
    // which is why slotRecipeClassNames filters per slot instead of stamping every axis onto
    // every slot.
    size: {
      sm: { input: textSurfacePadding.sm },
      md: { input: textSurfacePadding.md },
      lg: { input: textSurfacePadding.lg },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
