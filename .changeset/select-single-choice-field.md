---
"@zevaui/components": minor
---

Add `Select`, the single-choice field, and with it the last component of the forms set.

It wraps react-aria-components' `Select` + `ListBox`, so it shares Input's label, description and
validation wiring, and its palette and padding multipliers deliberately: a select that did not line
up with the input beside it in the same form would be the bug, not the saving. The raised surface
takes Menu's instead — `shadow-dropdown` over an opaque `bg-surface`, no border, because
`color-border-strong` measurably fails WCAG 1.4.11 against both backgrounds an overlay can sit on.

Options are typed descriptors (`value`, `label`, optional `description` and `isDisabled`), never
children — the same reason `Menu` and `RadioGroup` give: `role="listbox"` only accepts `option`
children, the collection needs a stable key per row, and the closed trigger derives its text from
the chosen row. One variant axis, `size` (`sm` | `md` | `lg`), matching Input's. No new tokens.

Single selection only. react-aria-components 1.20 added a `selectionMode` of `'multiple'`; this
component does not expose it, so `value` stays a `string` and the trigger always shows one option.

Two absences are deliberate, and both are upstream rather than choices of taste:

- **No `isReadOnly`.** react-aria-components spells its own base as `Omit<InputBase, 'isReadOnly'>`.
  `Input`, `Textarea` and `RadioGroup` all ship the prop; there is nothing underneath this one to
  honour it, and a prop that silently does nothing is worse than an absent one.
- **No `aria-invalid`.** react-aria-components emits it nowhere for a Select, and passing one in
  does not survive its `Button`, whose DOM-prop allowlist carries `data-*` and the labelling ARIA
  attributes but not this one. `Input` and `Textarea` announce the invalid state; **this control
  announces strictly less.** It is accepted rather than worked around for the reason ADR-0006 D3
  accepts its own measured gap: the state is not carried by colour alone — `FieldError` renders
  real text and react-aria wires it into the trigger's `aria-describedby`, so a screen reader user
  still hears what is wrong. The test suite pins the absence, so the day upstream closes it the
  gate says so rather than the gap quietly persisting.

The selection props are react-aria-components' live spelling, not its deprecated one: `value` /
`defaultValue` / `onChange`. `selectedKey`, `defaultSelectedKey` and `onSelectionChange` are all
marked `@deprecated` in 1.20, and none of them reaches this package's public surface.
