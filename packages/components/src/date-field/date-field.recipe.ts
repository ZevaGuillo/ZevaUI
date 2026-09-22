import type { SlotRecipeConfig } from "@pandacss/dev";
import {
  dateSegment,
  textFieldDescription,
  textFieldError,
  textFieldLabel,
  textFieldRoot,
  textSurfaceBase,
  textSurfacePadding,
} from "../internal/text-surface.js";

export const DATE_FIELD_RECIPE_KEY = "dateField";

// The third component to read `../internal/text-surface.js`, after Input and Textarea, and the
// first to read `textSurfaceBase` without sharing their `InputRenderProps` contract. That needed
// checking rather than assuming, so the two contracts were compared in
// react-aria-components 1.20's `dist/types/src/DateField.d.ts` and `Input.d.ts`:
//
//   Input     -> data-hovered, data-focused,      data-focus-visible, data-disabled, data-invalid
//   DateInput -> data-hovered, data-focus-within, data-focus-visible, data-disabled, data-invalid
//
// They differ in exactly one attribute: `Input` reports `data-focused`, `DateInput` reports
// `data-focus-within` — which is the honest difference between a control that IS the focus target
// and a control that CONTAINS several. `textSurfaceBase` keys on four attributes (hovered,
// focus-visible, invalid, disabled) and `data-focused` is not among them, so every rule it
// exports lands correctly on a `DateInput`. That is why this recipe reuses it instead of
// re-deriving a near-copy — the precise failure mode that module was extracted to stop.
//
// `Select` still does not read `textSurfaceBase`, and that stays right: its trigger is a RAC
// `Button`, which carries none of these five.
export const dateFieldRecipe = {
  className: "zui-date-field",
  slots: ["root", "label", "input", "segment", "description", "error"],
  base: {
    root: textFieldRoot,
    label: textFieldLabel,
    input: {
      // A date input is a ROW of segments, not a single text run: the box is shared but the
      // content model is not, so the layout is the one thing this slot adds over the surface it
      // inherits. `width: fit-content` rather than Input's `100%` because the content has a known
      // width — a date is always the same number of characters — and a field stretched across a
      // form column would leave the segments stranded at its left edge.
      display: "flex",
      width: "fit-content",
      whiteSpace: "nowrap",
      ...textSurfaceBase,
    },
    // Moved to `internal/text-surface.ts` when `DatePicker` became the second component built out
    // of `DateSegment`s. Both read the one object, so the two cannot drift — `date-picker.test.ts`
    // asserts that by IDENTITY rather than equality.
    segment: dateSegment,
    description: textFieldDescription,
    error: textFieldError,
  },
  variants: {
    // Styles the `input` slot only, exactly as Input's does, so the two line up when they sit in
    // the same form column. Panda emits `--size_*` rules for that slot alone, which is why
    // `slotRecipeClassNames` filters per slot.
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
