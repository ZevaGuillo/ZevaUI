import type { SlotRecipeConfig } from "@pandacss/dev";

export const CHECKBOX_RECIPE_KEY = "checkbox";

// The first MARKABLE control, and the shape Switch and RadioGroup are meant to inherit. Three
// decisions here are load-bearing for those two, so they are argued rather than stated.
//
// 1. NO NEW TOKENS. Every dimension is derived from a token this component already declares,
//    following the precedent `Button`'s icon gap set: derive in the recipe, and name the trade
//    where a consumer reads it. The box is `calc({fontSizes.body} * N)` because a checkbox's job
//    is to sit level with the sentence beside it — tying it to the body size is what keeps that
//    true when a theme changes its type scale, and a fixed `space.*` value would not. The corner
//    is `radii.input`, not a new `radius.checkbox`: a checkbox IS a form control, and a consumer
//    who rounds their inputs means to round this too. The cost is real and disclosed in the
//    changeset — with `className` typed as `never`, a consumer cannot retune the box
//    independently of their body font size.
//
// 2. THE BOX CARRIES ITS OWN STATE ATTRIBUTES, AND THAT IS A CORRECTNESS FIX, NOT A STYLE.
//    Measured against react-aria-components 1.20 output, not assumed: `Checkbox` renders ONE
//    element carrying state — the `<label>` root — plus a visually hidden `<input>`.
//    `data-selected`, `data-indeterminate`, `data-hovered`, `data-focus-visible`,
//    `data-disabled`, `data-readonly` and `data-invalid` all land there, and the spans this
//    component renders carry none of them.
//
//    The obvious way to repaint the box from the root's state is the ancestor-conditioned
//    `"[data-selected] &"`. It emits `[data-selected] .zui-checkbox__control`, and that selector
//    IS WRONG: the attribute is unqualified, so ANY ancestor carrying it matches — a Menu row
//    under the pointer sets `data-hovered`, and every checkbox inside it would light its border
//    with no pointer near it. Scoping the selector by writing `.zui-checkbox__root[...]` into it
//    trades the bug for a worse one: the class name would be duplicated in a string no gate
//    checks, so renaming the recipe would silently unstyle the control while G5 stayed green.
//
//    So `Checkbox.tsx` stamps the states this box needs onto the box itself, off RAC's render
//    prop, and every rule below is a LOCAL `&[data-*]` — the same shape `input.recipe.ts` uses on
//    its own input slot. The attributes are duplicated between the root and an `aria-hidden`
//    span, which costs a few inert bytes and buys a selector that cannot reach out of the
//    component.
//
// 3. THE MARK IS NOT COLOUR-ONLY. `data-selected` changes the box fill AND reveals a check path;
//    `data-indeterminate` reveals a dash instead. A user who cannot perceive the accent fill
//    still sees a glyph appear, which is the WCAG 1.4.1 requirement rather than a nicety.
export const checkboxRecipe = {
  className: "zui-checkbox",
  slots: ["root", "control", "indicator", "label"],
  base: {
    root: {
      display: "inline-flex",
      alignItems: "center",
      // Derived from the body size for the same reason the box is: the space between a control
      // and its sentence is a typographic measure, not a layout one.
      gap: "calc({fontSizes.body} * 0.5)",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
      cursor: "pointer",
      // The whole row is the hit target, and RAC already wires the hidden input to this label.
      // Selecting the text on a double-click would fight the click that toggles it.
      userSelect: "none",
      "&[data-disabled]": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
      "&[data-readonly]": {
        cursor: "default",
      },
    },
    control: {
      // `flex: none` keeps the box square when the label wraps to a second line: without it the
      // box is a flex item that shrinks to the leftover width and stops being a square.
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      borderRadius: "input",
      borderWidth: "1px",
      borderStyle: "solid",
      // `border.strong`, not `border.default`, for the reason `Input` gives: this boundary is
      // what identifies the control, which is exactly what WCAG 1.4.11 measures.
      borderColor: "border.strong",
      backgroundColor: "bg.surface",
      // The mark inherits this, so the check and the dash need no colour of their own.
      color: "text.inverse",
      // `:not([data-invalid])` is a CORRECTNESS guard, not a stylistic preference, and it was
      // added after the review caught the bug. Specificity, counted on the emitted selectors:
      //
      //   .zui-checkbox__control[data-hovered]:not([data-disabled])  -> (0,3,0)
      //   .zui-checkbox__control[data-invalid]                       -> (0,2,0)
      //
      // A `:not()` argument contributes its own weight, so the hover rule outranked the invalid
      // rule no matter what order they were written in. The consequence was visible and exactly
      // backwards: an invalid checkbox LOST its red border the moment the pointer touched it —
      // the one moment the user is looking straight at it. `aria-invalid` on the real input never
      // changed, so a screen reader was unaffected and only sighted users lost the signal.
      //
      // Excluding invalid from the hover tint is the fix that keeps both rules honest, rather
      // than inflating the invalid rule's specificity to win an arms race. Hovering an invalid
      // control therefore changes nothing about its border, which is the correct precedence: the
      // error outranks the affordance.
      "&[data-hovered]:not([data-disabled]):not([data-invalid])": {
        borderColor: "accent.default",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      // Both marked states paint the same fill. The glyph inside is what distinguishes them.
      "&[data-selected], &[data-indeterminate]": {
        backgroundColor: "accent.default",
        borderColor: "accent.default",
      },
      // Colour is not the sole invalid signal: RAC sets aria-invalid on the input, so the state
      // survives for a user who cannot perceive the red.
      "&[data-invalid]": {
        borderColor: "danger.default",
      },
      "&[data-invalid][data-selected], &[data-invalid][data-indeterminate]": {
        backgroundColor: "danger.default",
        borderColor: "danger.default",
      },
    },
    indicator: {
      // Hidden by default and revealed by state, rather than mounted and unmounted: the box keeps
      // one layout in both states, so nothing shifts when the control is toggled.
      display: "block",
      inlineSize: "100%",
      blockSize: "100%",
      // `currentColor` inherits `control`'s `text.inverse`, which is why no colour is declared
      // here. G2 forbids a literal colour anyway, and a token would duplicate the box's.
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "3",
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    label: {
      // No colour or family of its own: it inherits the root's, which is the single place this
      // component's typography is declared.
      minWidth: "0",
    },
  },
  variants: {
    // Styles `control` and `root` only. Panda emits `--size_*` rules for exactly those two slots,
    // which is why `slotRecipeClassNames` filters per slot instead of stamping every axis onto
    // every slot — the `label` and `indicator` slots must NOT pick up a size class.
    size: {
      sm: {
        control: {
          inlineSize: "calc({fontSizes.body} * 0.875)",
          blockSize: "calc({fontSizes.body} * 0.875)",
        },
        root: { gap: "calc({fontSizes.body} * 0.375)" },
      },
      md: {
        control: {
          inlineSize: "calc({fontSizes.body} * 1.125)",
          blockSize: "calc({fontSizes.body} * 1.125)",
        },
        root: { gap: "calc({fontSizes.body} * 0.5)" },
      },
      lg: {
        control: {
          inlineSize: "calc({fontSizes.body} * 1.375)",
          blockSize: "calc({fontSizes.body} * 1.375)",
        },
        root: { gap: "calc({fontSizes.body} * 0.625)" },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
