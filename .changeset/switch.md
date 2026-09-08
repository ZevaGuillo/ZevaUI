---
"@zevaui/components": minor
---

`Switch` — the second markable control, and the first one that could not simply copy the first.

```tsx
<Switch isSelected={notify} onChange={setNotify}>
  Enable notifications
</Switch>
```

The label is `children` and it is **required**, same rule as `Checkbox` and `Input`: a control without a programmatic name fails the blocking accessibility gate, so the type refuses it rather than letting a story catch it later.

**It is built on `SwitchField` + `SwitchButton`, not on `Switch`, and that is a correctness decision rather than a preference.** Measured against react-aria-components 1.20, not assumed:

- The flat `Switch` is marked `@deprecated Use SwitchField + SwitchButton instead`.
- `SwitchProps` **omits `isRequired`, `isInvalid`, `validate`, `validationState` and `validationBehavior`** from the props it inherits, and `SwitchRenderProps` declares neither `isInvalid` nor `isRequired`.

So a switch built on the flat component could not have offered the two states `Checkbox` already has. The gap is upstream, not one this package was free to design around. The cost is named rather than hidden: **one extra wrapper element** compared to `Checkbox`, whose root *is* its label. `Checkbox` still uses the flat (also deprecated) component; aligning it is a separate change, because it would re-render every one of its screenshot baselines.

`size` is `sm | md | lg`. The track's block size matches `Checkbox`'s box at the same size, so the two sit level in one form; its inline size is twice that, which is what makes it read as a switch rather than as a rounded checkbox.

**The state is not colour-only, and the mechanism differs from `Checkbox`'s.** A checkbox reveals a glyph; a switch moves its thumb from one end of the track to the other. Position is a non-chromatic difference, which is what WCAG 1.4.1 asks for, and RAC's `role="switch"` means assistive tech announces on/off besides. A story measures the thumb's offset as a fraction of the track in a real browser, so the claim rests on layout rather than on the declaration that produces it.

**No new tokens**, following `Checkbox` and `Button`'s icon gap: every dimension derives from `fontSizes.body`, because a switch's job is to sit level with the sentence beside it. The one literal is the pill corner. `9999px` is not a themeable design value but the *definition* of the shape — a switch with a 4px corner is not a switch — and `border-radius` at that length always resolves to half the box height, so a single literal is correct at every size with no per-size artwork. `radii` exposes `button`, `card` and `input` and has no `full`, so the alternative was a `radius.switch` token across three themes that no consumer should ever retune. Dimension literals already have precedent here (`border-width: 1px`, `outline-width: 2px` in the checkbox recipe); only **colour** literals are forbidden.

The thumb is a circle at every size via `align-self: stretch` + `aspect-ratio: 1`, with no length arithmetic: a fixed size would have to be recomputed per `size` variant and would drift the moment the padding or border changed.

**Known gap, stated rather than left to be discovered: the thumb does not animate.** It is moved by flipping `justify-content`, which does not transition. Three reasons, in order of weight: a transition mid-capture is a real source of flake in the screenshot gate; nothing else in this package animates, so this would be the first and would arrive without the `prefers-reduced-motion` handling that obligation implies; and the flip is correct at every size with no length arithmetic. Adding motion later is additive and does not change this API.

**The specificity bug review caught on `Checkbox` is guarded here before it could be re-introduced.** It is identical:

```
.zui-switch__track[data-hovered]:not([data-disabled])  -> (0,3,0)
.zui-switch__track[data-invalid]                       -> (0,2,0)
```

A `:not()` argument carries its own weight, so without the `:not([data-invalid])` guard the hover tint outranks the invalid border regardless of source order, and an invalid switch loses its red border the moment the pointer touches it — the one moment the user is looking straight at it. `aria-invalid` never changes, so only sighted users would lose the signal. Guarded at both altitudes, like `Checkbox`: a unit assertion on the emitted selector, and a story that measures `getComputedStyle` on three rendered controls in a real browser.

The same goes for the ancestor-selector trap: state attributes are stamped on the track itself off RAC's render prop, so every rule is a local `&[data-*]`. A bare `[data-hovered] .zui-switch__track` would match **any** hovered ancestor — a `Menu` row, a `Card` — and light every switch inside it. A test asserts no emitted switch rule contains a state attribute that is not attached to a switch class.

Disabled, read-only, required and invalid are all wired, plus the space-bar keyboard contract. A single switch renders no error text of its own, matching `Checkbox`: that message belongs to the field that groups it.

Bundle: **+851 B gzip on the barrel** (59077 → 59928, ceiling 62534), 15583 B imported alone. The delta is small because `Switch` shares nearly all of its react-aria runtime with `Checkbox` — a consumer who already has one pays very little for the other. Measured, not estimated.
