---
"@zevaui/components": minor
---

Add `Spinner`, the busy indicator for an operation of unknown extent.

It is built on the same react-aria-components `ProgressBar` primitive as `Progress`, held
permanently indeterminate — measured, not assumed: RAC 1.20 ships no `Spinner` of its own (only
`ProgressBar` and `Meter`), and an indeterminate progress bar already publishes exactly the
contract a busy indicator owes. The root is a `role="progressbar"` with `aria-valuenow` and
`aria-valuetext` absent, which is the state assistive tech announces as busy with no measurable
extent.

There is no `value`, no `minValue`/`maxValue`, no `formatOptions`, and no `isIndeterminate` flag,
and their absence is the feature: this component cannot be talked into claiming progress it does
not know about. A caller who has a number wants `Progress`.

`label` is required, for the same reason `Progress`'s and `Input`'s are: a control without a
programmatic name fails the blocking accessibility gate. What is new here is that hiding it is a
real prop. `labelVisibility` (`hidden` | `visible`, default `hidden`) chooses whether the name is
also drawn, because the spinner people mean is a bare ring in a button, a cell, or the corner of a
card — and with `className` typed `never` there is no escape hatch to hide it with. The hiding uses
the clip-rect pattern, never `display: none`: the element is the one `aria-labelledby` points at,
so removing it from the accessibility tree would leave the spinner unnamed while looking identical
on screen.

One more variant axis, `size` (`sm` | `md` | `lg`, default `md`), which sets the ring's outer
diameter and its stroke. Both are derived from the body type scale rather than fixed in pixels, so
a spinner beside a line of text scales when a theme changes its type scale. No token was added or
bridged: the circle is `border-radius: 50%`, which is exact on a square box at any size, and a
themeable radius token would advertise that a theme may make a spinner less round — which it may
not. A spinner's roundness is geometry, not a design decision.

Under `prefers-reduced-motion: reduce` the rotation is cancelled and the ring parks with its accent
arc at the top. Motion is never the only signal: the role and the required label carry the state
whether or not anything moves, and a ring with one arc in the accent colour is the loading glyph
itself rather than an empty box. It is also what keeps the visual baselines deterministic.

Two things changed outside the new component:

- **`internal/progress-surface.ts` was extracted.** `Progress` shipped with its root rhythm,
  typography and label declarations inline, which was right while it was the only `ProgressBar` in
  the package. `Spinner` is the second, so the two now read the declarations they genuinely share
  from one module — the same rule `internal/text-surface.ts` was written under when `Textarea`
  joined `Input`. It also carries the measured RAC contract in one written place, including the one
  fact that is easy to get wrong exactly once and impossible to notice: `label` is not a prop on
  `ProgressBar`, so the accessible name has to come from a `<Label>` child.
- **The registry's `@keyframes` names are now asserted unique.** `panda.config.ts` merges every
  entry's keyframes with `Object.assign`, so two components declaring the same animation name would
  silently overwrite one another. That was unreachable while `Progress` was the only entry with
  keyframes at all; `Spinner` is the second, so the collision became possible in the same change
  that guards against it.
