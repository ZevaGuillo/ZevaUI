import type { SlotRecipeConfig } from "@pandacss/dev";

export const SWITCH_RECIPE_KEY = "switch";

// The second markable control, and a deliberate test of whether Checkbox's shape actually
// generalises. Most of it does; the parts that do not are argued here rather than quietly
// diverged.
//
// 1. WHY FIVE SLOTS WHERE CHECKBOX HAS FOUR. Measured against react-aria-components 1.20, not
//    assumed: `SwitchField` renders a `<div>` and `SwitchButton` renders the `<label>` inside it,
//    so there are two structural wrappers before the control is reached. Checkbox's root IS its
//    label and needs only one. The extra element is the price of the non-deprecated API — RAC
//    1.20 marks the flat `Switch` `@deprecated` AND omits `isRequired`/`isInvalid` from its
//    props, so the flat component could not reach parity with Checkbox at all. `root` is the
//    field, `control` is the clickable row, and `track`/`thumb` are the control itself.
//
// 2. THE STATE ATTRIBUTES ARE STAMPED ON THE TRACK, for exactly the reason checkbox.recipe.ts
//    gives at length and which is not repeated here: an ancestor-conditioned
//    `[data-selected] .zui-switch__track` is UNQUALIFIED, so any ancestor carrying the attribute
//    matches it — a hovered Menu row would light every switch inside it. `Switch.tsx` stamps
//    what the track needs onto the track, off `SwitchButton`'s render prop, and every rule below
//    is a local `&[data-*]`.
//
// 3. THE `:not([data-invalid])` GUARD ON HOVER IS CARRIED OVER ON PURPOSE, and it is the single
//    most valuable thing inherited from Checkbox. The specificity, counted on the emitted
//    selectors, is identical here:
//
//      .zui-switch__track[data-hovered]:not([data-disabled])  -> (0,3,0)
//      .zui-switch__track[data-invalid]                       -> (0,2,0)
//
//    A `:not()` argument carries its own weight, so without the guard the hover tint outranks
//    the invalid border no matter the source order, and an invalid switch loses its red border
//    the moment the pointer touches it. That bug was found by review on Checkbox and would have
//    been re-introduced verbatim here. The error outranks the affordance.
//
// 4. THE STATE IS NOT COLOUR-ONLY, and the mechanism differs from Checkbox's. Checkbox reveals a
//    glyph; a switch moves its thumb from one end of the track to the other. Position is a
//    non-chromatic difference, which is what WCAG 1.4.1 asks for, and RAC's `role="switch"`
//    means assistive tech announces on/off besides.
//
// 5. NO ANIMATION, deliberately. Sliding the thumb would need a `transform` transition, and the
//    thumb is moved by flipping `justifyContent` instead — which does not animate. Three
//    reasons, in order of weight: a transition mid-capture is a real source of flake in the
//    screenshot gate; nothing else in this package animates, so this would be the first and
//    would arrive without the `prefers-reduced-motion` handling that obligation implies; and the
//    flip is correct at every size with no length arithmetic. Named in the changeset as a known
//    gap rather than left for someone to discover.
//
// 6. NO NEW TOKENS, following Checkbox and Button's icon gap. Every dimension derives from
//    `fontSizes.body`, because a switch's job is to sit level with the sentence beside it. The
//    one literal is the track and thumb corner: `9999px` is not a themeable design value but the
//    DEFINITION of a pill — a switch with a 4px corner is not a switch — and `borderRadius` at
//    that length always resolves to half the box height, so one literal is correct at every size
//    with no per-size artwork. Dimension literals already have precedent in this package
//    (`borderWidth: "1px"`, `outlineWidth: "2px"` in checkbox.recipe.ts); only COLOUR literals
//    are forbidden by G2. `radii` exposes `button`, `card` and `input` and has no `full`, so the
//    alternative was a `radius.switch` token across three themes that no consumer should ever
//    retune.
export const switchRecipe = {
  className: "zui-switch",
  slots: ["root", "control", "track", "thumb", "label"],
  base: {
    // The `SwitchField` wrapper. It owns the typography so that `control` and `label` inherit it
    // from one place, the same single-declaration-site rule Checkbox's root follows.
    root: {
      display: "inline-flex",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
    },
    // The `SwitchButton` label: the clickable row, and the element RAC associates the hidden
    // input with. Clicking the text toggles the control because of that association, not because
    // of a handler.
    control: {
      display: "inline-flex",
      alignItems: "center",
      // A typographic measure, not a layout one — see the same gap on Checkbox's root.
      gap: "calc({fontSizes.body} * 0.5)",
      cursor: "pointer",
      // The whole row is the hit target. Selecting the text on a double-click would fight the
      // click that toggles it.
      userSelect: "none",
      // RAC stamps these on the label itself, so no ancestor selector is involved.
      "&[data-disabled]": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
      "&[data-readonly]": {
        cursor: "default",
      },
    },
    track: {
      // `flex: none` keeps the track its own width when the label wraps to a second line:
      // without it the track is a flex item that shrinks to the leftover width. Checkbox needs
      // the same guard for the same reason, and its story measures the consequence.
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      // The thumb is moved by flipping this, not by translating it. See note 5 above.
      justifyContent: "flex-start",
      boxSizing: "border-box",
      padding: "2px",
      // The pill. See note 6 on why this is a literal rather than a token.
      borderRadius: "9999px",
      borderWidth: "1px",
      borderStyle: "solid",
      // `border.strong`, not `border.default`: this boundary is what identifies the control,
      // which is exactly what WCAG 1.4.11 measures.
      borderColor: "border.strong",
      // The off state reads as recessed rather than as an empty surface, so the track is
      // distinguishable from the page behind it in all three themes.
      backgroundColor: "bg.muted",
      // See note 3: excluding invalid from the hover tint is what keeps the red border from
      // being outranked by a pointer.
      "&[data-hovered]:not([data-disabled]):not([data-invalid])": {
        borderColor: "accent.default",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      "&[data-selected]": {
        backgroundColor: "accent.default",
        borderColor: "accent.default",
        justifyContent: "flex-end",
      },
      // Colour is not the sole invalid signal: RAC sets aria-invalid on the real input, so the
      // state survives for a user who cannot perceive the red.
      "&[data-invalid]": {
        borderColor: "danger.default",
      },
      "&[data-invalid][data-selected]": {
        backgroundColor: "danger.default",
        borderColor: "danger.default",
      },
    },
    thumb: {
      // `alignSelf: stretch` plus `aspectRatio: 1` is what makes the thumb a circle exactly as
      // tall as the track's content box, at every size, with no length arithmetic and no
      // per-size value. A fixed size would have to be recomputed for each `size` variant and
      // would drift the moment the padding or border changed.
      alignSelf: "stretch",
      aspectRatio: "1",
      borderRadius: "9999px",
      // Reads against both the muted off-track and the accent on-track. Deliberately NOT
      // `text.inverse`: that token is defined to sit on an accent fill, and here the thumb must
      // also sit on `bg.muted` in the off state.
      backgroundColor: "bg.surface",
    },
    label: {
      // No colour or family of its own: it inherits the root's, which is the single place this
      // component's typography is declared.
      minWidth: "0",
    },
  },
  variants: {
    // Styles `track` and `control` only. Panda emits `--size_*` rules for exactly those two
    // slots, which is why `slotRecipeClassNames` filters per slot — `root`, `thumb` and `label`
    // must NOT pick up a size class. The track's block size matches Checkbox's box at the same
    // size so the two controls sit level in one form; the inline size is twice that, which is
    // what makes it read as a switch rather than as a rounded checkbox.
    size: {
      sm: {
        track: {
          blockSize: "calc({fontSizes.body} * 0.875)",
          inlineSize: "calc({fontSizes.body} * 1.75)",
        },
        control: { gap: "calc({fontSizes.body} * 0.375)" },
      },
      md: {
        track: {
          blockSize: "calc({fontSizes.body} * 1.125)",
          inlineSize: "calc({fontSizes.body} * 2.25)",
        },
        control: { gap: "calc({fontSizes.body} * 0.5)" },
      },
      lg: {
        track: {
          blockSize: "calc({fontSizes.body} * 1.375)",
          inlineSize: "calc({fontSizes.body} * 2.75)",
        },
        control: { gap: "calc({fontSizes.body} * 0.625)" },
      },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
