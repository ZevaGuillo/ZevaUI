---
"@zevaui/components": minor
---

Adds a bundle-size budget gate for RNF-02. `pnpm turbo run size` bundles a
real consumer entry per declared budget entry (esbuild, React/React-DOM
external), measures its gzip size, and fails naming every entry that
exceeds its ceiling. Four entries are budgeted: `Card` and `Alert`
(server-renderable, derived automatically from the registry's
`clientOnly: false` components), `Button` (representative client entry),
and the whole barrel — server entries get a +25% ceiling, client and
barrel entries get +10%, both recorded as admitted assumptions rather than
measured values.

The gate is proven with a negative fixture
(`__fixtures__/budget-over.json` + `scripts/assert-budget-fails.js`, wired
as `size:gate`) that asserts both an impossible ceiling and a multi-import
entry are correctly caught, mirroring the existing a11y gate's
three-branch crash-vs-fail exit handling.

See `docs/adrs/0007-presupuesto-de-bundle-y-medicion-de-entradas.md` for
the measured numbers, the admitted-assumption framing of the ceiling
multipliers, and the documented blind spot: with 4 entries, a `Menu`
regression is visible only through the barrel ceiling that `Menu` already
dominates, so a regression up to ~9% of the barrel would currently pass
undetected.
