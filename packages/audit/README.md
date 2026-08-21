# @zevaui/audit

Reports which ZevaUI components an app actually imports, and at which design-system
version, so "who uses what" is a CI artifact instead of a guess.

Private and unpublished. Consumers do not install it — they call the reusable
workflow, which runs this scanner straight from a checkout.

## Quick path (for a consumer repository)

```yaml
# .github/workflows/ds-usage.yml
name: DS usage

on:
  pull_request:

jobs:
  audit:
    uses: ZevaGuillo/ZevaUI/.github/workflows/audit-ds-usage.yml@v1
    with:
      ds-ref: v1
```

That produces a `ds-usage-report-*` artifact and a table in the run's step
summary. No install step, no token, no network call.

### Inputs

| Input | Required | Default | What it does |
|---|---|---|---|
| `ds-ref` | yes | — | The design-system revision whose scanner runs. No default on purpose: the report says which DS version you use, but not which scanner produced it, so an unpinned scanner would silently change what a report means between two runs that look identical. |
| `app` | no | the caller's `github.repository` | The identity the report is labelled with. |
| `working-directory` | no | `.` | Subdirectory of your checkout to scan. |

### Monorepo consumers

Call it once per app, and name each one. The default is refused — not silently
applied — whenever `working-directory` points somewhere other than `.`, because
labelling one app's report with the whole repository's name is the mistake this
tool exists to prevent:

```yaml
jobs:
  audit-web:
    uses: ZevaGuillo/ZevaUI/.github/workflows/audit-ds-usage.yml@v1
    with:
      app: web
      working-directory: apps/web
      ds-ref: v1
  audit-admin:
    uses: ZevaGuillo/ZevaUI/.github/workflows/audit-ds-usage.yml@v1
    with:
      app: admin
      working-directory: apps/admin
      ds-ref: v1
```

## The report

```json
{
  "app": "web",
  "dsVersion": "1.2.3",
  "dsVersionSource": "installed",
  "components": ["Alert", "Button", "Card"],
  "generatedAt": "2026-01-01T00:00:00.000Z"
}
```

`dsVersionSource` is not decoration. `dsVersion` resolves in a cascade —
the exact installed version from `node_modules` first, the declared range from
your `package.json` second — and without the source, an exact `"1.2.3"` and a
merely-declared `"^1.2.0"` would be indistinguishable. When neither exists the
run fails rather than reporting a guessed version, because a false audit signal
is worse than a missing one.

## What it detects, and what it does not

Detected: single-line named imports, multi-line named imports, aliased imports
(reported under the real exported name), side-effect imports, and all of the
above written without terminating semicolons.

**Not** detected, and asserted absent in the fixture rather than left to work
by accident:

- namespace imports (`import * as Zui from "@zevaui/components"`)
- dynamic `import()`
- type-only imports (`import type { ButtonProps } from ...`)
- barrel re-exports (`export { Button } from "@zevaui/components"`)
- any subpath beyond the three declared exports — `./styles.css` and
  `./components.manifest.json` carry zero components and must never phantom

If your app reaches components through a re-export barrel, this report will
undercount you. That gap is real, named here and in ADR-0009, and not papered
over.

## Skipped files

The step summary carries a `skipped files` count. It names everything the walk
could **not** read: symlinks (never followed), unreadable directories,
non-file entries, files over 1 MB, and files that threw on read.

It deliberately does not count pruned directories (`node_modules`, `dist`,
`.git`, …) or files outside the extension allowlist. Those are documented,
stable exclusions; counting them would drown the one signal the number carries.

A non-zero count means part of your tree was not audited. Treat it as such.

## Local development

```bash
pnpm --filter @zevaui/audit test        # unit tests
pnpm --filter @zevaui/audit run audit:gate   # proof-of-teeth gate
```

`audit:gate` runs the real scanner against `__fixtures__/consumer`, a fixture
app with a committed known-correct answer, and fails unless the produced report
deep-equals `__fixtures__/expected-report.json`. It also plants a decoy import
inside the fixture's `node_modules` at run time to prove that directory is
really pruned, and removes it afterwards.

It is a raw script rather than a turbo task on purpose: it mutates the fixture
tree while running, and that side effect must never be memoised by a cache.

To run the scanner by hand against any directory:

```bash
AUDIT_APP=web GITHUB_WORKSPACE=/path/to/app node packages/audit/scripts/audit-usage.js
```

The report is the only thing on stdout — diagnostics go to stderr — so it pipes
into `jq` cleanly.
