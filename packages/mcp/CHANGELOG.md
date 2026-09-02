# @zevaui/mcp

## 0.2.1 (2026-09-02)

### Patch Changes

- 6776df9: Report the real package version in the MCP handshake. `serverInfo.version` was hardcoded to `0.0.0` in the published 0.2.0 artifact; the server now derives it from `package.json` at runtime (resolved relative to the module, so it works from both `src/` and the compiled `dist/`), and hosts finally see the actual version they installed.

## 0.2.0 (2026-08-22)

### Minor Changes

- 34dbdd3: Initial public release of the ZevaUI packages.

  - `@zevaui/tokens` — single source of truth for design tokens, compiled at build time to CSS custom properties, a typed manifest, and per-theme stylesheets (light, dark, high-contrast).
  - `@zevaui/constraints` — the machine-readable design contract plus `validateTheme()`: WCAG 1.4.3 text contrast (4.5:1 / 7.0:1 theme-scoped) and WCAG 1.4.11 non-text contrast (flat 3.0:1) enforced as a blocking gate.
  - `@zevaui/components` — six core React components (Button, Input, Card, Alert, Dialog, Menu) that consume tokens exclusively through CSS custom properties.
  - `@zevaui/mcp` — an MCP server exposing `validate_theme`, so agents and theme editors can reject rule-breaking themes before saving them.

### Patch Changes

- Updated dependencies [34dbdd3]
  - @zevaui/tokens@0.2.0
  - @zevaui/constraints@0.2.0

## 0.1.0 (2026-08-21)

### Minor Changes

- 14c630f: First real release of the Zevaui MCP server. Exposes the three resolved
  themes as resources (`zevaui://tokens/{light,dark,high-contrast}`) and a
  `validate_theme` tool that checks a theme's colors against the contrast
  contract (4.5:1 for light/dark, 7.0:1 for high-contrast), either
  self-checking the shipped palette or pre-flighting a candidate one. Ships a
  `zevaui-mcp` bin that speaks stdio.

  Only `validate_theme` from ADR-0001's D8 tool list is implemented in this
  release; component tools are deferred until `components.manifest.json`
  exists.

### Patch Changes

- Updated dependencies [109596a]
- Updated dependencies [6667ddd]
- Updated dependencies [14c630f]
  - @zevaui/constraints@0.1.0
  - @zevaui/tokens@0.1.0
