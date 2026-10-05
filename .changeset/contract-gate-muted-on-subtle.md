---
"@zevaui/constraints": major
---

Gate `color-text-muted` × `color-bg-subtle` as a declared text pair. `contract.json` goes to
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
cannot show *which* token joined `requiredTokens`: it would read the same if some other token had
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
