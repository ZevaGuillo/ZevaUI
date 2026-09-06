---
"@zevaui/components": minor
---

`Button` gains a `width` axis: `auto` (the default) or `full`.

A full-width button was not awkward before this — it was impossible. `Button`'s base is `inline-flex`, so it shrink-wraps its label, and this package types `className` and `style` as `never`, leaving a consumer no supported way to stretch one. Measured in a bare consumer app: of the wrappers a consumer might reach for, only `display: grid` stretched a 54px button to its 600px container; `display: block` and both flex spellings left it at 54px. A contract that depends on knowing grid stretches its children, and only grid, is not a contract.

```tsx
<Button width="full" onPress={submit}>Save</Button>
```

Spelled as an axis rather than a `fullWidth` boolean, to match `Menu`'s existing `width: auto | trigger`. Two components with a width concern should spell it the same way, and an axis has room for a third value that a boolean would have to be deprecated to grow.

`minor`, not `patch`: this is new public API. Rendered width is unchanged at every existing call site — `auto` is the default and emits `width: auto`, which is what an `inline-flex` button already computed. The emitted output does change in two ways worth naming, though. Every button now carries an extra `zui-button--width_auto` class, so an assertion on the exact class string needs updating. And `auto` places a `width` declaration inside `@layer recipes` where the button previously carried none, so a consumer's own `width` rule in an earlier layer — the emitted sheet declares `@layer reset, base, tokens, recipes, utilities` — is now suppressed regardless of its specificity. Unlayered CSS and the `utilities` layer still win.

This is the first of the layout affordances that make `className: never` livable rather than merely strict. The reasoning behind keeping that restriction, and what a consumer *can* still do, is in the README.
