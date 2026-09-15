// The declarations `Progress` and `Spinner` genuinely share, in one place — and the one written
// record of how react-aria-components' `ProgressBar` names itself.
//
// EXTRACTED WHEN THE SECOND CONSUMER ARRIVED, NOT BEFORE, which is the same rule
// `internal/text-surface.ts` was written under: `Input` shipped alone with its declarations
// inline, and the shared module appeared only once `Textarea` made the pair real. `Progress`
// shipped alone the same way. `Spinner` is the second `ProgressBar` in this package, so the pair
// is real now.
//
// What makes THIS pair worth one source is narrower than what made the text surfaces worth one.
// There, the evidence was a defect that had already shipped twice through a paste. Here the
// evidence is a CONTRACT that is easy to get wrong once and impossible to notice: the accessible
// name of a `ProgressBar` does not come from a prop, and a component that assumed otherwise would
// render a silently unnamed control. So the module carries the measured facts as much as the
// declarations.
//
// MEASURED IN `react-aria-components@1.20.0`, NOT ASSUMED:
//
//   * There is NO `Spinner` export. The package ships `ProgressBar/` and `Meter/`, and a busy
//     indicator IS an indeterminate progress bar — same role, same primitive.
//   * `ProgressBarProps extends Omit<AriaProgressBarProps, 'label'>` — so `label` is NOT a prop.
//     The component publishes `LabelContext` to its children with `elementType: 'span'`, and that
//     span is what `aria-labelledby` points at. react-aria's own comment gives the reason: a
//     progress bar is not an HTML input element, so a real `<label>` here would be a label for no
//     control at all. Both components therefore render RAC's `<Label>` as a CHILD.
//   * `ProgressBarRenderProps` is `{ percentage, valueText, isIndeterminate }`, and the documented
//     selector for the indeterminate state is `:not([aria-valuenow])` — the attribute is DROPPED
//     rather than set to something.
//   * `dist/types/exports/ProgressBar.d.ts` does `import 'client-only'`, so every component built
//     on it is `clientOnly: true` in the registry. That is upstream's decision, not a judgement
//     call this package gets to make.
//
// The split follows text-surface.ts exactly: these export DECLARATIONS, never a slot wrapper.
// Each recipe still writes its own `{ root: ... }` / `{ label: ... }` keys, because the slot name
// is the literal `slotRecipeClassNames`, `emittedSlotClassNames`, the manifest and gate G5 all key
// off, and a computed key would erase the literal type every one of them depends on.
//
// Anything one component needs alone stays in its own recipe: Progress's column layout and
// `inlineSize: 100%`, Spinner's inline row and its ring, Progress's track/fill/valueText slots
// entirely, Spinner's visually-hidden label branch.

/**
 * Everything a `ProgressBar` root owns before its own layout: the typographic rhythm between the
 * control and its label, and the typography itself.
 *
 * The gap is derived from the body size rather than from a `space.*` token, the same argument
 * Checkbox makes for its own: the distance between a label and the thing it names is a
 * typographic measure, so it has to move when a theme changes its type scale. No generic spacing
 * scale is exposed either — only component-scoped space tokens — so there is nothing else to
 * reach for.
 *
 * The four type declarations and the colour are what gate G11 demands of every component: a
 * recipe that declares no `color` and no `font-family` anywhere in its own namespace defers the
 * whole question to the consumer's page, and on a page that sets nothing that means the User
 * Agent's black on a dark surface. Declaring them here means both components satisfy G11 by
 * construction rather than by each remembering.
 */
export const progressSurfaceRoot = {
  gap: "calc({fontSizes.body} * 0.375)",
  fontFamily: "body",
  fontSize: "body",
  fontWeight: "body",
  lineHeight: "body",
  color: "text.default",
};

/**
 * The label slot, for both.
 *
 * No colour and no family of its own: it inherits the root's, which is the single place either
 * component's typography is declared. What it does need is to be allowed to SHRINK — a flex item
 * defaults to `min-width: auto`, which refuses to go below its longest word, so a long label
 * pushes the row wider instead of wrapping inside it. Progress hits this with a value text it
 * must not squeeze; Spinner hits it with a ring it must not squash.
 */
export const progressSurfaceLabel = {
  minWidth: "0",
};
