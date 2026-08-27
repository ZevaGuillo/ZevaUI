# @zevaui/components

## 0.2.0 (2026-08-22)

### Minor Changes

- 34dbdd3: Initial public release of the ZevaUI packages.

  - `@zevaui/tokens` — single source of truth for design tokens, compiled at build time to CSS custom properties, a typed manifest, and per-theme stylesheets (light, dark, high-contrast).
  - `@zevaui/constraints` — the machine-readable design contract plus `validateTheme()`: WCAG 1.4.3 text contrast (4.5:1 / 7.0:1 theme-scoped) and WCAG 1.4.11 non-text contrast (flat 3.0:1) enforced as a blocking gate.
  - `@zevaui/components` — six core React components (Button, Input, Card, Alert, Dialog, Menu) that consume tokens exclusively through CSS custom properties.
  - `@zevaui/mcp` — an MCP server exposing `validate_theme`, so agents and theme editors can reject rule-breaking themes before saving them.

## 0.1.0 (2026-08-21)

### Minor Changes

- aaa965d: Adds a bundle-size budget gate for RNF-02. `pnpm turbo run size` bundles a
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

- 6594595: Adds `Card` and `Alert` to `@zevaui/components`, completing RF-05's
  six-component roster and the first two server-renderable components (no
  `"use client"` directive — see `docs/adrs/0006-card-alert-roster-completo.md`).

  `Card` (`surface`: `elevated` | `outlined`, default `elevated`) is a
  multi-part slot recipe with `Card.Header` / `Card.Body` / `Card.Footer`
  dot-notation parts, composed with `children` — its zones are arbitrary
  content a consumer cannot structurally break, unlike `Dialog`/`Menu`'s typed
  content props.

  `Alert` (`tone`: `danger` | `success` | `warning`, no default, no `info`) is
  a single-part recipe whose role is derived from `tone` (`danger`/`warning`
  get `role="alert"`, `success` gets `role="status"`) rather than taken as a
  prop. Text stays `color-text-default` in every tone — measured against the
  real token values, `{tone}.default` text on `{tone}.subtle` background fails
  WCAG AA in all three tones (3.90 / 2.93 / 1.93 against a 4.5:1 floor); the
  tone color is a non-text accent (the left border) only.

  Same theming model as the rest of the package: no `className`/`style` escape
  hatch (both typed `never`) — theme by overriding `--zui-*` custom
  properties, never by forking.

  See `docs/adrs/0006-card-alert-roster-completo.md` for the composition,
  contrast, and server-rendering decisions behind them.

- ae1c8d1: Adds the first two overlays to `@zevaui/components`. `Dialog` (`size`: `sm` |
  `md` | `lg`, `placement`: `center` | `top`, defaults `md`/`center`) is a modal
  built on React Aria's `ModalOverlay`/`Modal`, with a required `title` and typed
  `description`/`footer`/`children` content slots. `Menu` (`size`: `sm` | `md` |
  `lg`, `width`: `auto` | `trigger`, defaults `md`/`auto`) is a dropdown that owns
  its own trigger and takes its rows as `items: readonly MenuItemDescriptor[]`
  (`id`, `label`, optional `description`, optional `isDisabled`) rather than as
  children — `role="menu"` only accepts `menuitem` children, and react-aria
  derives the menu's accessible name from the trigger, so both stay inside the
  component.

  Neither overlay has a tone or intent axis. Both variant axes on both components
  are purely geometric, because a colored boundary would need
  `color-border-strong`, which measurably fails WCAG 1.4.11 non-text contrast
  (2.49:1 light, 2.66:1 dark, against a 3.0:1 floor). Surfaces are separated by
  `shadow-modal` / `shadow-dropdown` over an opaque `color-bg-surface` instead.

  Same theming model as `Button`, unchanged: no `className`/`style` escape hatch
  (both are typed `never`) — theme by overriding `--zui-*` custom properties,
  never by forking. The dialog scrim carries its translucency in the color
  channel (`color-mix` over `color-bg-inverse`), never in `opacity`, so nothing
  can fade the dialog inside it.

  See `packages/components/README.md` for the prop tables and the theming model,
  and `docs/adrs/0005-overlays-dialog-y-menu.md` for the scrim, surface
  separation, radius and composition decisions behind them.

- 6667ddd: First real release of `@zevaui/components`. Ships `Button` (`visual`:
  `solid` | `subtle` | `danger`, `size`: `sm` | `md` | `lg`, defaults `solid`/
  `md`), built on React Aria for accessible behavior and a PandaCSS-compiled,
  `--zui-*`-only style layer for visuals. No `className`/`style` escape hatch
  — theme by overriding `--zui-*` custom properties, never by forking.

  Ships `dist/styles.css`, `dist/components.manifest.json`, and compiled
  types. See `packages/components/README.md` for the theming model and
  `docs/adrs/0004-storybook-y-la-puerta-de-accesibilidad.md` for the PandaCSS
  posture behind the compiled output.
