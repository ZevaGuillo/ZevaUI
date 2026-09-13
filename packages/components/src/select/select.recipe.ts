import type { SlotRecipeConfig } from "@pandacss/dev";
import {
  textFieldDescription,
  textFieldError,
  textFieldLabel,
  textFieldRoot,
  textSurfacePadding,
} from "../internal/text-surface.js";

export const SELECT_RECIPE_KEY = "select";

// The last component of the forms batch, and the first that is BOTH a field and an overlay: it
// owes `Input` its resting appearance and `Menu` its raised surface. Four decisions are
// load-bearing and argued rather than stated.
//
// 1. NO NEW TOKENS. The trigger is a form control that stands in a column beside `Input` and
//    `Textarea`, so it takes their exact palette and metrics — `space.input.*`, `radius.input`,
//    `border.strong`, `bg.surface`. The popover takes `Menu`'s — `radius.card`, `shadow.dropdown`
//    over an opaque `bg.surface`, and no border, because `color-border-strong` measurably fails
//    WCAG 1.4.11 against both backgrounds an overlay can sit on (see ADR-0005 and
//    packages/constraints/README.md).
//
// 2. THE TRIGGER CARRIES STATE ATTRIBUTES IT DOES NOT NATURALLY OWN, AND THAT IS THE ESTABLISHED
//    FIX, NOT A SHORTCUT. Measured against react-aria-components 1.20, not assumed: `Select`
//    puts `data-open`, `data-invalid`, `data-required`, `data-disabled`, `data-focused` and
//    `data-focus-visible` on the ROOT, while the trigger is a RAC `Button` whose own render props
//    are only hover/press/focus/disabled. The obvious repaint is the ancestor-conditioned
//    `"[data-invalid] &"`, and `checkbox.recipe.ts` already rejected it with the reason: the
//    attribute is unqualified, so ANY ancestor carrying it matches — a Menu row under the pointer
//    sets `data-hovered`, and every select inside it would light up with no pointer near it.
//    `Select.tsx` therefore stamps `data-invalid` and `data-open` onto the trigger and the
//    chevron off the root's render prop, and every rule below is a LOCAL `&[data-*]`.
//
// 3. `:not([data-invalid])` ON THE HOVER RULE IS A CORRECTNESS GUARD. Specificity, counted on the
//    emitted selectors:
//
//      .zui-select__trigger[data-hovered]:not([data-disabled])  -> (0,3,0)
//      .zui-select__trigger[data-invalid]                       -> (0,2,0)
//
//    A `:not()` argument contributes its own weight, so an unguarded hover rule outranks the
//    invalid rule in ANY source order and an invalid select loses its red border the moment the
//    pointer touches it. Review caught this on `Checkbox` and `Textarea`; it is spelled correctly
//    here from the start, and `select.test.ts` asserts it against the real emitted stylesheet.
//
// 4. THE SELECTED ROW'S TINT IS NOT THE ONLY CARRIER OF THE SELECTION, so WCAG 1.4.1 holds
//    without a glyph. What the user reads for "which one is chosen" is the CLOSED TRIGGER, which
//    renders the chosen option's text at all times and is the only view that exists while the
//    list is shut. Inside the open list, `aria-selected` carries it programmatically. The
//    `bg.muted` tint is a redundant convenience for a sighted user — the same role the platform's
//    own `<select>` gives it — not the signal itself.
//
//    The tint excludes hover for the reason decision 3 gives: `&[data-hovered]` would outrank
//    `&[data-selected]` and the chosen row would lose its tint under the pointer.
//
// 5. THE SHARED FIELD CHROME IS READ FROM `internal/text-surface.ts`; THE TEXT SURFACE ITSELF IS
//    NOT. That module exists because `Input` and `Textarea` drifted and the drift shipped the
//    hover/invalid bug twice, and it holds the package's only cross-recipe import. Select reads
//    the declarations whose correctness depends on nothing but appearance: the field column's
//    rhythm, the label, the help text, the error text, and the trigger's padding steps.
//
//    It deliberately does NOT spread `textSurfaceBase`. The argument that earned that export is
//    that `TextArea` reuses `InputRenderProps` verbatim in RAC 1.20, so one set of state rules is
//    provably correct for both. That premise does not reach this trigger: it is a RAC `Button`
//    whose own render props are only hover/press/focus/disabled, `data-invalid` arrives solely
//    because `Select.tsx` stamps it off the root (decision 2), it owns a state neither text
//    surface has (`data-open`), and it announces strictly less than they do (see the
//    `aria-invalid` note in `Select.tsx`). Sharing declarations whose justification does not hold
//    would seat a false premise inside a module whose entire purpose is one TRUE source. The
//    drift is caught the way `Checkbox`, `Switch` and `RadioGroup` catch theirs instead — by
//    contract: `select.test.ts` asserts the guard in decision 3 against the emitted stylesheet.
export const selectRecipe = {
  className: "zui-select",
  slots: [
    "root",
    "label",
    "trigger",
    "value",
    "icon",
    "description",
    "error",
    "popover",
    "listbox",
    "item",
    "itemLabel",
    "itemDescription",
  ],
  base: {
    root: textFieldRoot,
    label: textFieldLabel,
    // Not `...textSurfaceBase`, and decision 5 carries the argument: these declarations match
    // Input's to the byte today, but the render-prop contract that makes that export shareable is
    // one this trigger does not have.
    trigger: {
      width: "100%",
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      // The value takes the room and the chevron sits at the end, so a long option truncates
      // rather than pushing the affordance out of the box.
      justifyContent: "space-between",
      gap: "calc({fontSizes.body} * 0.5)",
      textAlign: "start",
      borderRadius: "input",
      borderWidth: "1px",
      borderStyle: "solid",
      // `border.strong` (not `border.default`) because this boundary is what identifies the
      // control, which is exactly what WCAG 1.4.11 measures. It clears the 3.0 floor against both
      // backgrounds the control can sit on since the PR2 token repoint — see ADR-0010.
      borderColor: "border.strong",
      backgroundColor: "bg.surface",
      color: "text.default",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      cursor: "pointer",
      // The trigger is a button wrapping text; dragging across it while aiming at the chevron
      // should not start a selection.
      userSelect: "none",
      // See decision 3. Both `:not()` clauses are load-bearing.
      "&[data-hovered]:not([data-disabled]):not([data-invalid])": {
        borderColor: "accent.default",
      },
      // An open select keeps the accent boundary while the list is up, so the trigger and the
      // surface below it read as one control. Stamped by Select.tsx, never read off an ancestor.
      "&[data-open]:not([data-disabled]):not([data-invalid])": {
        borderColor: "accent.default",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      // Colour is not the sole invalid signal: `FieldError` renders real text and RAC wires it
      // into the trigger's `aria-describedby` — measured on `useField`, the only source of ARIA
      // on `triggerProps`. That hook sets no `aria-invalid`, and nothing else in the Select path
      // does either, so this control says WHAT is wrong without announcing that it IS invalid.
      // `Select.tsx` carries the full argument; `select.test.ts` pins the absence.
      "&[data-invalid]": {
        borderColor: "danger.default",
      },
      "&[data-disabled]": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
    },
    value: {
      // Truncates instead of wrapping: the trigger is one line tall by construction, and a
      // wrapping value would push the chevron out of the box.
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      // The placeholder is dimmer than a real value, and `text.muted` is contrast-validated
      // against `bg.surface` — the trigger's own background (see contract.json).
      "&[data-placeholder]": {
        color: "text.muted",
      },
    },
    icon: {
      // A pure-CSS chevron: a square with two borders, rotated. No SVG asset, no font glyph, and
      // it inherits the trigger's colour through `currentcolor`, so it needs no token of its own
      // and can never drift from the text beside it.
      flex: "none",
      boxSizing: "border-box",
      inlineSize: "calc({fontSizes.body} * 0.4)",
      blockSize: "calc({fontSizes.body} * 0.4)",
      borderRightWidth: "2px",
      borderBottomWidth: "2px",
      borderRightStyle: "solid",
      borderBottomStyle: "solid",
      borderColor: "currentcolor",
      // Sized in `em` off the body scale and nudged up by the half-diagonal the rotation adds, so
      // it stays optically centred on the text line at every size.
      transform: "translateY(-0.15em) rotate(45deg)",
      transitionProperty: "transform",
      transitionDuration: "120ms",
      transitionTimingFunction: "ease-out",
      // Stamped by Select.tsx off the root's render prop, for the reason decision 2 gives.
      "&[data-open]": {
        transform: "translateY(0.1em) rotate(225deg)",
      },
      "@media (prefers-reduced-motion: reduce)": {
        transitionProperty: "none",
      },
    },
    description: textFieldDescription,
    error: textFieldError,
    popover: {
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      backgroundColor: "bg.surface",
      color: "text.default",
      borderRadius: "card",
      boxShadow: "dropdown",
      overflow: "hidden",
      // The surface spans the trigger exactly, which is what makes a select read as an expansion
      // of the field rather than as a floating menu. `--trigger-width` is written onto the
      // popover as an inline custom property by RAC's own `Popover` (measured on the 1.20 dist);
      // it is not a design token and never touches the `--zui-*` bridge, so G1/G4 stay intact.
      width: "var(--trigger-width)",
      // Only `transform` animates, never `opacity`: no ancestor can then dim the text inside it,
      // the same rule Dialog's scrim and Menu's popover follow.
      transitionProperty: "transform",
      transitionDuration: "120ms",
      transitionTimingFunction: "ease-out",
      "&[data-entering]": { transform: "translateY(-0.25rem)" },
      "&[data-exiting]": { transform: "translateY(-0.25rem)" },
      '&[data-placement="top"][data-entering]': { transform: "translateY(0.25rem)" },
      '&[data-placement="top"][data-exiting]': { transform: "translateY(0.25rem)" },
      "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
    },
    listbox: {
      display: "flex",
      flexDirection: "column",
      margin: "0",
      paddingInline: "0",
      paddingBlock: "calc({spacing.card.py} * 0.5)",
      // react-aria writes the available height onto the popover as an inline `max-height`, so the
      // list inherits it and scrolls inside the surface instead of overflowing the viewport.
      maxHeight: "inherit",
      overflowY: "auto",
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      color: "text.default",
      // The visible focus indicator lives on the focused ROW, not on this container: react-aria
      // moves DOM focus onto the individual options, so a ring here would only ever flash.
      outline: "none",
    },
    item: {
      display: "flex",
      flexDirection: "column",
      gap: "calc({spacing.button.py} * 0.25)",
      color: "text.default",
      cursor: "pointer",
      userSelect: "none",
      outline: "none",
      // Every background state excludes a disabled row on purpose, the same reason menu.recipe.ts
      // gives: `color-text-muted` is only contrast-validated against `color-bg-surface` and
      // `color-bg-canvas` (contract.json), and tinting a disabled row would leave that validated
      // pairing and quietly drop below 4.5:1.
      //
      // Hover also excludes the SELECTED row: `&[data-hovered]:not([data-disabled])` is (0,3,0)
      // against `&[data-selected]`'s (0,2,0), so without the guard the chosen row would lose its
      // tint under the pointer — the same specificity trap decision 3 describes on the trigger.
      "&[data-hovered]:not([data-disabled]):not([data-selected])": {
        backgroundColor: "bg.subtle",
      },
      "&[data-focused]:not([data-disabled]):not([data-selected])": {
        backgroundColor: "bg.subtle",
      },
      // See decision 4: redundant with the closed trigger's text and with aria-selected, never
      // the sole carrier of the selection.
      "&[data-selected]": {
        backgroundColor: "bg.muted",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        // Inset, because the popover clips its overflow — an outward ring on the first or last
        // row would be cut in half.
        outlineOffset: "-2px",
      },
      "&[data-disabled]": {
        cursor: "not-allowed",
        color: "text.muted",
      },
    },
    itemLabel: {
      fontFamily: "body",
      fontWeight: "body",
      lineHeight: "body",
    },
    itemDescription: {
      fontFamily: "body",
      lineHeight: "body",
      color: "text.secondary",
    },
  },
  variants: {
    // Purely geometric, like every other axis in this package: a tone axis would need a coloured
    // boundary, and the only strong-enough neutral this system ships fails WCAG 1.4.11.
    //
    // The trigger's padding is READ from Input's own steps rather than re-typed, so a select and
    // an input of the same `size` cannot drift apart in a form. The rows track `Menu`'s
    // multipliers, so an open list reads like one.
    size: {
      sm: {
        trigger: textSurfacePadding.sm,
        item: {
          paddingInline: "calc({spacing.card.px} * 0.75)",
          paddingBlock: "calc({spacing.button.py} * 0.5)",
        },
        itemLabel: { fontSize: "calc({fontSizes.body} * 0.9375)" },
        itemDescription: { fontSize: "calc({fontSizes.body} * 0.8125)" },
      },
      md: {
        trigger: textSurfacePadding.md,
        item: { paddingInline: "card.px", paddingBlock: "button.py" },
        itemLabel: { fontSize: "body" },
        itemDescription: { fontSize: "calc({fontSizes.body} * 0.875)" },
      },
      lg: {
        trigger: textSurfacePadding.lg,
        item: {
          paddingInline: "calc({spacing.card.px} * 1.25)",
          paddingBlock: "calc({spacing.button.py} * 1.5)",
        },
        itemLabel: { fontSize: "calc({fontSizes.body} * 1.125)" },
        itemDescription: { fontSize: "body" },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
