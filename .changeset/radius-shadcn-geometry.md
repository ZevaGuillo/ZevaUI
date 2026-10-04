---
"@zevaui/tokens": minor
---

Repoint the semantic radius scale at coarser primitives, per ADR-0022. `radius.input` and
`radius.button` move from `{radius.md}` (4px) to `{radius.lg}` (8px); `radius.card` moves from
`{radius.lg}` (8px) to `{radius.xl}` (12px). All three themes move together.

**No new radius primitive.** `lg` (8px) and `xl` (12px) already existed in
`primitives/radius.json`; this change points at the scale rather than bending it. The new test pins
the resolved pixel value alongside the reference, so a rung quietly retuned under these three
tokens fails the suite — but adding an unrelated rung to the radius scale later is not this test's
business, and does not fail it.

**12px, not shadcn's 14px, and that is deliberate.** 12px is 86% of shadcn's card radius and is a
rung the scale already owns. The perceptible jump is 8px→12px, not 12px→14px, so buying the last
2px would have cost a new primitive for a difference nobody sees.

This is a `minor` rather than a `patch` because the published runtime values change — `@zevaui/mcp`
reads these tokens through `src/themes.ts`, so a consumer asking the MCP server for
`radius-button` gets 8px where it got 4px.

**The repoint was previously ungated, and that is the more useful half of this change.**
`no-literals.test.ts` proves every semantic token resolves to *some* declared primitive, which
stays green whichever radius a theme points at — including the old values, and including a theme
that silently failed to move. `semantic-vars.test.ts` only checks the `var(--zui-` chain shape. So
nothing in the suite could tell 4px from 8px here. `__tests__/radius-geometry.test.ts` pins each
semantic radius to both its reference path and its resolved value, in all three themes; it was
written failing against the old values before the repoint landed.
