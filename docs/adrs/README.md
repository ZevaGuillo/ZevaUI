# Architecture Decision Records

Every non-trivial decision in this project leaves an ADR, with the discarded
alternatives and their justification (constitution, principle 6). ADRs are a
dated historical record: they are amended in place with dated notes, never
rewritten.

**Language convention**: ADR-0001 through ADR-0020 are written in Spanish and
remain so — they are the historical archive. New ADRs (0021 onward) are
written in English. This index summarizes every existing ADR in English so an
international reader can navigate the full decision history without reading
Spanish; for the complete reasoning, measurements, and discarded
alternatives, the linked document is always the source of truth.

ADRs 0001–0011 are accepted and implemented. ADRs 0012–0020 are **proposals**:
each was analyzed against the real codebase (read-only) and recorded, but
none is scheduled — implementing one requires its own acceptance.

---

### ADR-0001 — Technology stack and consumption model
**File**: [`0001-stack-y-modelo-de-consumo.md`](./0001-stack-y-modelo-de-consumo.md) · **Status**: Accepted
Fixes the foundational stack: PandaCSS as an internal, build-time-only style engine (consumers never install it), Style Dictionary as the single DTCG source of truth emitting `tokens.css`/`tokens.d.ts`/`tokens.manifest.json`, React Aria for accessible behavior, Next.js for the registry/adoption dashboard, and one npm artifact per package via Changesets. Consumers receive two separate CSS layers, no global reset, and theme exclusively by overriding `--zui-*` CSS variables rather than forking components — which makes governance structural: the MCP server and the theme validator read the same generated manifests, so no logic is duplicated.

### ADR-0002 — Monorepo structure and tooling
**File**: [`0002-estructura-del-monorepo-y-tooling.md`](./0002-estructura-del-monorepo-y-tooling.md) · **Status**: Accepted
Establishes a pnpm + Turborepo monorepo with a hard boundary: everything under `packages/` is publishable, everything under `apps/` is executable and never published. Biome replaces ESLint + Prettier as the single lint/format tool — accessibility deliberately does not depend on lint plugins but on React Aria plus the axe-core CI gate — and Changesets versions each package independently. The dashboard dogfoods the published packages as workspace dependencies so breakage surfaces in-house before release, and `audit-ds-usage.yml` is defined as a reusable workflow any consumer adopts with one `uses:` line.

### ADR-0003 — Tokens MCP server and theme validation
**File**: [`0003-servidor-mcp-de-tokens-y-validacion.md`](./0003-servidor-mcp-de-tokens-y-validacion.md) · **Status**: Accepted (partially superseded by ADR-0020 when implemented)
Implements only 1 of the 6 MCP tools ADR-0001 announced — `validate_theme` — because `list_components`/`get_component` needed a `components.manifest.json` that did not yet exist, and publishing empty stubs would make an agent trust an advertised capability that returns nothing; three other tools are subsumed by exposing the three themes as read-only MCP resources. The theme id is a closed `z.enum` (a typo like `"hight-contrast"` would otherwise silently validate against the wrong contrast tier and pass), and the measured cost of MCP SDK v1 (64 transitive packages including an unused HTTP stack) is recorded as the explicit trigger to migrate to v2.

### ADR-0004 — Storybook and the blocking accessibility gate
**File**: [`0004-storybook-y-la-puerta-de-accesibilidad.md`](./0004-storybook-y-la-puerta-de-accesibilidad.md) · **Status**: Accepted
Adopts PandaCSS in ejected mode (measured: 141 emitted CSS lines versus 604 with the default preset, which also injected foreign color scales) and turns the token bridge into a mechanical gate: every Panda token declaration must be a `var(--zui-*)` pointer, and `Button` types `className`/`style` as `never` so hardcoded styling cannot enter. The accessibility gate runs axe in real Chromium via Playwright — jsdom is explicitly rejected because the `color-contrast` rule needs real layout and paint — and a deliberately broken story plus a harness script prove the gate can actually fail ("the gate has teeth").

### ADR-0005 — Overlays (`Dialog`, `Menu`): scrim, surface separation, composition
**File**: [`0005-overlays-dialog-y-menu.md`](./0005-overlays-dialog-y-menu.md) · **Status**: Accepted
The modal scrim carries its alpha in the color channel via `color-mix` (a child cannot escape an ancestor's compositing group with `opacity`), overlays separate from the page with shadow over an opaque surface after the border alternative measured 2.49:1/2.66:1 against a 3.0:1 floor, and both reuse `radius-card` instead of minting new aliases. Composition is via typed content props rather than `children` because `role="menu"` only admits `menuitem` children and react-aria derives the menu's accessible name from the trigger the component owns; it was measured that both overlays hide background content via `inert`, not `aria-hidden`.

### ADR-0006 — `Card` and `Alert`: completing the core roster
**File**: [`0006-card-alert-roster-completo.md`](./0006-card-alert-roster-completo.md) · **Status**: Accepted
Completes the six-component roster and states the rule that decides future cases: typed content props where ARIA structure carries the component's semantics, slot composition where it does not — so `Card` composes with `Card.Header/Body/Footer` while `Dialog`/`Menu` do not. `Alert` keeps neutral text across all three tones after the obvious tonal design measured 3.90/2.93/1.93 against a 4.5:1 floor, and its accent border's WCAG 1.4.11 deficit (3 of 9 theme/tone combinations below 3.0:1) is recorded rather than hidden — later closed by ADR-0010. `Card` and `Alert` are the first server-renderable components, which forced the client-directive gate to assert both directions of `clientOnly`.

### ADR-0007 — Bundle budget measured on a packed consumer entry
**File**: [`0007-presupuesto-de-bundle-y-medicion-de-entradas.md`](./0007-presupuesto-de-bundle-y-medicion-de-entradas.md) · **Status**: Accepted
Declares the bundle budget over real bundled consumer entries (esbuild, react external, gzip level 9) rather than over `dist/**`, because `react-aria-components` is 95% of the barrel's 56,849 B gzip and a `dist/**` proxy would watch the irrelevant 5%. Entries are derived from the component registry so a missing one is a hard failure, and measured bytes are recorded alongside a human-decided ceiling that `--record` never overwrites, making the file's own git diff the measurement ledger. The ADR states its blind spot without decoration — per-component regressions hiding inside the barrel's margin — which the pending-debt work later closed by giving `Menu`, `Dialog` and `Input` their own budget entries.

### ADR-0008 — Visual regression in CI with Linux-only baselines
**File**: [`0008-regresion-visual-en-ci-y-linea-base-linux.md`](./0008-regresion-visual-en-ci-y-linea-base-linux.md) · **Status**: Accepted
Reuses the existing Storybook + Chromium harness with zero new dependencies and captures the fixed viewport rather than the story canvas, because portalled overlays would leave 14 of 38 baselines capturing an empty canvas that passes forever while asserting nothing. Capture is a fail-closed `afterEach` keyed by run configuration so a new visual partition cannot silently run with zero assertions. Baselines are Linux-only and generated exclusively by a self-verifying `workflow_dispatch` workflow — never automatically, since re-baselining on red deletes the gate.

### ADR-0009 — Usage audit as a reusable workflow, no network, in-house scanner
**File**: [`0009-auditoria-de-uso-como-reusable-workflow.md`](./0009-auditoria-de-uso-como-reusable-workflow.md) · **Status**: Accepted
Ships the usage audit as a `workflow_call`-only reusable workflow backed by four dependency-free Node modules (a checkout is the whole install) with no outbound HTTP, because the real risk is silent undercounting rather than breakage. The `.zevaui-audit` checkout directory is a contract between the YAML and the scanner — a mismatch once made a consumer using only `Button` receive `Alert, Button, Dialog`, and since 2026-08-26 a structural test compares the real constant against the YAML text. The parser's ceiling is asserted absent rather than accidental; barrel re-exports were moved **into** scanner scope on 2026-08-26 after review found they silently undercounted adoption. Verified end to end against a real external consumer repository.

### ADR-0010 — Closing the WCAG 1.4.11 non-text contrast gap
**File**: [`0010-contraste-no-textual-wcag-1411.md`](./0010-contraste-no-textual-wcag-1411.md) · **Status**: Accepted
Closes the gap ADR-0004/0005/0006 had each documented from a different angle, by modeling non-text contrast as a second class of contrast pair rather than a second theme axis: `checkContrast` takes the floor as an explicit argument and `validateTheme` applies a flat 3.0:1 non-text tier identically to all three themes (WCAG 1.4.11 is AA-only). Five semantic token repoints in `light`/`dark` — including a revised amber chosen at 4.54 over the originally designed 6.41 to preserve hue — bring every pair above the floor without touching any component or the high-contrast theme.

### ADR-0011 — Adoption registry and panel: OIDC ingestion over append-only storage
**File**: [`0011-registro-de-adopcion-y-panel.md`](./0011-registro-de-adopcion-y-panel.md) · **Status**: Accepted (amended through 2026-08-26)
Builds the registry and read-only panel on Vercel + Neon with no provider SDKs (plain `pg` + Drizzle + flat SQL migrations), accepting writes only from GitHub Actions OIDC tokens verified with `node:crypto` in a strict fail-closed gate order, over append-only storage where the write log itself is the audit evidence. `app` is a label never an identity (cross-checked against OIDC claims), and `null` versus `[]` for deprecated components is a compiler-enforced distinction between "we don't know" and "we looked and found none". The ADR records ten design/spec divergences honestly, including the measured finding that the reusable workflow must declare **no** `permissions:` block at all; its `oidc_jti` pruning follow-up was closed on 2026-08-26 by making each authenticated ingestion prune expired rows, bounding the table without a cron.

### ADR-0012 — Pre-release impact radius (proposal)
**File**: [`0012-radio-de-impacto-pre-release.md`](./0012-radio-de-impacto-pre-release.md) · **Status**: Proposed
Proposes turning the passive adoption registry into an input to the release decision: diff the npm-published component manifest against the PR's built manifest, classify breaking entries, and post an advisory PR comment naming the affected apps from the registry. Advisory and never blocking, because blocking would put a database with autosuspend back on the release critical path — the exact coupling ADR-0011 removed. Analysis against the real scanner scoped the promise honestly: "affects 3 apps" is defensible, "14 call sites" is not, and the comment must declare that the opt-in registry makes its number a lower bound.

### ADR-0013 — Executable migration codemods (proposal)
**File**: [`0013-codemods-ejecutables-de-migracion.md`](./0013-codemods-ejecutables-de-migracion.md) · **Status**: Proposed
Proposes replacing prose migration guides with an executable `npx @zevaui/migrate` package built on ts-morph, defended by a CI gate that typechecks the consumer fixture *before* migrating (without the pre-gate, "the codemod left it compiling" is unfalsifiable), applies the codemod, typechecks again, and asserts the diff against a committed expected-migrated fixture — typecheck alone is a weak oracle a code-deleting codemod would also satisfy. The harness is built now; the package ships only with the first real breaking release.

### ADR-0014 — Deprecation with an expiry date (proposal)
**File**: [`0014-deprecacion-con-caducidad.md`](./0014-deprecacion-con-caducidad.md) · **Status**: Proposed
Proposes adding `removeIn` to the deprecation shape and letting the reusable workflow fail a consumer's CI for using something scheduled for removal — warning before the date, error after. The central finding: the policy cannot come from the built manifest (the workflow checks the design system out without building it), so policy lives in a committed `deprecations.json` kept in sync by its own gate. `removeIn` is a calendar date, not a semver version — comparable without a parser, and it bites even if the consumer never upgrades. Enforcement is opt-in, because mandatory enforcement would need a `v2` tag and would contradict the project's own thesis.

### ADR-0015 — CSS token audit (proposal)
**File**: [`0015-auditoria-de-tokens-css.md`](./0015-auditoria-de-tokens-css.md) · **Status**: Proposed
Proposes scanning consumer files for `var(--zui-*)` references and cross-checking them against the already-published `tokens.manifest.json`, since renaming a token is likely the most frequent breaking vector and the import-only scanner is completely blind to it. Names the blanking paradox honestly: the existing lexer erases strings as noise, but for tokens the strings *are* the signal. Insists on a mandatory deploy order — registry schema first, emission second — because the ingestion allowlist is closed and the reporter never fails a build, so the wrong order loses data silently.

### ADR-0016 — Consumer conformance (proposal)
**File**: [`0016-conformance-del-consumidor.md`](./0016-conformance-del-consumidor.md) · **Status**: Proposed
Proposes a conformance suite for what the *consumer* does wrong — stylesheet import order, external CSS targeting `.zui-*` class selectors (the one bypass left once `className`/`style` are typed `never`), hardcoded literals in design-system zones — delivered as an opt-in input on the existing reusable workflow so the default run stays byte-identical and the `v1` tag contract holds. Draws the key false-positive line explicitly: overriding `--zui-*` custom properties is the *official* theming mechanism, so rules match class selectors, never variable declarations. Each rule ships with a broken fixture and a teeth test.

### ADR-0017 — Theme editor as a consumer app (proposal)
**File**: [`0017-theme-editor-como-consumidor.md`](./0017-theme-editor-como-consumidor.md) · **Status**: Proposed
Proposes a pure client-side SPA where color pickers feed a live preview of all six components and `validateTheme` rejects in real time showing the exact failing pair and ratio — an artifact the constitution already names (O6, RF-17). The load-bearing part is the hard line against scope creep: zero persistence, zero tenant concept, zero auth, JSON/clipboard export as the ceiling, because multi-tenant administration belongs to consuming applications and that boundary is not renegotiated for a demo's convenience.

### ADR-0018 — The visual diff as a PR artifact (proposal)
**File**: [`0018-diff-visual-como-artefacto.md`](./0018-diff-visual-como-artefacto.md) · **Status**: Proposed
Proposes uploading the failing visual-diff PNGs as a CI artifact and posting a sticky PR comment with links, after measuring all four inline-image routes and finding none is free (artifacts have no embeddable URL, step summaries strip `data:` URIs, the Checks API needs hosted images, an orphan branch needs write scope and garbage collection). The security-shaped part: the commenting job is separate, runs on failure only with job-level write permission, and installs no dependencies and executes no repository code; `pull_request_target` is prohibited outright.

### ADR-0019 — Adoption metrics over time (proposal)
**File**: [`0019-metricas-de-adopcion-en-el-tiempo.md`](./0019-metricas-de-adopcion-en-el-tiempo.md) · **Status**: Proposed
Proposes computing time-to-upgrade, share of consumers on latest, and deprecation debt over time from the append-only submission history that already exists but no query exploits. The central verified gap was that release dates existed nowhere — changeset changelogs carry no dates, `git log` is blocked by the no-git-tag-read gate and Vercel's shallow clone — so dates are stamped forward and were backfilled for 0.1.0/0.2.0 (landed 2026-08-26: dated changelog headings parsed into the release log). Only `dsVersionSource: installed` counts toward time-to-upgrade, since a declared range does not prove adoption.

### ADR-0020 — MCP revisited: the deferral condition was met, plus `propose_theme` (proposal)
**File**: [`0020-mcp-revisitado-y-propose-theme.md`](./0020-mcp-revisitado-y-propose-theme.md) · **Status**: Proposed
Notes that ADR-0003's exact deferral condition — "`components.manifest.json` does not exist yet" — has since been satisfied, and proposes unblocking exactly two tools (`list_components`, `get_component`) reading the manifest through a workspace subpath import so it cannot drift. Also proposes `propose_theme(brandColor)`: binary search over OKLCH lightness in topological order (backgrounds first, each foreground against its worst background), placed in `@zevaui/constraints` so it stays testable without the protocol; impossible colors are never silently hue-shifted — the closest pair is returned with explicit adjustments and warnings, and every proposed theme is self-validated by `validateTheme` before being returned.
