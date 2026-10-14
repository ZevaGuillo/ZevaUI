---
"@zevaui/components": minor
---

The look changes, the API does not. Table rows now respond to hover.

**`bg.subtle`, the same colour `Menu` spends on hover, and that is the consistent choice rather
than a collision.** `table.recipe.ts` already rejected zebra striping *because* `bg.subtle` is
hover's colour — a striped row and a hovered row would have been the same tint and the hover would
have stopped meaning anything. Spending it on hover is the premise that rejection rested on, so
striping stays rejected for exactly the reason it already was. Plain `bg.subtle` with no
`color-mix()`, matching `Menu`: a table row has nothing behind it to blend with, unlike the Dialog
scrim.

**Gated on `@media (hover: hover)`, which is load-bearing and not boilerplate.** `Menu` keys its
tint off `[data-hovered]`, an attribute react-aria maintains and removes. `Table` has no such
attribute — it renders plain `<tr>` elements — so the rule has to be a real CSS `:hover`, and on a
touch device a bare `:hover` sticks: the last-tapped row stays tinted with nothing pointing at it,
which reads as selection. The at-rule confines the tint to pointers that can move away again.

**Proven by a stylesheet assertion rather than a hover screenshot.** `visual-baselines.yml` already
shows a flake family at exactly this kind of interaction-modality state (`DateField > Focused
Segment`), so a screenshot would have bought a flake instead of a check. This slice adds no
baseline at all. The two new assertions were measured against the regression they exist for —
deleting the media query and leaving the `:hover` — and both fail there: the at-rule block reads
empty, and the row-hover rule count outside the query goes from zero to one.
