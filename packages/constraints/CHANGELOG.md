# @zevaui/constraints

## 1.0.1

### Patch Changes

- e731ece: Every published tarball now carries `NOTICE`. No API changes — this release exists so the
  attribution ships with the code instead of staying behind in the git repository.

  **The gap, measured on a real tarball rather than inferred.** `ADR-0022` added a root `NOTICE`
  recording shadcn/ui's MIT attribution per Apache-2.0 §4(d), and recorded as a known follow-up that
  `"files": ["dist"]` would not carry it into any package. npm auto-includes `LICENSE`; it does not
  auto-include `NOTICE`. `@zevaui/constraints@1.0.0` shipped on 2026-10-15 and its tarball holds
  `LICENSE`, `README.md`, `dist/contract.json` and `package.json` — nothing else. A consumer
  installing from the registry received the license and no attribution.

  **Committed copies, following the precedent already set for the other half of the obligation.**
  All four publishable packages already carried a byte-identical committed copy of the root
  `LICENSE`, so `NOTICE` gets the same treatment and `"NOTICE"` joins each `files` array. Copies
  rather than symlinks because npm follows neither into a tarball.

  **The gate asks npm instead of reading npm's documentation.** Four copies of two files is a drift
  surface, and the `LICENSE` half of it had no gate at all until now.
  `packages/config/__tests__/legal-files-reach-tarballs.test.ts` derives the publishable set from
  the workspace — so a fifth publishable package is covered the day it appears, rather than shipping
  bare behind a green suite — asserts every copy byte-identical against the root, and then runs
  `npm pack --dry-run` to ask npm's own packer what would ship. That last step is the expensive one
  and it is the point: this gap was born from trusting a reading of npm's packing rules. Run against
  the tree before the fix, the gate failed 8 of its 13 assertions, each naming the package and the
  missing file.

## 1.0.0

### Major Changes

- 45702dc: Gate `color-text-muted` × `color-bg-subtle` as a declared text pair. `contract.json` goes to
  `2.0.0`.

  **Breaking: `color-bg-subtle` is now a required token.** `requiredTokens` is derived from the union
  of both pair classes rather than maintained by hand, so declaring the new pair grew it from 17
  entries to 18. A palette that does not supply `color-bg-subtle` now gets a `missing-token`
  violation from `validateTheme` where it previously passed. Most palettes already define it — the
  token has been listed in `contract.json`'s `tokenTypes.color` since before this change — so the
  usual migration is to pass a value you already have rather than invent one.

  **Why it was gated.** ADR-0022 D1 measured the pair at **4.39:1** in the light theme, below the 4.5
  floor, and nothing reported it: the pair was declared in neither `contrastPairs` nor
  `nonTextContrastPairs`. An undeclared pair is not a passing pair, it is an unmeasured one. With
  light `text.muted` repointed onto the new `gray.550` in `@zevaui/tokens`, the same pair now
  measures **4.64:1**.

  The assertion in `contract.test.ts` that read "never references color-bg-subtle or color-bg-muted"
  is inverted for half its subject: `color-bg-subtle` must now be a declared background.
  `color-bg-muted` still carries no text in any theme and stays out — the pair class states what is
  measured, not what exists.

  The gated pair is asserted as behavior, not only as a count. `validate-theme.test.ts` now fails a
  palette that supplies every other required token and omits only `color-bg-subtle` — the exact
  migration scenario above. The `missing-token` count in `@zevaui/mcp` moved 17 → 18, but a count
  cannot show _which_ token joined `requiredTokens`: it would read the same if some other token had
  become required instead.

  New pins join `tokens-contract.gate.test.ts` alongside a regression fence:

  - light `text-muted` on all three of its backgrounds (4.64 / 4.89 / 5.11)
  - the gated pair in the two themes the repoint did not touch, each against its OWN floor —
    dark 5.64 against 4.5, high-contrast 9.37 against **7.0**. Gating a pair obligates it in every
    theme, so leaving two thirds of it unpinned would have been the same unmeasured-pair mistake D1
    is about, one level up
  - the three `color-border-strong` ratios that stayed on `gray.500` (light 4.63 and 4.84, dark 4.16),
    so moving `border.strong` to `gray.550` later fails here rather than silently eroding
  - **dark `border-strong` × `bg-subtle` at 3.04** — the Badge edge, declared in neither pair class
    and therefore never checked by `validateTheme`. It is pinned precisely because D1 proved an
    undeclared pair ships green: had `border.strong` moved too, this edge would have fallen to 2.88
    with no gate to notice. If that pin ever fails, the question is whether the pair belongs in
    `nonTextContrastPairs`, not how to make it pass.

  No high-contrast `border-strong` assertion was added: there the token is `oklch(0 0 0)`, pure
  black, consuming no gray rung. It measures 19.08 against `bg-subtle` — a trivial pass that would
  read as coverage without being any.

## 0.2.0 (2026-08-22)

### Minor Changes

- 34dbdd3: Initial public release of the ZevaUI packages.

  - `@zevaui/tokens` — single source of truth for design tokens, compiled at build time to CSS custom properties, a typed manifest, and per-theme stylesheets (light, dark, high-contrast).
  - `@zevaui/constraints` — the machine-readable design contract plus `validateTheme()`: WCAG 1.4.3 text contrast (4.5:1 / 7.0:1 theme-scoped) and WCAG 1.4.11 non-text contrast (flat 3.0:1) enforced as a blocking gate.
  - `@zevaui/components` — six core React components (Button, Input, Card, Alert, Dialog, Menu) that consume tokens exclusively through CSS custom properties.
  - `@zevaui/mcp` — an MCP server exposing `validate_theme`, so agents and theme editors can reject rule-breaking themes before saving them.

## 0.1.0 (2026-08-21)

### Minor Changes

- 109596a: First real release of the theme contract validator, which has been shipping
  inside the workspace since Stage 3 without ever being versioned.

  Exports `validateTheme`, which checks a theme's colors against the declared
  contract: every token named by a contrast pair must be present, every value
  must parse as a color, and every pair must clear the minimum contrast ratio
  declared for that theme id. Violations come back typed and enumerable
  (`missing-token`, `invalid-color`, `low-contrast`) instead of as a thrown
  error, so a caller can report all of them at once rather than the first.

  Versioned now because `@zevaui/mcp` declares `@zevaui/constraints` as a
  runtime dependency, not a dev one. Releasing mcp at 0.1.0 while constraints
  sat at 0.0.0 would have shipped a dependency on a version that was never
  published.
