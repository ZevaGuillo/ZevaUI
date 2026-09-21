import type { SlotRecipeConfig } from "@pandacss/dev";
import {
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
    segment: {
      // Segments are `<span>`s inside the styled box, so they inherit type and colour and only
      // declare what the box cannot give them.
      paddingInline: "1px",
      borderRadius: "input",
      textAlign: "end",
      // Tabular figures stop the field from reflowing as the user types: without them "11" and
      // "22" occupy different widths and every segment to the right shifts.
      fontVariantNumeric: "tabular-nums",
      "&[data-type='literal']": {
        // The separators are not editable and never focusable; dimming them is what makes the
        // editable parts read as editable.
        paddingInline: "0",
        color: "text.secondary",
      },
      "&[data-placeholder]": {
        color: "text.secondary",
      },
      // The focused segment is the one piece of state a date field has that a text input does
      // not: there is no caret, so the highlight IS the cursor. `accent.default` under
      // `text.inverse` is the one inverse pair @zevaui/constraints validates — the same pair
      // Tooltip inverts to — so this cannot drift below the contrast floor.
      "&[data-focused]": {
        backgroundColor: "accent.default",
        color: "text.inverse",
        outline: "none",
      },
      "&[data-disabled]": {
        cursor: "not-allowed",
      },
    },
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
