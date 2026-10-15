# @zevaui/mcp

## 0.2.4

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

- Updated dependencies [e731ece]
  - @zevaui/constraints@1.0.1
  - @zevaui/tokens@0.3.1

## 0.2.3

### Patch Changes

- Updated dependencies [45702dc]
- Updated dependencies [15657e4]
- Updated dependencies [564104b]
  - @zevaui/constraints@1.0.0
  - @zevaui/tokens@0.3.0

## 0.2.2

### Patch Changes

- Updated dependencies [ca89fd2]
  - @zevaui/tokens@0.2.1
  - @zevaui/constraints@0.2.0

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
