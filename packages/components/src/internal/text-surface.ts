// The declarations `Input` and `Textarea` genuinely share, in one place.
//
// `Select` reads the FIELD CHROME below as well — the root's rhythm, the label, the description,
// the error, and the padding steps — because a select stands in a column beside an input and must
// not drift away from it. It deliberately does not read `textSurfaceBase`: that export's
// justification is the shared `InputRenderProps` contract described further down, and a Select
// trigger is a RAC `Button` that does not have it. `select.recipe.ts` decision 5 argues that
// split, and the name of this module stays accurate because the text SURFACE is still the part
// only the two text fields share.
//
// This is the ONLY cross-recipe import in the package, and it needed an argument to earn the
// exception. Eight of the nine other recipes import nothing but Panda's type, and the near-
// identical markable controls (Checkbox, Switch, RadioGroup) deliberately kept separate recipes
// and shared their TEST contract instead.
//
// What makes a text surface different is that the copy DRIFTED, and the drift shipped a bug. The
// hover rule below was fixed on `Checkbox` after review caught it, `Input` never received the
// fix, and `Textarea` was then written by copying `Input` — so the same defect arrived in a brand
// new component through a paste. Review caught it a second time. Two occurrences of one defect,
// both caused by the same duplicate, is the evidence that this particular pair wants one source
// rather than two copies with a convention.
//
// The split is deliberate: these export DECLARATIONS, never a slot wrapper. Each recipe still
// writes its own `{ input: ... }` / `{ textarea: ... }` keys, because the slot name is what
// `slotRecipeClassNames`, `emittedSlotClassNames`, the manifest and gate G5 all key off, and a
// computed key would erase the literal type every one of them depends on.
//
// Anything a single component needs alone — Input's `width: 100%`, Textarea's `display: block`
// and `verticalAlign: top`, Textarea's `resize` axis — stays in that component's own recipe.

/** Vertical rhythm shared by both field roots. Derived from the field's own padding token. */
export const textFieldRoot = {
  display: "flex",
  flexDirection: "column",
  // No generic spacing scale is exposed (only component-scoped space tokens), so the field's
  // internal rhythm is derived from its own vertical padding rather than a foreign token.
  gap: "calc({spacing.input.py} * 0.5)",
};

/** The field label. */
export const textFieldLabel = {
  fontFamily: "body",
  fontSize: "body",
  fontWeight: "body",
  lineHeight: "body",
  color: "text.default",
};

/** Help text, wired to the control through aria-describedby by react-aria-components. */
export const textFieldDescription = {
  fontFamily: "body",
  fontSize: "body",
  lineHeight: "body",
  color: "text.secondary",
};

/** The validation message. Rendered only while the field is invalid. */
export const textFieldError = {
  fontFamily: "body",
  fontSize: "body",
  lineHeight: "body",
  color: "text.danger",
};

/**
 * The styled control itself: box, border, type, and every state rule RAC drives through its data
 * attributes. Spread into the recipe's own styled slot.
 *
 * `TextArea` reuses `InputRenderProps` verbatim in react-aria-components 1.20 — measured in
 * `dist/types/src/Input.d.ts`, not assumed — so both controls carry exactly the same five
 * attributes and one set of state rules is correct for both.
 */
export const textSurfaceBase = {
  boxSizing: "border-box",
  borderRadius: "input",
  borderWidth: "1px",
  borderStyle: "solid",
  // `border.strong` (not `border.default`) because this boundary is what identifies the
  // control, which is exactly what WCAG 1.4.11 measures. It clears the 3.0 floor against both
  // backgrounds the control can sit on (4.84 light / 3.67 dark against bg-surface, its own
  // background; 4.63 light / 4.16 dark against bg-canvas), since the PR2 token repoint — see
  // packages/constraints/README.md and docs/adrs/0010.
  borderColor: "border.strong",
  backgroundColor: "bg.surface",
  color: "text.default",
  fontFamily: "body",
  fontSize: "body",
  fontWeight: "body",
  lineHeight: "body",
  // `:not([data-invalid])` is load-bearing. Specificity, counted on the emitted selectors:
  //
  //   .zui-x__part[data-hovered]:not([data-disabled])  -> (0,3,0)
  //   .zui-x__part[data-invalid]                       -> (0,2,0)
  //
  // A `:not()` argument contributes its own weight, so without the third clause the hover rule
  // outranks the invalid rule no matter which order the two are written in: the red border
  // vanishes the moment the pointer touches the field — the one moment the user is looking
  // straight at it. `aria-invalid` never changes, so a screen reader is unaffected and only
  // sighted users lose the signal, which is why nothing else catches it.
  //
  // Review caught this on `Checkbox`, then again on `Textarea`. Both text surfaces now read the
  // rule from here, so hovering an invalid field changes nothing about its border: the error
  // outranks the affordance.
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
  // aria-invalid plus aria-describedby on the control, so the state survives without it.
  "&[data-invalid]": {
    borderColor: "danger.default",
  },
  "&[data-disabled]": {
    cursor: "not-allowed",
    opacity: 0.5,
  },
};

/**
 * Padding per size step, as bare declarations.
 *
 * Each recipe wraps these in its OWN slot key — `{ sm: { input: textSurfacePadding.sm } }` — so
 * the literal slot name every gate keys off survives. Sharing the wrapper instead would hand
 * those gates an index signature.
 */
export const textSurfacePadding = {
  sm: {
    paddingInline: "calc({spacing.input.px} * 0.75)",
    paddingBlock: "calc({spacing.input.py} * 0.75)",
  },
  md: {
    paddingInline: "input.px",
    paddingBlock: "input.py",
  },
  lg: {
    paddingInline: "calc({spacing.input.px} * 1.5)",
    paddingBlock: "calc({spacing.input.py} * 1.5)",
  },
};
