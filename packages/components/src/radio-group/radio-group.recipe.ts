import type { SlotRecipeConfig } from "@pandacss/dev";

export const RADIO_GROUP_RECIPE_KEY = "radioGroup";

// The third markable control, and the first that is a GROUP rather than a control. Where Checkbox
// and Switch each answer one yes/no question, this one asks a question and offers N answers, and
// the difference shows up in three places that are argued here rather than quietly diverged.
//
// 1. THE VALIDATION LIVES ON THE GROUP, NOT ON THE OPTION. Measured against react-aria-components
//    1.20: `RadioGroupProps` carries `isRequired` and `isInvalid`, and `AriaRadioProps` does not.
//    That is upstream getting it right — a single radio has nothing to be required about, the
//    QUESTION does — and it inverts what Checkbox and Switch do, where the control validates
//    itself. So the invalid boundary is painted on every option's marker while the state that
//    decides it is stamped on the root, and the two are wired through the render prop rather
//    than through a descendant selector, for the reason in (2).
//
// 2. THE STATE ATTRIBUTES ARE STAMPED ON THE MARKER, third time and same reason. An unqualified
//    `[data-hovered] .zui-radio-group__marker` matches ANY hovered ancestor — a Menu row, a Card
//    — and would light every radio inside it with no pointer near it. `RadioGroup.tsx` stamps
//    what the marker needs onto the marker, off `RadioButton`'s render prop, and every rule below
//    is a local `&[data-*]`. The shared gate in `__tests__/support/markable-control-css.ts`
//    asserts exactly this, and this component is its third consumer.
//
// 3. WHY `RadioField` + `RadioButton` AND NOT `Radio`, and why the reason is NOT Switch's.
//    RAC 1.20 marks the flat `Radio` `@deprecated Use RadioField + RadioButton instead`, so the
//    split is where upstream is going. But the resemblance to Switch stops there, and copying
//    Switch's justification would be false: Switch had to move because the deprecated flat
//    component OMITTED `isRequired`/`isInvalid` from its props, a real capability gap. Here there
//    is none — `RadioProps` and `RadioFieldProps` extend the same `Omit<AriaRadioProps,
//    'children'>`, and `RadioButtonRenderProps extends RadioRenderProps`, so the deprecated
//    component is fully capable. The only cost paid is one extra wrapper element, bought with
//    nothing but not being deprecated. Named plainly because a future reader comparing the three
//    markable controls deserves to know the two situations were different.
//
// 4. THE CORNER IS A LITERAL, FOLLOWING SWITCH RATHER THAN CHECKBOX. Checkbox uses
//    `borderRadius: "input"` because a checkbox IS a form control and a consumer who rounds their
//    inputs means to round it too. That argument does not survive the trip: a radio with a 4px
//    corner is not a radio, it is a small square. `9999px` is the DEFINITION of the shape, not a
//    themeable value — the same reasoning switch.recipe.ts gives for its pill. This deliberately
//    departs from the component plan, which had called for a `radius.radio` token across three
//    themes; that token would be one no consumer should ever retune.
export const radioGroupRecipe = {
  className: "zui-radio-group",
  slots: ["root", "label", "list", "option", "control", "marker", "dot", "optionLabel"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      // A typographic measure, like Checkbox's row gap: the distance from a question to its
      // answers belongs to the type scale, not to a layout grid.
      gap: "calc({fontSizes.body} * 0.5)",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
      // Disabling the GROUP dims the whole question, label included, which is the honest
      // rendering: the question is unavailable, not merely its answers.
      "&[data-disabled]": {
        opacity: 0.5,
      },
    },
    label: {
      // Slightly heavier than the options it governs, so the question reads as the question. No
      // colour of its own: it inherits the root's, which is the single place this component's
      // typography is declared.
      fontWeight: "medium",
    },
    list: {
      display: "flex",
      // Vertical is the default because a list of answers is read down a column, and because a
      // horizontal group silently truncates on a narrow viewport. The `orientation` variant flips
      // it, and only that variant does.
      flexDirection: "column",
      gap: "calc({fontSizes.body} * 0.5)",
    },
    option: {
      display: "flex",
    },
    control: {
      display: "inline-flex",
      alignItems: "center",
      gap: "calc({fontSizes.body} * 0.5)",
      cursor: "pointer",
      // The whole row is the hit target and RAC wires the hidden input to this label. Selecting
      // the text on a double click would fight the click that chooses the option.
      userSelect: "none",
      // A disabled OPTION dims only itself. The group-level rule above handles the other case,
      // and the two compose rather than conflict: a disabled option inside a disabled group is
      // dimmed once by each, which is the same visual result either way.
      "&[data-disabled]": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
      "&[data-readonly]": {
        cursor: "default",
      },
    },
    marker: {
      // `flex: none` keeps the circle round when the label wraps: without it the marker is a flex
      // item that shrinks to the leftover width and becomes an ellipse. Same trap Checkbox names.
      flex: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      // See (4): the shape, not a themeable value.
      borderRadius: "9999px",
      borderWidth: "1px",
      borderStyle: "solid",
      // `border.strong`, not `border.default`, for the reason Input and Checkbox give: this
      // boundary is what identifies the control, which is what WCAG 1.4.11 measures.
      borderColor: "border.strong",
      backgroundColor: "bg.surface",
      // The `:not([data-invalid])` guard is a CORRECTNESS fix inherited from the bug review found
      // on Checkbox, not a stylistic preference. Counted on the emitted selectors:
      //
      //   .zui-radio-group__marker[data-hovered]:not([data-disabled])  -> (0,3,0)
      //   .zui-radio-group__marker[data-invalid]                       -> (0,2,0)
      //
      // A `:not()` argument carries its own weight, so without the guard the hover tint outranks
      // the invalid border regardless of source order and an invalid group loses its red boundary
      // the moment the pointer touches an option. The error outranks the affordance.
      "&[data-hovered]:not([data-disabled]):not([data-invalid])": {
        borderColor: "accent.default",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      // Selected paints the ring, and the dot inside is what makes the state non-chromatic. The
      // marker keeps its surface fill rather than flooding with accent the way Checkbox's box
      // does: a filled circle with a lighter dot reads as a radio, a solid accent disc does not.
      "&[data-selected]": {
        borderColor: "accent.default",
      },
      "&[data-invalid]": {
        borderColor: "danger.default",
      },
    },
    dot: {
      // THE STATE IS NOT COLOUR-ONLY, which is the WCAG 1.4.1 requirement rather than a nicety.
      // Checkbox reveals a glyph and Switch moves its thumb; a radio reveals a dot. The dot is
      // scaled to nothing when unselected rather than hidden, so there is one element in the DOM
      // either way and no layout shift on selection.
      borderRadius: "9999px",
      backgroundColor: "accent.default",
      width: "50%",
      height: "50%",
      transform: "scale(0)",
      // THE DOT CARRIES ITS OWN `data-selected`, rather than being reached from the marker's.
      //
      // The two obvious alternatives are both worse, and both were considered. A nested
      // `&[data-selected] .zui-radio-group__dot` on the marker would hardcode another slot's
      // class name into a selector string that no gate checks — the exact trade
      // checkbox.recipe.ts refuses, because renaming the recipe would then silently unstyle the
      // dot while G5 stayed green. A recipe VARIANT would make the reveal a group-level class
      // when the state is per-option, which is simply the wrong shape.
      //
      // Stamping the attribute on the dot too costs a handful of inert bytes and buys a rule that
      // is local, gate-checked and correct per option. Same trade the marker itself makes.
      "&[data-selected]": {
        transform: "scale(1)",
      },
    },
    optionLabel: {
      // No colour or family of its own: it inherits the root's. `minWidth: 0` lets a long answer
      // wrap instead of forcing the row wider than its container.
      minWidth: "0",
    },
  },
  variants: {
    size: {
      sm: {
        marker: {
          width: "calc({fontSizes.body} * 0.875)",
          height: "calc({fontSizes.body} * 0.875)",
        },
      },
      md: {
        marker: { width: "calc({fontSizes.body} * 1)", height: "calc({fontSizes.body} * 1)" },
      },
      lg: {
        marker: { width: "calc({fontSizes.body} * 1.25)", height: "calc({fontSizes.body} * 1.25)" },
      },
    },
    orientation: {
      vertical: {},
      horizontal: {
        // `wrap` rather than a scroll container: a horizontal group that overflows should fold,
        // because an answer a user cannot see is an answer they cannot choose.
        list: { flexDirection: "row", flexWrap: "wrap", columnGap: "calc({fontSizes.body} * 1)" },
      },
    },
  },
  defaultVariants: {
    size: "md",
    orientation: "vertical",
  },
} satisfies SlotRecipeConfig;
