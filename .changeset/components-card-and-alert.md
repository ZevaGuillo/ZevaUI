---
"@zevaui/components": minor
---

Adds `Card` and `Alert` to `@zevaui/components`, completing RF-05's
six-component roster and the first two server-renderable components (no
`"use client"` directive — see `docs/adrs/0006-card-alert-roster-completo.md`).

`Card` (`surface`: `elevated` | `outlined`, default `elevated`) is a
multi-part slot recipe with `Card.Header` / `Card.Body` / `Card.Footer`
dot-notation parts, composed with `children` — its zones are arbitrary
content a consumer cannot structurally break, unlike `Dialog`/`Menu`'s typed
content props.

`Alert` (`tone`: `danger` | `success` | `warning`, no default, no `info`) is
a single-part recipe whose role is derived from `tone` (`danger`/`warning`
get `role="alert"`, `success` gets `role="status"`) rather than taken as a
prop. Text stays `color-text-default` in every tone — measured against the
real token values, `{tone}.default` text on `{tone}.subtle` background fails
WCAG AA in all three tones (3.90 / 2.93 / 1.93 against a 4.5:1 floor); the
tone color is a non-text accent (the left border) only.

Same theming model as the rest of the package: no `className`/`style` escape
hatch (both typed `never`) — theme by overriding `--zui-*` custom
properties, never by forking.

See `docs/adrs/0006-card-alert-roster-completo.md` for the composition,
contrast, and server-rendering decisions behind them.
