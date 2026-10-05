# @zevaui/constraints

Validates a theme's color tokens against a declared WCAG contrast contract, so a
broken theme fails CI instead of shipping.

## Quick path

1. Install as a dev dependency: `@zevaui/constraints` (workspace package).
2. Call `validateTheme` with a theme's `id` and its resolved `colors`:

   ```ts
   import { validateTheme } from "@zevaui/constraints";

   const result = validateTheme({
     id: "light",
     colors: {
       "color-text-default": "oklch(0.21 0 0)",
       "color-bg-canvas": "oklch(0.98 0 0)",
       // ...every token in the contract's contrastPairs
     },
   });

   if (!result.pass) {
     console.error(result.violations);
   }
   ```

3. `result.pass` is `true` only when every declared pair meets its theme's
   minimum contrast ratio. Otherwise `result.violations` lists each failure
   with both token names and the measured/required ratios.

## Breaking in 2.0.0: `color-bg-subtle` is now required

`contrastPairs` gained `color-text-muted` × `color-bg-subtle`, so
`requiredTokens` grew from 17 entries to 18 and now includes
`color-bg-subtle`. **A palette that does not supply it gets a
`missing-token` violation from `validateTheme` where it previously passed.**
Most palettes already define the token — it has been in
`contract.json`'s `tokenTypes.color` since before this change — so the usual
migration is to pass a value you already have, not to invent one.

Why it was gated rather than left alone: ADR-0022 D1 measured
`color-text-muted` × `color-bg-subtle` at **4.39:1** in the light theme, below
the 4.5 floor, while both tokens resolved to `gray.500`. Nothing reported it,
because the pair was declared in neither pair class — an undeclared pair is
not a passing pair, it is an unmeasured one. The fix needed a new primitive
rung: `gray.550` now backs light `color-text-muted` at **4.64:1**, and
`color-border-strong` deliberately stays on `gray.500`. There is no single
lightness that clears 4.5 for muted text on `bg.subtle` and 3.0 for a
`border-strong` edge on it at the same time, which is why the rung was split
instead of nudged.

Gating the pair puts it under a floor in all three themes, not only the light
one the repoint fixed. Note the high-contrast floor is **7.0**, not 4.5, so its
higher ratio is not extra headroom — it is the same margin against a steeper
bar. All three are pinned in `tokens-contract.gate.test.ts`.

| New text pair | light (floor 4.5) | dark (floor 4.5) | high-contrast (floor 7.0) |
|---|---|---|---|
| `color-text-muted` × `color-bg-subtle` | 4.64 | 5.64 | 9.37 |

Dark and high-contrast `text.muted` were not repointed — they resolve to
`gray.400` and `gray.700` and already cleared their floors. Only the light
theme needed the new rung.

## Non-text contrast (WCAG 1.4.11) is enforced

`nonTextContrastPairs` is a sibling pair class to `contrastPairs`, checked
against a flat `nonTextMinContrastRatio: 3.0` applied identically across
**every** theme (`light`, `dark`, `high-contrast`) — WCAG 1.4.11 has no AAA
tier, so `high-contrast` does not get a stricter non-text floor the way it
does for text (7.0:1). `checkContrast` is a pure `(luminances, pairs,
minRatio)` function, called once per pair class; violations reuse the same
`rule: "low-contrast"` as text pairs and are distinguished by
`expected: "3.0"`. See ADR-0010 for the full design rationale.

| Non-text pair | light | dark | high-contrast |
|----------------|-------|------|-----------------|
| `color-border-strong` × `color-bg-canvas` | 4.63 | 4.16 | (unchanged, above floor) |
| `color-border-strong` × `color-bg-surface` | 4.84 | 3.67 | (unchanged, above floor) |
| `color-danger-default` × `color-danger-subtle` | (above floor) | 3.48 | (unchanged, above floor) |
| `color-success-default` × `color-success-subtle` | 4.50 | (above floor) | (unchanged, above floor) |
| `color-warning-default` × `color-warning-subtle` | 4.54 | (above floor) | (unchanged, above floor) |

All 15 pair evaluations (5 pairs × 3 themes) pass the 3.0:1 floor. Two dark
ratios are fragile (danger 3.48, 16% headroom; border × surface 3.67, 22%
headroom) and carry `toBeCloseTo` pins in `tokens-contract.gate.test.ts` — see
the headroom note below.

As a result, **RNF-01 (WCAG 2.2 AA) is now enforced for both text and
non-text pairs declared in the contract.** Contrast that is not declared as a
pair (e.g. focus rings, or any future non-text surface) is still outside this
package's coverage.

## How contrast is computed

Contrast is computed on colors parsed to linear sRGB, naively clamped to the
sRGB gamut. This is an approximation of the browser's CSS Color 4 gamut
mapping (which uses a perceptual, non-naive algorithm), chosen because it is
deterministic and always errs on the conservative side — it never reports a
higher ratio than the browser would render.

## Fragile pins

- **high-contrast text-success**: passes its 7.0:1 floor at **7.09:1 — 1.3%
  headroom**. Any future change to `green.800` or to the high-contrast canvas
  color must re-verify this ratio before merge.
- **dark danger-default × danger-subtle** (non-text, 3.0:1 floor): passes at
  **3.48:1 — 16% headroom**.
- **dark border-strong × bg-surface** (non-text, 3.0:1 floor): passes at
  **3.67:1 — 22% headroom**.
- **dark border-strong × bg-subtle** — the Badge edge, and the one entry here
  that is **declared in neither pair class**, so `validateTheme` never checks
  it. Measured at **3.04:1 — 1.2% of room above a 3.0 floor it is not held
  to.** It is pinned anyway because ADR-0022 D1 is the proof that an undeclared
  pair ships green: had `color-border-strong` moved to `gray.550` alongside
  `color-text-muted`, this edge would have dropped to 2.88 and no gate would
  have said a word. If the pin fails, the question is not how to make it pass
  but whether the pair now belongs in `nonTextContrastPairs`.

All four are pinned with `toBeCloseTo` in `tokens-contract.gate.test.ts`,
alongside a regression fence on the three `color-border-strong` ratios that
stayed on `gray.500`. If headroom widens, update this doc; never loosen a pin
to make a regression pass.

## Checklist

- [ ] Every token referenced in `contract.contrastPairs` and
      `contract.nonTextContrastPairs` is present in the `colors` you pass to
      `validateTheme`.
- [ ] `result.pass` is checked, not just `result.violations.length`.
- [ ] You understand this package enforces both text pairs (4.5:1 / 7.0:1,
      theme-scoped) and non-text pairs (flat 3.0:1, all themes) — see above.

## Next step

See `src/contract.json` for the full list of validated token pairs and
per-theme minimum ratios.
