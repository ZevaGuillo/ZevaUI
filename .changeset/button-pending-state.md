---
"@zevaui/components": minor
---

`Button` gains a pending state: `isPending` plus a required `pendingLabel`.

```tsx
<Button isPending={isSaving} pendingLabel="Saving" onPress={save}>
  Save
</Button>
```

This is the state a button is in between a press and the answer, and until now a consumer had
exactly two ways to spell it, both wrong. `isDisabled` says *you may not do this* — a judgement
about permission when the truth is *you already did, wait* — and it drops the button from the tab
order, moving a keyboard user's focus to nowhere in the middle of their own action. Swapping the
label for a spinner in `children` resizes the button under the pointer that just pressed it.

Pending keeps the button focusable and in the tab order, carries `aria-disabled` so assistive tech
knows the press will not land, suppresses presses and hover, and downgrades a `type="submit"`
button to `type="button"` — implicit form submission goes through the browser's own default-button
lookup, never through the button's press handling, so suppressing the handler alone would not have
stopped Enter in a text field from submitting.

**The spinner is rendered by the system, not composed by the caller, and that is forced rather than
preferred.** The obvious spelling — `iconStart={<Spinner label="Saving" />}` — is silently broken:
the icon slots are `aria-hidden` by contract, because icons there are decoration, which strips the
spinner's accessible name and with it the announcement react-aria-components builds on
`ProgressBarContext`. The button would spin and say nothing. The indicator therefore gets its own
box that is never hidden, and while pending it takes `iconStart`'s place rather than sitting beside
it; `iconEnd` is untouched. **If you are currently passing a spinner through `iconStart`, move it to
`isPending`** — the README's own example of that pattern has been corrected.

`pendingLabel` is required alongside `isPending` and the compiler enforces it: the two are a
discriminated union, not two optional props. The reason is the one `Spinner`'s own `label` already
gives — the indicator is a `role="progressbar"`, a control with no programmatic name fails the
blocking accessibility gate, and this package refuses to invent one. Passing `isPending` without a
label no longer type-checks; so does passing `pendingLabel` without `isPending`.

**That label is also heard on the button itself, which is worth knowing before you write one.** It
is real text in the accessibility tree — that is what names the indicator — and a button takes its
accessible name from its own content, so while pending the two combine, indicator first:
`<Button isPending pendingLabel="Saving">Save</Button>` announces **"Saving Save"**. Measured, not
assumed, and pinned to that exact string in the test suite. It is the right trade: a screen-reader
user hears what the control is and that it is busy. Pick a `pendingLabel` that reads as a sentence
beside your own label — `"Saving"` next to `Save`, not `"Please wait"`.

Pending deliberately does not borrow the disabled treatment. `[data-disabled]` is dimmed to half
opacity with a `not-allowed` cursor; `[data-pending]` stays at full strength with `cursor: progress`
and no opacity change. Dimming would make the two states indistinguishable, which is the confusion
this state was added to remove. Both hooks are attributes react-aria-components already sets, so the
class contract of every button that exists today is unchanged — pending is state, not a variant.

**One cost, measured rather than estimated.** `Button` now imports `Spinner`, moving its bundle
entry from 13,771 B to 16,643 B gzipped (+2,872 B, +20.9%), and its hand-decided ceiling was raised
to 18,308 B. `Dialog` (+2,026 B) and `Menu` (+2,003 B) grew too, since both render a `Button`, and
both stay under their existing ceilings — `Dialog` with 397 B to spare, which is worth knowing
before the next change that touches `Button`. If you import the barrel the cost is 85 B, because
`Spinner` was already in it. The whole ledger is in `bundle-budget.json`.
