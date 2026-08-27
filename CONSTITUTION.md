# Project Constitution — `design-system`

> This is the canonical constitution of the project. It was originally
> authored in Spanish (`CONSTITUCION.md`, v0.2, 2026-08-16); the English
> text became the single canonical version on 2026-08-27 and the Spanish
> original was retired — it remains available in git history. ADRs 0001–0020
> predate the transition and reference the constitution in Spanish prose;
> their file pointers were updated to this document.

| Field | Value |
|---|---|
| Name | `design-system` |
| Type | Governed design system (DesignOps) |
| Status | Initial definition |
| Version | 0.2 |
| Date | 2026-08-16 |
| Author | Guillermo Zevallos |

---

## 1. Name and one-line purpose

A governed design system that guarantees no change breaks existing consumers.

---

## 2. The real reason (why this project exists)

This project exists because a real problem is badly solved in practice: when
several applications share a design system, it almost always ends badly. A
token change breaks products in production without warning. Nobody knows
which version each application consumes. Accessibility degrades release after
release. The cause is rarely a lack of components: it is a lack of
governance.

The central problem that motivates it (from the project catalog):

> *"A design system does not fail for lack of components but for lack of
> governance: nobody knows which version each application uses, a token
> change breaks three products without warning, and accessibility degrades
> without anyone noticing. The problem is not building buttons — it is
> guaranteeing that a change does not break whoever already consumes it."*

**Project thesis:** the components are the excuse; governance is the product.

---

## 3. Principles (non-negotiable)

These are the articles of the constitution. They are not negotiated away
under time or scope pressure.

1. **Governance is the product.** A component is not added unless it comes
   with the guarantee that the change does not break consumers (versioning,
   contract testing, visual regression).
2. **Evidence over opinion.** Every quality claim is backed by a measurable
   metric. Without a number, it is not done.
3. **Accessibility is a functional requirement, not an audit.** A change
   that degrades accessibility does not get merged.
4. **A single source of truth.** Tokens live in one place; everything else
   (CSS, TypeScript, themes) derives from that source. Nothing is hardcoded
   in the consumers.
5. **Immutable versions.** A published release is never rewritten. Every
   breaking change ships with a migration guide.
6. **Every non-trivial decision leaves an ADR**, with the discarded
   alternatives and their justification.
7. **Living documentation.** The README makes the problem understandable
   without reading the code.

---

## 4. Boundaries (what this project is NOT)

- It is not a product with end users; it is infrastructure for the
  applications that consume it.
- It is not a "pretty" component library: a component without governance
  does not belong in this project.
- It is not fullstack: the backend layer is thin (version registry and
  adoption panel). Heavy fullstack work lives in the products that consume
  it.
- Its priority is solving the governance problem, not reaching broad
  component coverage.
- **It does not know the tenants.** The design system is a build-time,
  tenant-agnostic artifact. Multi-tenant administration (tenant creation,
  theme editor, `tenant → theme` storage) is the consuming application's
  responsibility, not the design system's. The design system publishes the
  rules contract and a validator; the application applies them at runtime.

---

## 5. Measurable objectives

| # | Objective | How it is verified |
|---|---|---|
| O1 | A token change is detected automatically if it breaks a consumer | Contract testing before release |
| O2 | Zero critical accessibility violations in CI | Blocking axe-core gate |
| O3 | Zero breaking changes published without a migration guide | Changelog + migration guides |
| O4 | Answer in under a minute which version each application consumes | Version registry + adoption panel |
| O5 | Non-brittle visual regression: a real change is detected, an irrelevant one does not block | Explicit thresholds in CI |
| O6 | A tenant theme that breaks contrast is rejected before it is saved | Design-system validator applied in the app's theme editor |

---

## 6. Scope

### 6.1 Published packages (all build-time, tenant-agnostic)

The design system is published as independent packages:

| Package | Contents | Time |
|---|---|---|
| `@<user>/tokens` | Token source of truth; generates CSS custom properties and TypeScript types | build |
| `@<user>/components` | Core components that consume only CSS vars (never literal values) and expose slots for composition | build |
| `@<user>/constraints` | Machine-readable rules contract (which token is a color, which pairs must pass WCAG AA contrast, valid scales) and a validator (`validateTheme(theme) → Pass/Fail`) | build |

### 6.2 In v1

- Tokens: colors, typography, spacing, radii, shadows; three base themes
  (light, dark, high contrast).
- A minimal set of core components (six, to be defined).
- Theming: tokens are emitted as **CSS custom properties**
  (`var(--color-primary)`), enabling runtime theming by consumers without
  the design system knowing the tenants.
- Living documentation (Storybook) with executable examples.
- Blocking CI: lint, typecheck, test, visual regression, accessibility,
  validation of base themes against the contract.
- Semantic versioning of the package and migration guides.
- **Version registry + adoption panel** (thin backend): audits which
  version each application consumes and which version was published.
- **Contract testing** between the system and its consumers (detects
  breaking changes before release).
- **Rules contract + validator** (`@<user>/constraints`): the design
  system's CI validates the base themes; the consuming application applies
  the validator in its theme editor to reject tenant themes that break the
  rules.

### 6.3 Out of v1 (grows later)

- Sync with a design tool (Figma / Tokens Studio).
- Multi-framework.
- Centralized scanning (central manifest / code search via the GitHub API)
  to detect consumers that do not report — needed only at scale, when an
  organization has many consumers.
- Broad component coverage.

### 6.4 Usage audit mechanism

The registry knows which applications consume the design system through two
mechanisms:

**Mechanism A (default) — the consumer reports, opt-in.**

The design system publishes a reusable workflow (`audit-ds-usage.yml`). The
consuming application adds it to its CI with one line. That workflow:

1. Reads the consumer's `package.json` and obtains the installed version of
   `@<user>/components`.
2. Parses the `import`s from `@<user>/components` / `@<user>/tokens`.
3. `POST`s a report to the registry with: `{ app, @ds version, imported
   components, deprecated components in use, date }`.

Honest consideration: the report is **opt-in** (it depends on the consumer
adding the workflow). For a portfolio with few applications controlled by
the same author, this is enough.

**Mechanism B (optional, for scale) — centralized scanning.**

When an organization has many consumers and a consumer may fail to report,
the registry needs an independent signal source. Three options:

| Option | How | What it detects |
|---|---|---|
| Central CI manifest scan | A workflow in the design-system repo walks the org's repos' `package.json` files via the GitHub API | Who declares `@<user>/...` as a dependency |
| Code search | Searching `import.*@<user>/` across the org's code (GitHub API / Sourcegraph) | Who imports the design system in their code |
| Consumer tag | Each consumer repo is tagged with the `ds:consumer` topic and a central workflow reads it | Who declares themselves a consumer |

Mechanism B **is introduced at scale**. It is not needed for a v1 with few
applications; **documenting that it exists closes the opt-in hole when the
context demands it**.

---

## 7. Definition of "done"

A change is done when it meets all three conditions:

1. The documentation makes the problem understandable without reading the
   code.
2. The ADRs explain the discarded alternatives.
3. At least one measured metric backs the main decision.

Without these three conditions the work is not done: it is abandoned with
good presentation.

---

## 8. Software requirements

### 8.1 Packages and architecture

The design system is published as three independent packages, all build-time
and tenant-agnostic:

- **`@<user>/tokens`** — token source of truth; generates CSS custom
  properties and TypeScript types.
- **`@<user>/components`** — core components that consume only CSS vars and
  expose slots for composition.
- **`@<user>/constraints`** — machine-readable rules contract + validator.

### 8.2 Functional requirements (RF)

**Tokens**

- **RF-01** — The system maintains a single source of truth for tokens.
- **RF-02** — At build time it generates CSS custom properties and
  TypeScript types from that source.
- **RF-03** — It provides three base themes: light, dark and high contrast,
  validated against the contract.
- **RF-04** — It prevents hardcoded style literals in consumers (verified by
  lint/grep in CI).

**Components**

- **RF-05** — v1 includes a minimal set of six core components, all derived
  from tokens.
- **RF-06** — Every component exposes executable documentation (Storybook)
  with its variants.
- **RF-07** — Every component consumes only CSS vars and exposes slots for
  composition (no structural variation per consumer; visual variation only
  through tokens).

**Versioning and publication**

- **RF-08** — Publication with semantic versioning and a generated
  changelog.
- **RF-09** — Every breaking change includes a migration guide.
- **RF-10** — Per-application versions are achieved through package
  versioning (semver). No per-application derived components are created
  (explicit anti-pattern).

**Governance — usage audit (thin backend)**

- **RF-11** — The design system publishes a reusable audit workflow the
  consumer adds to its CI to report its usage (installed version + imported
  components).
- **RF-12** — A registry stores the consumers' reports: `{ app, @ds
  version, imported components, deprecated components, date }`.
- **RF-13** — A read-only adoption panel shows versions per application,
  deprecated components in use, and the release log.

**Governance — rules enforcement (contract + validator)**

- **RF-14** — The design system publishes a machine-readable rules contract
  (token types, WCAG AA contrast pairs, valid scales).
- **RF-15** — The design system publishes a validator `validateTheme(theme)
  → Pass/Fail` with the list of violations.
- **RF-16** — The design system's CI validates the base themes against the
  contract (blocking gate).
- **RF-17** — The validator is published as a dependency so that the
  applications' theme editor rejects tenant themes that break the rules
  before saving them. The design system does not know the tenants.

**Quality**

- **RF-18** — Automated visual regression tests in CI.
- **RF-19** — Blocking accessibility verification in CI.
- **RF-20** — Contract testing between the design system and its consumers.

### 8.3 Non-functional requirements (RNF)

- **RNF-01 (Accessibility)** — Meet WCAG 2.2 AA; zero critical violations
  in CI. For tenant themes, the validator rejects combinations that break
  contrast.
- **RNF-02 (Performance)** — A declared, monitored bundle budget; the
  system's integration does not degrade consumers' Core Web Vitals.
- **RNF-03 (Determinism)** — Visual regression is reproducible (not
  brittle), with explicit thresholds.
- **RNF-04 (Maintainability)** — Every non-trivial decision is recorded in
  an ADR.
- **RNF-05 (Measurement)** — Every relevant change records a before/after
  metric in the history.
- **RNF-06 (Security)** — The adoption panel is read-only for visitors;
  mutations require authentication.
- **RNF-07 (Portability)** — Consumers install the system as a versioned
  dependency, with no manual steps.
- **RNF-08 (Decoupling)** — No design-system package references tenants,
  concrete applications, or their runtime. Multi-tenant administration is
  external.

---

## 9. Technical stack

| Layer | Technology |
|---|---|
| Tokens | Style Dictionary |
| Components | React + TypeScript |
| Documentation | Storybook |
| Rules contract | Machine-readable JSON + TypeScript validator |
| CI | GitHub Actions (lint, typecheck, test, Playwright, axe-core, Lighthouse) |
| Registry and panel | Node + Postgres (or SQLite for v1), minimal API |
| Publication | npm, with semver |

---

## 10. Structure and repositories (polyrepo)

| Repository | Role |
|---|---|
| `design-system` (this one) | `tokens`, `components`, `constraints` packages, CI, registry + adoption panel |
| `fieldsync`, `collabdocs`, etc. | Independent repos that consume the packages as versioned dependencies |

### Where each thing lives

| Responsibility | Where? | Knows tenants? |
|---|---|---|
| Tokens and components (build-time) | `@<user>/tokens`, `@<user>/components` | No |
| Rules contract + validator (build-time) | `@<user>/constraints` | No |
| Registry + adoption panel (thin backend) | `design-system` repo | No |
| Centralized scanning (at scale) | `design-system` repo, central workflow | No |
| Multi-tenant administration: tenant creation, theme editor, `tenant → theme` storage | **each consuming application's repository** | **Yes** |

---

## 11. Reference

- Full Stack Project Catalog — Volume II (project 06 · DesignOps).
