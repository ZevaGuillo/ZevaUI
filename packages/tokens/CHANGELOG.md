# @zevaui/tokens

## 0.3.0

### Minor Changes

- 564104b: Repoint the semantic radius scale at coarser primitives, per ADR-0022. `radius.input` and
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
  `no-literals.test.ts` proves every semantic token resolves to _some_ declared primitive, which
  stays green whichever radius a theme points at — including the old values, and including a theme
  that silently failed to move. `semantic-vars.test.ts` only checks the `var(--zui-` chain shape. So
  nothing in the suite could tell 4px from 8px here. `__tests__/radius-geometry.test.ts` pins each
  semantic radius to both its reference path and its resolved value, in all three themes; it was
  written failing against the old values before the repoint landed.

## 0.2.1

### Patch Changes

- ca89fd2: Document the step the consumer contract always required and never stated: the page has to paint the canvas.

  Both READMEs told you to install the packages and import the two stylesheets, and stopped there. Importing the custom properties defines them; it paints nothing. Two of them are the page's own — `--zui-color-bg-canvas` and `--zui-color-text-default` — and nothing in either package applies them to `body`.

  The obligation is real, not cosmetic. Component text that sits on the page rather than on a component's own surface — `Input`'s label and description, most visibly — is coloured for `color-bg-canvas`. On a page that never paints it, the browser's white shows through instead, and in the dark theme that text measures **1.05:1 against a 4.5:1 AA floor**. Light and high-contrast appear to survive, but only because the browser's white happens to sit near `color-bg-canvas` in those themes — luck that evaporates the moment a user switches to dark.

  This is exactly the class of defect that only exists outside the monorepo: this repository's own Storybook applies the two declarations in its preview scaffold, so no test here has ever rendered a page without them.

  `@zevaui/components` gains a `Quick path` step, a `The page is yours to paint` section explaining why the split exists — a design system that painted your `body` would be the global reset `G3` fails the build on — and a checklist item. `@zevaui/tokens` gains the same instruction next to its usage snippet, plus the scope of what its contrast guarantees actually cover: theme values applied as intended, not any background a consumer chooses.

  Documentation only. No component, token, or emitted stylesheet changes.

## 0.2.0 (2026-08-22)

### Minor Changes

- 34dbdd3: Initial public release of the ZevaUI packages.

  - `@zevaui/tokens` — single source of truth for design tokens, compiled at build time to CSS custom properties, a typed manifest, and per-theme stylesheets (light, dark, high-contrast).
  - `@zevaui/constraints` — the machine-readable design contract plus `validateTheme()`: WCAG 1.4.3 text contrast (4.5:1 / 7.0:1 theme-scoped) and WCAG 1.4.11 non-text contrast (flat 3.0:1) enforced as a blocking gate.
  - `@zevaui/components` — six core React components (Button, Input, Card, Alert, Dialog, Menu) that consume tokens exclusively through CSS custom properties.
  - `@zevaui/mcp` — an MCP server exposing `validate_theme`, so agents and theme editors can reject rule-breaking themes before saving them.

## 0.1.0 (2026-08-21)

### Minor Changes

- 6667ddd: Add `space-button-px` and `space-button-py` semantic spacing tokens
  (bringing the total to 44), consumed by `@zevaui/components`'s `Button`
  recipe. `sm` and `lg` sizes derive from these same two tokens via fixed
  ratios in the recipe rather than declaring independent tokens per size, so
  the proportional relationship between sizes can't drift out of sync.
- 14c630f: Export `themeIds` (the ordered list of theme ids) and `themeKeyOf` (the
  kebab-case id to camelCase token-key mapping) from the package entrypoint.
  These are generated by `scripts/build.js` from the same source that drives
  the token output, so consumers no longer need to hand-maintain their own
  copy of the id/key mapping.
