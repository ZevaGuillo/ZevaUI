# @zevaui/constraints

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
