# ADR-0021: The dashboard redesign's library gaps: render less rather than fake it

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-10-01 |
| Author | Guillermo Zevallos |
| Deciders | Guillermo Zevallos |
| Related | `ADR-0006` (D1 `Card`'s slot composition; D3 a deficit recorded rather than fixed); `ADR-0010` (the 3.0 non-text tier); `ADR-0011` (the panel); `ADR-0019` (the release log); `apps/dashboard`; `packages/components`; `packages/tokens`; `CONSTITUTION.md` — principle 2 |

## Context

`apps/dashboard` is being redesigned against *Adoption Dashboard Design
Concept*. The dashboard is the project's own dogfood consumer (`ADR-0002`): it
installs the published packages and is bound by the same rules every external
consumer is — `className` and `style` are typed `never` on every component, and
theming happens by overriding `--zui-*` custom properties, never by forking.

That makes the dashboard a measuring instrument. Every place the design asks
for something the library cannot express is a finding about the library, not a
licence to write app CSS around it. Five such places were found while
implementing the redesign: four in the screens that shipped first, and the
fifth in the Overview landing, which ships in the commit this record sits on
top of. This ADR records what the dashboard does instead, so the gaps survive
as evidence rather than as comments that rot.

It also records one gap that turned out **not** to be one. The design's own
"Finding 1" asserts that `border-default × bg-surface` — measured at
**1.24** light / **1.21** dark — "fails the 3.0 floor by a factor of two" and
that "every separator in this design is either `border-strong` or does not
exist". Both numbers are right (independently derived below). The conclusion is
not, and it was used once to justify an app-CSS replica of `Card`; the replica
was deleted in `d613952`.

## Decision

Accept these as known library limitations, render the half the library can
express, and record the other half here. No shared token is redefined to close
one of them, no component is wrapped to escape its seal, and no value is
invented to fill a shape.

| # | Gap | What the dashboard renders instead |
|---|---|---|
| D2 | `Card.surface` is one-of: boundary **or** shadow | `surface="outlined"` — boundary, no depth |
| D3a | `Table` has no row-grouping primitive | repository as the row header, clustered by sort |
| D3b | `Table` emits no per-row DOM id | `/versions` with no fragment |
| D4 | `Badge` has no border edge | `tone="neutral"`, no edge |
| D5 | no letter-spacing token scale exists | caps without the tracking |

### D1. The rule: the library's silence is the answer, and it is rendered

Where the library cannot express the design, the dashboard renders less. It
does not reach for a raw value, a wrapper element, or a redefinition of a
shared custom property, because all three convert a library gap into an
invisible local fork — the design system forked one declaration at a time. The
honest render is also the one that keeps the gap findable: a screen that shows
less is a question, and app CSS that papers over it is an answer nobody asked
for.

This rule is already enforced mechanically for two of the five gaps.
`theme-foundation.test.ts` fails `globals.css` on any `px`/`rem`/`em` literal
outside a `var(--zui-*)` reference, and separately on any `--zui-*` reference
the token layer does not define — a gate written after exactly one invented
token slipped through (see D5).

### D2. `Card`'s `surface` axis is one-of, and the design's E1 wants both halves

The design's elevation model is explicit: "a `box-shadow` has no contrast ratio
you can commit to: it varies with what is behind it. So every raised surface in
this design carries a 1px border edge that is the boundary, and the shadow is
additive depth on top." Its E1 level — grouped lists, metric panels — is
therefore `bg-surface` **plus** a 1px boundary **plus** `shadow-card`.

`card.recipe.ts` declares one geometric axis whose two values are mutually
exclusive:

```ts
surface: {
  elevated: { root: { boxShadow: "card" } },
  outlined: { root: { borderWidth: "1px", borderStyle: "solid", borderColor: "border.default" } },
}
```

`elevated` has no edge; `outlined` has no shadow. Neither value, and no
combination of them, expresses E1. `CardProps` types `className` and `style` as
`never`, so there is no escape hatch and a hand-rolled surface around `Card` is
the replica `d613952` deleted.

`deprecated-view.tsx` and `release-log-view.tsx` both pass
`surface="outlined"`, by the design's own priority: the boundary is
load-bearing and the shadow is decoration, so with one of the two available,
keep the boundary. The missing depth is not faked.

The design also asks for that edge in `border-strong` rather than
`border.default`. That half is **not** a gap — see D6.

### D3. `Table` keeps both structure and identity inside its engine

Two faces of one cause: the row's structure and the row's identity both exist
in the table engine and neither reaches the document.

**D3a — no grouping.** The design makes the repository a group header over its
apps. `Table.tsx:73` builds its engine from `tableFeatures({})`, which enables
no grouping, no `rowspan` and no sub-header rows, and `TableProps` exposes no
row-group or section API to enable it from outside. `versions-view.tsx` renders
the repository as the row header instead (`isRowHeader: true`): it identifies
the record, it gives every other cell its subject when announced, and the page
clusters repositories by sorting on that column. Visual grouping needs a
`Table` feature that does not exist.

**D3b — no per-row DOM id.** `TableProps.rowId` is required and documented as
"stable identity of a row", but it reaches exactly one place —
`getRowId: (row) => rowId(row)` at `Table.tsx:116` — and the row renders as
`<tr key={row.id} className={slots.row}>` (`Table.tsx:186`). React's `key` is
not a DOM attribute, so no identity lands in the HTML. The design's Overview
makes each app row an anchor to `/versions#repo-alpha:web-alpha`; that fragment
has no target, and a dead fragment scrolls nowhere while looking like it
worked. The honest link is `/versions` with no fragment.

### D4. `Badge` ships no border, and the design's tag is an edge

The design's release-log tag is "`bg-subtle` with a `border-strong` edge — no
tone colour, because major/minor/patch is a category, not a severity".
`badgeRecipe` declares no border property in its base or in any of its five
tones, `badge.test.ts` pins that no tone rule declares `color`, and `BadgeProps`
seals `className`/`style`. `release-log-view.tsx` renders
`<Badge tone="neutral">` — the `bg.subtle` half, without the edge.

`badge.recipe.ts` argues the absence on two grounds: WCAG 1.4.11 measures the
boundary that identifies a component and a badge is not one, and an edge "would
need a new non-text contrast pair per tone to stay honest". The first ground
stands. The second is narrower than written, by measurement:

| Edge the design asks for | light | dark | In `nonTextContrastPairs`? |
|---|---|---|---|
| `border-strong × bg-subtle` (neutral tag) | **4.39** | **3.04** | no |
| `accent-default × accent-subtle` | 4.31 | **2.77** | no |
| `danger/success/warning-default × -subtle` | — | — | **yes**, all three |

Three of the five tones' edges are already gated pairs from `ADR-0010`. Only
the neutral and accent edges would need new ones — and the neutral edge the
design actually specifies measures **3.04** in dark, roughly 1% of slack over
the 3.0 floor, which the design itself calls "the tightest margin in the
design". So the edge is legal but the pair that would gate it is the most
fragile in the system. Adding it is a `Badge` decision with a token-contract
consequence, which is why it is recorded rather than taken here.

### D5. No letter-spacing token scale exists

`packages/tokens/tokens/primitives/typography.json` declares `fontFamily`,
`fontSize`, `fontWeight` and `lineHeight`, and nothing else. There is no
`letterSpacing` group in any primitive or theme file, so there is no
`--zui-letter-spacing-*` custom property to point at.

The design's group-header role is "xs 12 / 1.25 · 0.06em caps". A raw
`letter-spacing: 0.06em` fails the raw-length gate named in D1; the nearest
plausible token, `--zui-letter-spacing-wide`, was invented once in `globals.css`
and does not exist — it is the token the undeclared-reference gate was written
to catch. `.group-title` therefore renders the family, size, weight and
uppercasing from tokens and omits the tracking.

### D6. What is not a gap: the hairline's contrast, and the group radius

**`border.default`'s contrast is not a violation.** Derived from the real OKLCH
values with the package's own math — the same script reproduces `ADR-0010`'s
`border-strong` figures of 4.84 and 3.67 exactly — `border-default × bg-surface`
measures **1.24** light / **1.21** dark. `contract.json` declares exactly five
`nonTextContrastPairs` and `color-border-default` is not among them: it is
deliberately ungated. `separator.recipe.ts` states the rule — WCAG 1.4.11
measures the boundary that *identifies* a user-interface component, and a
container edge and a divider identify nothing; promoting them to the 3:1-gated
`border.strong` would paint them heavier than the real controls beside them.
The components whose boundary *is* their identity do use `border.strong`:
`Checkbox`, `RadioGroup`, `Switch`, `Select` and `Calendar` declare it
directly, and `Input`/`Textarea` inherit it from `internal/text-surface.ts`
(`textSurfaceBase`, line 89). `Card`
is correct as designed, and the design's Finding 1 measures a real number
against a criterion that does not apply to it.

**The concentric radii need no new token.** The design names a
`radius-group` at 12px. `radius.xl` is already 12px and `radius.lg` (which
`radius.card` points at) is 8px, so the scale already holds both corners. In
practice the views do not even need `xl`: composing `Card` gives them
`radius.card`, and nothing is nested inside that needs a smaller one.

## Alternatives considered

| Alternative | Discarded because |
|---|---|
| Redefine `--zui-color-border-default` to a stronger value | Moves every component's hairline across the whole library to restyle one container, and D6 shows the premise was wrong anyway. |
| Replicate `Card` as app CSS (`.group` + `.group__body`) | This existed and was deleted in `d613952`: it minted a border, a radius, a surface, a shadow and the padding — `Card` rewritten outside the library, invisible to every gate that watches the library. |
| Wrap `Card` in a div carrying the missing `shadow-card` | Defeats the seal by surrounding it instead of entering it, and makes the app the owner of a surface the library already owns. |
| Raw `letter-spacing: 0.06em` in `globals.css` | Fails the raw-length gate, and a one-off length is the design system forked one declaration at a time. |
| Invent `--zui-letter-spacing-wide` locally | Already tried once; a `var()` at a token that does not exist fails silently in CSS, which is why the undeclared-reference gate exists. |
| Fake the row anchors (`/versions#…`) and let them scroll nowhere | A dead fragment is indistinguishable from a working one until clicked — worse than a link that is honest about its granularity. |
| Add the grouping/`rowspan` feature to `Table` inside this redesign | A new `Table` capability is its own decision with its own ARIA consequences — `table.types.ts` already draws the line at not becoming a grid, and `ADR-0006` D1's rule is that structure the component owns is not handed out casually. |

## Consequences

**Positive**

- Five library gaps are now evidence with measurements attached, in one place,
  instead of five comments in files that will be rewritten.
- The dashboard remains a valid instrument: it is still bound by exactly the
  rules an external consumer is, so what it cannot build, nobody can.
- The wrong justification is retracted on the record. `border.default` keeps a
  documented reason to stay where it is, and the next reader of the design's
  Finding 1 has the counter-argument in the same archive.
- Every screen in the redesign now composes the library rather than shadowing
  it, so a future `Card` change reaches the dashboard instead of being masked
  by a replica.

**Negative / costs**

- Four of the redesign's screens are visibly less than the design asks: no
  depth under the group panels, no group bands in the versions table, no edge
  on the release-type tags, no tracking on the group titles. That is a
  deliberate deficit, not a backlog item someone has been assigned.
- The Overview screen's row anchors degrade to page-level links, so a shared
  link lands the reader at the top of `/versions` and leaves them to find the
  row.
- Closing D4 is not free: the neutral edge needs a new non-text contrast pair
  whose dark value sits at 3.04, about 1% over the floor — the most fragile pair
  the contract would hold.

**Neutral**

- Nothing in `packages/` changed for this ADR. `Card`, `Table`, `Badge` and the
  token set are byte-identical; this is a record, not a migration.
- `radius.xl` (12px) stays unused by the dashboard. It was the candidate for a
  `radius-group` token the design implies, and the measurement shows no token is
  needed at all.

## Follow-up (deferred decisions)

- **`Card`: an additive `shadow` alongside `surface`.** The smallest honest
  shape is a second, independent axis (`surface` keeps deciding the boundary, a
  new one decides depth) rather than a third `surface` value, which would make
  the axis no longer one-of — the property `card.recipe.ts` states as "ONE AXIS,
  PURELY GEOMETRIC". Trigger: the second consumer that wants E1.
- **`Table`: grouping, and a row `id`.** D3b is much the cheaper of the two —
  `rowId` is already required and already computed per row, so emitting it as a
  DOM `id` is one attribute. It is deferred only because an `id` on a `<tr>` is
  a public surface worth deciding deliberately: ids are globally unique per
  document and two tables on one page would collide.
- **`Badge`: a border, and the pair that gates it.** Blocked on the D4
  measurement being accepted as a cost, not on any design doubt.
- **A letter-spacing scale in `packages/tokens`.** Three or four steps, bridged
  into `panda.config.ts` like every other scale. The open question is whether a
  caps-tracking step belongs in the primitives or as a semantic `font.*` role,
  since the design asks for it per type role rather than per value.
- **A layout primitive.** Not counted among the five, but visible beside them:
  `.group-stack` and `.stack` in `globals.css` exist because the library ships
  no `Stack`, `Grid` or `Box`, so a flex column and a gap have nowhere else to
  come from. Both are deliberately one-axis, one-gap, no-variants — the moment
  either grows a `--tight` and a `--loose` it has become a layout primitive, and
  a layout primitive belongs in the library behind its own ADR.
