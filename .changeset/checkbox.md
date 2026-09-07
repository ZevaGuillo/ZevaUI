---
"@zevaui/components": minor
---

`Checkbox` — the first form control, and the first markable one.

```tsx
<Checkbox isSelected={accepted} onChange={setAccepted}>
  Accept the terms
</Checkbox>
```

The label is `children` and it is **required**, for the same reason `Input`'s `label` is: a control without a programmatic name fails the blocking accessibility gate, so the type refuses it rather than letting a story catch it later. A checkbox that must carry no visible label — the select-all cell in a table header is the honest case — passes a visually-hidden element. That is a layout decision, not a reason to ship an unnamed control.

**The third state ships with it.** `isIndeterminate` is what a select-all needs when its group is partly chosen, and it is a real state rather than a styling flag: it sets the native `indeterminate` DOM property, which is what makes assistive tech announce "mixed". No `aria-checked` is involved — react-aria sets none, and adding one would be redundant ARIA over a native control. That last sentence is measured, after an assertion against `aria-checked="mixed"` failed and was corrected.

The glyph is an SVG path, not a `"✓"` character. A text checkmark renders in whatever font resolves on the consumer's page — the one thing this package cannot control — so it arrives as a different shape, or as a missing-glyph box, depending on what the system substitutes.

**No new tokens**, following the precedent `Button`'s icon gap set: derive in the recipe, and name the trade where a consumer reads it. The box is `calc({fontSizes.body} * N)` because a checkbox's job is to sit level with the sentence beside it, and tying it to the body size is what keeps that true when a theme changes its type scale. The corner is `radii.input`: a checkbox is a form control, and a consumer who rounds their inputs means to round this too. **The cost is real** — with `className` typed as `never`, you cannot retune the box independently of your body font size. If that ever needs to be themeable, it is tokens across three themes, not one.

`size` is `sm | md | lg` and scales both the box and its gap to the label, at `0.875` / `1.125` / `1.375` and `0.375` / `0.5` / `0.625` of the body size.

**A bug caught while writing it, worth naming because Switch and RadioGroup would have inherited it.** react-aria puts every state attribute on the root `<label>` and none on the spans this component renders, so the obvious way to repaint the box is the ancestor-conditioned `[data-selected] &`. That emits `[data-selected] .zui-checkbox__control`, and the attribute is unqualified — **any** ancestor carrying it matches. A `Menu` row under the pointer sets `data-hovered`, and every checkbox inside it would light its border with no pointer near it. Scoping the selector by writing the root class into it trades that for a worse bug: the class name would live in a string no gate checks, so renaming the recipe would silently unstyle the control while `G5` stayed green. So `Checkbox` stamps the states its box needs onto the box itself, off react-aria's render prop, and every rule is a local `&[data-*]`. A test asserts no emitted checkbox rule contains a state attribute that is not attached to a checkbox class.

**A second bug, this one caught by the review rather than by me, and it is the more interesting of the two.** Specificity, counted on the emitted selectors:

```
.zui-checkbox__control[data-hovered]:not([data-disabled])  -> (0,3,0)
.zui-checkbox__control[data-invalid]                       -> (0,2,0)
```

A `:not()` argument carries its own weight, so the hover tint outranked the invalid border no matter what order the two rules were written in. The consequence was visible and exactly backwards: **an invalid checkbox lost its red border the moment the pointer touched it** — the one moment the user is looking straight at it. `aria-invalid` never changed, so a screen reader was unaffected and only sighted users lost the signal, which is why nothing else would have caught it.

The fix excludes invalid from the hover tint rather than inflating the invalid rule to win a specificity arms race. Hovering an invalid control now changes nothing about its border: the error outranks the affordance. Guarded at both altitudes — a unit gate on the emitted selector, and a story that measures `getComputedStyle` on three rendered controls in a real browser. Both were confirmed to fail against the unfixed recipe, in all three themes, rather than assumed to.

Disabled, read-only, required and invalid are all wired. Invalid paints the box `danger` and is not colour-only: react-aria sets `aria-invalid` on the real input, so the state survives for a user who cannot perceive the change. A single checkbox renders no error text of its own — the message for "you must accept the terms" belongs to the field that groups it, and `CheckboxGroup` does not ship yet.

Bundle: **+2076 B gzip on the barrel** (57001 → 59077, ceiling 62534), 15913 B imported alone. Measured against `main`, not estimated.

The ledger in `bundle-budget.json` also catches up four entries that were last recorded before the `width` axis and the icon slots landed — `Card` 673 → 711, `Button` 13611 → 13771, `Dialog` 25666 → 25811, `Menu` 51086 → 51232. Those deltas belong to those changes, not to this one; every entry stays under its ceiling.
