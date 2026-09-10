---
"@zevaui/components": minor
---

`RadioGroup` — the third markable control, and the first that is a **group** rather than a control.

```tsx
<RadioGroup
  label="How should we contact you?"
  value={channel}
  onChange={setChannel}
  options={[
    { value: "email", label: "Email" },
    { value: "sms", label: "Text message" },
    { value: "none", label: "Do not contact me" },
  ]}
/>
```

**The answers are data, not children.** `options` takes a typed `RadioOptionDescriptor[]`, the same shape `MenuItemDescriptor` uses, and the argument applies harder here. Accepting children would hand the consumer the option element itself — which is structure, not content — and with it every way to break what a radio group depends on: the shared `name`, the one-of-N invariant, the label-to-input association. A typed descriptor keeps the DOM shape fixed and the accessible name mandatory, and it is why this component can honestly type `className` as `never`: there is no part left for a consumer to reach.

`label` is required, same rule as `Checkbox`, `Switch` and `Input`: a group without a programmatic name fails the blocking accessibility gate, so the type refuses it rather than letting a story catch it later.

**`isRequired` and `isInvalid` live on the GROUP, and that inverts what the other two markable controls do.** Measured against react-aria-components 1.20, not assumed: `RadioGroupProps` carries both, `AriaRadioProps` carries neither. That is upstream getting it right — a single radio has nothing to be required about, the *question* does — and it has a consequence worth stating, because it also had to be corrected during implementation after an assertion asserted the opposite: **`aria-invalid` is emitted on the radiogroup and on none of the inputs.** A screen reader announces the problem once on entering the group instead of repeating it on every option the user arrows past. An implementation that stamped it per input would look more thorough and be worse. A story pins it.

**It is built on `RadioField` + `RadioButton` rather than the flat `Radio`, and the reason is NOT `Switch`'s.** Copying that justification would have been false, so it is named plainly: RAC 1.20 marks the flat `Radio` `@deprecated Use RadioField + RadioButton instead`, but unlike `Switch` there is **no capability gap** here — `RadioProps` and `RadioFieldProps` extend the same `Omit<AriaRadioProps, 'children'>`, and `RadioButtonRenderProps extends RadioRenderProps`. The deprecated component is fully capable. The only cost paid is one extra wrapper element, and the only thing bought is not being deprecated. A future reader comparing the three markable controls deserves to know the two situations were different.

`size` is `sm | md | lg`. `orientation` is `vertical | horizontal`, defaulting to vertical because a list of answers is read down a column and a horizontal group truncates on a narrow viewport. Horizontal **wraps rather than scrolls**: an answer a user cannot see is an answer they cannot choose. A story measures the laid-out rows, because `flex-wrap: wrap` in the computed style is the input and a second row is the outcome.

**The state is not colour-only, and the mechanism is this control's own.** A checkbox reveals a glyph, a switch moves its thumb, a radio reveals a dot — each a non-chromatic difference, which is what WCAG 1.4.1 asks for. The dot is scaled to nothing when unselected rather than hidden, so there is one element in the DOM either way and choosing an answer never shifts the row. A story asserts the unselected dot has a **zero box while still being in the document**, which is the claim, rather than asserting a `background-color` that would pass on an invisible element.

**The dot carries its own `data-selected`**, rather than being reached from the marker's, and the two obvious alternatives were both considered and are both worse. A nested `&[data-selected] .zui-radio-group__dot` would hardcode another slot's class name into a selector string no gate reads — the exact trade `checkbox.recipe.ts` already refuses, because renaming the recipe would then silently unstyle the dot while `G5` stayed green. A recipe *variant* would make the reveal a group-level class when the state is per-option, which is simply the wrong shape. Stamping the attribute costs a handful of inert bytes and buys a rule that is local, gate-checked and correct per option.

**Two disabled rules, not one.** Disabling the group dims the whole question, label included — the question is unavailable, not merely its answers. Disabling one option dims only its own row. They compose rather than conflict.

**The corner is `9999px`, following `Switch` and not `Checkbox`.** `Checkbox` uses `radii.input` because a checkbox *is* a form control and a consumer who rounds their inputs means to round it too; that argument does not survive the trip, because a radio with a 4px corner is not a radio, it is a small square. This deliberately departs from the component plan, which had called for a `radius.radio` token across three themes — a token no consumer should ever retune. No new tokens ship: every other dimension derives from `fontSizes.body`.

**The specificity bug review caught on `Checkbox` is guarded here before it could be re-introduced**, identical to `Switch`'s:

```
.zui-radio-group__marker[data-hovered]:not([data-disabled])  -> (0,3,0)
.zui-radio-group__marker[data-invalid]                       -> (0,2,0)
```

A `:not()` argument carries its own weight, so without the `:not([data-invalid])` guard the hover tint outranks the invalid border regardless of source order, and an invalid group loses its red boundary the moment the pointer touches an option. `aria-invalid` never changes, so only sighted users would lose the signal. Guarded at both altitudes, like the other two: a unit assertion on the emitted selector, and a story that measures `getComputedStyle` on rendered controls in a real browser. That story renders **two groups** rather than three controls in one, and that is forced rather than stylistic — validity is a property of the group here, so "an invalid option beside a valid one" does not exist in this component.

State attributes are stamped on the marker off RAC's render prop, third time and same reason: a bare `[data-hovered] .zui-radio-group__marker` would match **any** hovered ancestor — a `Menu` row, a `Card` — and light every radio inside it with no pointer near it.

The keyboard contract is the one thing this control does **not** share with `Checkbox` and `Switch`, which each own a tab stop and toggle on space. A radio group owns **one tab stop for the whole question**; the arrow keys move between answers and select as they go, and they skip a disabled answer rather than stopping on it. Stories cover all three, because a group that gave every option its own tab stop would pass every other check in the file.

This component renders no error text of its own, matching the other two: the message belongs to the field that groups the control, and no such component ships yet.

## Bundle

**19136 B gzip imported alone** (ceiling 21050), **+2045 B on the barrel** (59928 → 61973, ceiling 62534). Measured, not estimated.

The interesting number is neither of those, and it is the reason it is written down: **`RadioGroup` is the first markable control that does not mostly ride on its siblings' runtime.** Measured marginal cost, each on top of what a consumer already has:

| already imported | `Switch` adds | `RadioGroup` adds |
| --- | --- | --- |
| `Checkbox` | +786 B | **+5043 B** |
| `Menu` | +3104 B | +4109 B |
| the whole barrel | +851 B | +2045 B |

`Checkbox` and `Switch` overlap almost entirely — 14797 B of their runtime is shared — so a consumer who has one very nearly gets the other for free. `RadioGroup` shares 14093 B with `Checkbox` and brings **5043 B that neither sibling has**. The cause was not isolated, and is not guessed at here; only the cost is reported.

**The barrel now has 561 B of headroom under its ceiling**, down from 2606 B. That ceiling is a human decision and is deliberately left untouched by this change — but the next component to land on the barrel will not fit under it, and that is worth knowing before it is discovered by a red gate.

The ledger also catches up `Card` 710 → 711 B, a one-byte drift that belongs to an earlier change rather than to this one. Every entry stays under its ceiling.
