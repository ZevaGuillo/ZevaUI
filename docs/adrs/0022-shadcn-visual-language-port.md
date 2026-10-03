# ADR-0022: Porting shadcn/ui's visual geometry — radius, a split token, and the knob that could not serve two floors

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-10-02 |
| Author | Guillermo Zevallos |
| Deciders | Guillermo Zevallos |
| Related | `ADR-0010` (the WCAG 1.4.11 non-text tier this change reasons about); `ADR-0021` (D4 and D5, corrected here); `packages/tokens`; `packages/constraints`; `packages/components`; `CONSTITUTION.md` — principle 6 |

## Context

The project's components pass every gate they have — the blocking axe a11y
gate, the two-dimensional contrast contract, the bundle budget, the visual
regression suite — and still read as dated. That judgment was never
measured before this change; compliance was. Measuring the gap against a
widely used reference, [shadcn/ui](https://github.com/shadcn-ui/ui), found
the dominant cause is geometric, not chromatic: `Card` renders at 8px corner
radius against shadcn's 14px (57%), and `Button`/`Input` render at 4px
against shadcn's 8px (50%).

This slice (1a of the change) ships only the attribution artifact and the
decision record. It carries no code. The radius repoint itself — a ~6-line
diff across three theme files — is slice 1b, deliberately split out so a
reviewer can hold the kill point in their head without it being buried
under this record's own length. The record exists first because the MIT
attribution obligation attaches the moment the first ported value lands,
and 1a merges before 1b does.

While deriving the radius decision, a second and unrelated problem surfaced
by direct measurement: a single primitive, `gray.500`, was already serving
two semantic roles in the light theme that are judged at two different
floors, and no value of that primitive satisfies both. That finding — not
anything shadcn-specific — is this record's most important section (D1).

## Decision

### D1. The port: what, from where, under what licence

The reference is [shadcn/ui](https://github.com/shadcn-ui/ui), MIT-licensed,
`Copyright (c) 2023 shadcn`. What is ported is **numeric geometry and the
contrast ratios it implies** — corner-radius pixel values and the
measurements that followed from adopting them — never literal source code.
No shadcn file is copied, vendored, or transformed into a ZevaUI file.

ZevaUI's own root `LICENSE` is **Apache License, Version 2.0**, not MIT.
Apache-2.0 §4(d) requires a licensee that redistributes to carry, within any
`NOTICE` text file distributed as part of the derivative work, the
attribution notices from any `NOTICE` file of the Apache-2.0-licensed work
being redistributed. ZevaUI is not redistributing an Apache-2.0-licensed
NOTICE from upstream — shadcn/ui ships none, being MIT — but §4(d) is the
structural reason this repository is the kind of project that carries a root
`NOTICE` file at all, and it is the correct place to also record an MIT
attribution for a port that would otherwise have no obligatory home. The
`NOTICE` file added alongside this ADR names shadcn/ui, its repository URL,
its copyright line, and states explicitly that only numeric values and
ratios were ported, not source. `NOTICE` is therefore the structurally
correct vehicle here, not a courtesy file offered on top of `LICENSE`.

**Known limitation, recorded rather than hidden.** Every package in this
monorepo publishes `package.json` with `"files": ["dist"]`, and npm does not
automatically bundle a root `NOTICE` into a package tarball the way it
bundles `LICENSE`. A consumer who installs `@zevaui/tokens` or
`@zevaui/components` from the npm registry will not receive this `NOTICE`
file; it exists in the git repository and nowhere else today. This is a
known gap, not an oversight: closing it would mean deciding whether each of
the four publishable packages carries its own `NOTICE` copy and whether
each `files` array grows an entry, which is its own decision with its own
blast radius and does not belong inside this record. It is named here as an
open follow-up and deliberately not resolved in this change.

### D2. The radius repoint, and the 12-vs-14px divergence

`radius.card` repoints to `radius.xl` (12px, `primitives/radius.json`).
`radius.button` and `radius.input` repoint to `radius.lg` (8px). Both target
primitives already exist in the scale (`none` 0 / `sm` 2 / `md` 4 / `lg` 8 /
`xl` 12 / `2xl` 16 / `full`); this repoint adds **zero new radius
primitives**.

shadcn's own published radius for its card-shaped surfaces is 14px (`rounded-xl`
at shadcn's own `--radius: 0.875rem` convention in several of its themed
presets). 12px is **86%** of 14px — close, not exact — and the decision is
to land on the scale's existing `xl` rather than mint a new primitive at
14px. The reasoning is perceptual, not purely arithmetic: the jump a reader
actually notices is 8px → 12px — the existing boxy `lg` corner replaced by a
visibly rounder one — not the further step from 12px to 14px, which reads as
the same shape at a slightly different scale. Landing exactly on an existing
primitive also keeps the change a token repoint rather than a new addition,
consistent with `ADR-0021` D6's finding that the scale already held both
corners the earlier dashboard redesign needed and no new token was required
there either.

`radius.button` and `radius.input` repoint to `radius.lg` (8px), which
matches shadcn's own control radius exactly — no divergence to record for
that half of the decision.

### D3. The D1 supersession — why one knob could not serve both floors

An earlier revision of the work this ADR documents settled on narrowing the
gap by nudging the existing primitive `gray.500` directly, from
OKLCH lightness 0.551 to 0.538, reasoning that this would raise a
borderline-failing text pair above its floor. That decision was
**superseded**, not merely adjusted, once the full dependency of `gray.500`
was measured.

In the **light** theme, two semantic tokens point at the same primitive and
are measured against the same background:

- `color.text.muted` → `{gray.500}` (`packages/tokens/tokens/themes/light.json:6`)
- `color.border.strong` → `{gray.500}` (`packages/tokens/tokens/themes/light.json:22`)
- both measured against `color.bg.subtle` → `{gray.100}`

`text-muted × bg-subtle` and `border-strong × bg-subtle` are not two
independent findings that happen to share a number. They are **the same
colour pair, measured twice under two token names**, and judged at two
different floors: the 4.5:1 text-contrast tier (`contract.json`'s
`defaultMinContrastRatio`) for the text pair, and the flat 3.0:1 non-text
tier `ADR-0010` established for the second. At `gray.500`'s shipped
lightness the same 4.39 ratio simultaneously **fails** the 4.5 text floor
and **passes** the 3.0 non-text floor with room to spare.

`border.strong` is also consumed, independently, by the dark theme's own
`border-strong × bg-subtle` pair, which measures 3.04 today — already within
1.3% of its own 3.0 floor before anything changes. The two consuming
contexts move in opposite directions on the same knob: darkening `gray.500`
raises the light text ratio (darker text on a light background is more
legible) but **lowers** the dark edge ratio (darkening the lighter of two
colours in a light-on-dark pair narrows the gap between them). One knob,
two floors, moving apart.

Measured directly, confirming the direction and finding the window is
empty:

| `gray.500` OKLCH L | light muted × bg-subtle (floor 4.5) | dark edge × bg-subtle (floor 3.0) |
|---|---|---|
| 0.551 (shipped) | 4.39 — **FAIL** | 3.04 |
| 0.545 | 4.51 — pass | 2.96 — **FAIL** |
| 0.538 | 4.64 — pass | 2.88 — **FAIL** |

The first lightness value that clears the text floor already breaks the
edge floor. No lightness value on this single primitive satisfies both
simultaneously — **the window is empty**. Nudging `gray.500` directly was
not a smaller or more conservative version of the correct fix; it was an
unsafe fix that happened to be caught before it shipped.

**And no gate in this repository would have caught it.** `contract.json`
declares exactly five `nonTextContrastPairs`:
`border-strong × bg-canvas`, `border-strong × bg-surface`,
`danger-default × danger-subtle`, `success-default × success-subtle`,
`warning-default × warning-subtle`. `border-strong × bg-subtle` is **not**
among them. A direct nudge to `gray.500` that satisfied the light text floor
would have passed `validateTheme()` for every theme, passed the blocking
axe gate, passed the bundle budget, and shipped **entirely green** — while
silently spending the dark Badge-edge headroom that `ADR-0021` D4 left open
as a deferred decision, without that decision ever being revisited. The
lesson generalizes past this one pair: this repository's contrast contract
only gates the pairs someone thought to list, and a token repoint that is
fully compliant with every existing gate can still destroy a different,
unrelated decision's margin.

### D4. The settled fix: one new primitive, one repoint, nothing else moves

A new primitive, `gray.550`, is added to
`packages/tokens/tokens/primitives/colors.json`, and **only** light theme's
`color.text.muted` repoints to it. `color.border.strong` is untouched in
every theme — light, dark, and high-contrast all keep `{gray.500}` (or
`{black}` in high-contrast's case), so the dark Badge-edge ratio stays
exactly 3.04, preserving `ADR-0021` D4's deferred decision on its original
terms rather than spending its margin as a side effect of an unrelated fix.

**`gray.550 = oklch(0.538 0.0274 263.428)`**, interpolated — not copied —
between the scale's existing neighbors `gray.500 = oklch(0.551 0.027
264.364)` and `gray.600 = oklch(0.446 0.030 256.802)`. Lightness is the
knob that was targeted (0.538), so the interpolation parameter is derived
from lightness and then applied to chroma and hue to keep the new primitive
on the scale's existing curve rather than flattening it:

```
t = (0.551 − 0.538) / (0.551 − 0.446) = 0.013 / 0.105 = 13/105 = 0.1238095…

chroma = 0.027 + 0.003 × (13/105) = 0.0274

hue    = 264.364 − 7.562 × (13/105) = 263.4278 → 263.428
```

**The exact ratio `13/105` must be used, not the rounded `0.124`.** Using
the rounded value produces hue `264.364 − 7.562 × 0.124 = 263.4263 →
263.426`, which does not reproduce the published `263.428`. This is stated
explicitly so a later reader who recomputes `gray.550` from a rounded `t`
does not conclude the published value is wrong and "fix" it — doing so
would silently tighten the interpolation and flatten the ramp between
`gray.500` and `gray.600` by a small but real amount. Chroma is `0.0274`
either way, since the chroma step across this interval is small enough that
the rounding does not move its two-decimal display value.

Verified outcome, same colour math used throughout this record:

| Pair | Result | Floor | Status |
|---|---|---|---|
| light muted × bg-subtle | 4.64 | 4.5 | pass (was 4.39 fail) |
| light muted × bg-canvas | 4.89 | 4.5 | pass |
| light muted × bg-surface | 5.11 | 4.5 | pass |
| light border-strong × bg-canvas | 4.63 | 3.0 | unchanged |
| light border-strong × bg-surface | 4.84 | 3.0 | unchanged |
| dark border-strong × bg-surface | 3.67 | 3.0 | unchanged |
| dark border-strong × bg-canvas | 4.16 | 3.0 | unchanged |
| dark border-strong × bg-subtle (ungated Badge edge) | 3.04 | 3.0 | **preserved** |
| dark text-muted × bg-subtle | 5.64 | 4.5 | unaffected (dark muted is `gray.400`, not `gray.500`) |
| high-contrast text-muted × bg-subtle | 9.37 | 7.0 | unaffected (high-contrast `border-strong` is `black`, consumes no `gray.500`) |

Light's text hierarchy stays three visually distinct tiers after the
repoint: `text.default` at `gray.900` (L 0.210), `text.secondary` at
`gray.600` (L 0.446), `text.muted` now at `gray.550` (L 0.538).

### D5. The gated pair, and the accepted break

`text-muted × bg-subtle` joins `contract.json`'s `contrastPairs`.
`requiredTokens` (`packages/constraints/src/contract.ts:28-31`) is derived —
not separately registered — as the order-preserving deduplicated union of
`contrastPairs` and `nonTextContrastPairs`:

```ts
export const requiredTokens: readonly string[] = dedupeTokens([
  ...contract.contrastPairs,
  ...contract.nonTextContrastPairs,
]);
```

Adding the new pair is therefore sufficient on its own for `color-bg-subtle`
to become a required token; no change to `contract.ts` itself is needed.
`validateTheme()`'s `resolveLuminances` step reports a `missing-token`
violation for any required token a candidate palette omits, so a
third-party palette that does not already supply `color-bg-subtle`
**flips from passing to failing** `validate_theme` the moment this ships.
This is accepted as a deliberate, consumer-visible breaking change, shipped
as a major version of `@zevaui/constraints` with a published migration
note, because an ungated pair is exactly the kind of silent regression this
repository's contract exists to prevent — the point D1's supersession
proves from the opposite direction: gating costs something, but the
alternative is invisible breakage.

### D6. The semver policy this ADR creates

No written semver policy existed for this kind of change before now. This
ADR records one:

- **`@zevaui/tokens` ships minor.** Published runtime token values change.
  `packages/tokens/scripts/build.js` emits the `tokens` object into
  `dist/index.js`, and `packages/mcp/src/themes.ts:2` imports it directly
  (`import tokens, { themeIds, themeKeyOf } from "@zevaui/tokens";`) and
  feeds it to `validateTheme`. A downstream package reading changed runtime
  values, with no type-level change (every token is typed `string`), is the
  shape of a minor, not a patch.
- **`@zevaui/constraints` ships major, with a migration note.** D5 is a
  consumer-visible validation break: a palette that validated before this
  change can fail afterward. The migration note states plainly that a
  candidate palette must supply `color-bg-subtle` to keep validating, and
  that most real palettes already do, since `color-bg-subtle` was already
  listed under `contract.json`'s `tokenTypes.color`.
- **`@zevaui/components` ships minor, with a release note that the look
  changes while the API does not.** No component in this slice gains or
  loses a public prop from the radius repoint; only rendered geometry
  changes.

### D7. Corrections to ADR-0021, on the record

`ADR-0021` is `Accepted`. Per this archive's own convention
(`docs/adrs/README.md`), accepted ADRs are amended with dated notes rather
than rewritten, so the corrections below are recorded here, against the
earlier record, rather than by editing `0021` directly.

**D4 is narrower than `ADR-0021` states.** `ADR-0021`'s D4 describes the
dashboard design's tag as wanting a `border-strong` edge on `Badge` and
records the deferred decision in those terms. Direct inspection of shadcn's
own `Badge` component shows the border exists **only** on its dedicated
`outline` variant; the `default`, `secondary`, and `destructive` variants
all carry `border-transparent` — shadcn itself does not give every badge
tone a border either. The deferred Badge decision in `ADR-0021` stays open
on its original terms; nothing here resolves it. What this change does
contribute to that open decision is deliberate: by not touching
`border.strong` anywhere (D4, above), the dark Badge edge stays pinned at
exactly **3.04**, so whoever eventually revisits the Badge border decision
is working from the same measured headroom `ADR-0021` recorded, not a
number quietly moved out from under them.

**D5 is wrong, and is retracted rather than implemented.** `ADR-0021`'s D5
reads as though shadcn's own design owed ZevaUI a letter-spacing scale for
its uppercase group-header role. It does not. Direct inspection of
shadcn/ui's component registry finds no use of `tracking-wide` and no use
of `uppercase` anywhere in it; the only letter-tracking utility that
registry uses at all is `tracking-tight`, applied to large headings, which
is the opposite adjustment for an unrelated purpose. The "xs 12 / 1.25 ·
0.06em caps" requirement that motivated `ADR-0021` D5 came from the
dashboard's own design-concept document, not from shadcn. This change does
not add a letter-spacing primitive scale, and none is owed by this port;
`ADR-0021` D5's framing is corrected on the record rather than carried
forward into an implementation.

### D8. Scope boundary: the palette is not adopted, and the dashboard shell is out of scope

**The palette stays ZevaUI's own.** shadcn's default neutral scale is
chroma-zero (a true gray); ZevaUI's `gray` primitive scale carries a
deliberate cool-blue chroma (values like `0.027`–`0.034` at hues clustered
around 256–265). Adopting shadcn's neutral palette wholesale would be a
brand-identity change that reopens every existing contrast measurement in
the system, and it is explicitly out of scope for this change. `gray.550`'s
interpolated chroma and hue — derived from `gray.500`'s and `gray.600`'s own
values, not copied from a shadcn constant — keep that boundary true: the new
primitive extends ZevaUI's existing cool-gray curve, it does not import a
foreign one.

shadcn itself ships multiple neutral presets (slate, zinc, stone, gray,
neutral) rather than one canonical gray, which is the precedent this
decision leans on: a cool-tinted neutral is a legitimate member of that
family of choices, not a deviation from "the shadcn way."

**The dashboard shell is out of scope.** Any app-level CSS in `apps/dashboard`
— navigation styling, active-route state, content width, sticky headers —
is unrelated to this port and is not touched by this change or this record.

## Alternatives considered

| Alternative | Discarded because |
|---|---|
| Nudge `gray.500` directly to L 0.538 | Superseded by D3: the same primitive serves two floors moving in opposite directions, and no value of it satisfies both. |
| Repoint `border.strong` to a darker primitive alongside `text.muted` | Would lower the already-tight dark Badge edge (3.04, 1.3% over its floor) and spend `ADR-0021` D4's deferred headroom as an unintended side effect of a text-contrast fix. |
| Add `gray.550` with chroma/hue copied from `gray.500` | Breaks the scale's existing curve between `gray.500` and `gray.600`; the interpolation in D4 keeps the ramp smooth instead. |
| Land `radius.card` on a new 14px primitive matching shadcn exactly | Mints a primitive the scale does not need; `radius.xl` at 12px already exists, reads as the same perceptual jump from the shipped 8px, and keeps the change a repoint rather than an addition. |
| Leave `text-muted × bg-subtle` ungated after the repoint | The exact failure mode D1/D3 exists to warn against: a pair that is fine today can be moved silently later with no gate to catch it. |
| Treat `NOTICE`'s npm-tarball gap as blocking this slice | Scope creep: deciding per-package `NOTICE` copies and `files` array edits is a separable decision with its own review surface; named as a follow-up instead. |

## Consequences

**Positive**

- The dominant cause of the "looks dated" judgment is identified by
  measurement (radius) rather than asserted by taste, and the fix for it is
  isolated to a repoint this record's companion slice (1b) can ship as a
  ~6-line diff.
- A latent light-theme text-contrast failure (4.39 against a 4.5 floor) is
  closed without spending a different, already-deferred decision's margin —
  the opposite of what the superseded D1 nudge would have done silently.
- The dark Badge-edge headroom `ADR-0021` D4 left open is explicitly
  preserved at its original measured value, so that deferred decision
  remains comparable to its own record rather than quietly moved.
- Two incorrect claims in an already-`Accepted` ADR are corrected on the
  record rather than left to propagate: `ADR-0021` D4's border scope and
  D5's letter-spacing justification.
- The attribution obligation is satisfied — `NOTICE` names shadcn/ui, its
  repository, and its MIT copyright line — before any ported value lands in
  a merged branch.

**Negative / costs**

- `@zevaui/constraints` ships a major version. A real, if mechanical,
  breaking change for any third-party palette that does not already supply
  `color-bg-subtle`.
- The root `NOTICE` file does not reach any npm tarball today
  (`files: ["dist"]` on every publishable package); the attribution is
  complete in the git repository and incomplete for an npm-only consumer
  until a separate decision closes that gap.
- A new primitive, `gray.550`, exists as a half-step in a scale otherwise
  spaced at hundreds. It is unused by anything except light `text.muted`.

**Neutral**

- `packages/components` is untouched by the color and semver decisions in
  this record; its only change in this slice is the radius repoint, which
  changes no public type.
- ZevaUI's own cool-blue neutral palette is unchanged and is not up for
  renegotiation by this change.

## Follow-up (deferred decisions)

- **`NOTICE` propagation into npm tarballs.** Each publishable package
  declares `"files": ["dist"]`, and npm does not auto-include `NOTICE` the
  way it auto-includes `LICENSE`. Whether to add a `NOTICE` copy and a
  `files` entry to each of the four publishable packages is its own
  decision, deliberately not made here.
- **`Badge`'s border edge**, per `ADR-0021` D4 as corrected above: still
  blocked on the D4 measurement — a 3.04 dark ratio with roughly 1% of
  margin — being accepted as a cost, not on any remaining design doubt about
  whether shadcn's own Badge carries a border (it does, on its `outline`
  variant only).
- **A letter-spacing token scale**, if one is ever wanted for the
  dashboard's own uppercase group-header role. `ADR-0021` D5's shadcn
  justification is retracted by this record; if the scale is still desired,
  it needs its own ADR grounded in the dashboard's actual design-concept
  requirement rather than an attributed-to-shadcn one.
