---
"@zevaui/components": minor
---

Add `Progress`, the bar that reports how far along an operation is.

It wraps react-aria-components' `ProgressBar`, so it publishes `role="progressbar"` with
`aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext` and formats the value through
`Intl.NumberFormat`. `label` is required and visible, for the same reason `Input`'s is: a control
without a programmatic name fails the blocking accessibility gate.

`value`, `minValue` and `maxValue` describe the range; `formatOptions` and `valueLabel` describe
how it reads. The default format is `{ style: "percent" }`, which formats the POSITION IN THE
RANGE rather than the raw number — so `value={5} maxValue={10}` reads "50%", and `{ style:
"decimal" }` reads "5".

`isIndeterminate` covers progress of unknown extent: the bar sweeps a partial sliver instead of
filling, no value text is rendered, and `aria-valuenow` is dropped. The sliver is deliberately
never the full track, including under `prefers-reduced-motion: reduce` where the sweep is
cancelled and it parks at the start — a full accent bar would claim the operation had finished.

One variant axis, `size` (`sm` | `md` | `lg`, default `md`), which sets the track height only. The
corner reuses `radius.input` rather than introducing a token: body size is `0.875rem`, so the three
track heights are 3.5px, 5.25px and 7px, and a 4px radius is at least half of every one of them —
the pill shape falls out of a token this package already bridges.

Two firsts worth knowing about, because both change what the package does rather than only what it
looks like:

- **The fill's width is the package's first inline style.** A percentage that changes on every
  render has no class to hang off, and a static stylesheet cannot name it. It is the only
  declaration in that object, and a test asserts it stays that way.
- **The package now ships `@keyframes`.** A looping sweep has no pair of states a transition could
  interpolate between. A component declares its keyframes beside its recipe and carries them on its
  registry entry, so `panda.config.ts` derives them the same way it derives recipes and never
  hand-lists one.
