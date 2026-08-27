# Dashboard: the adoption registry and its Panel

This app is the write-and-read half of the usage audit (ADR-0011): consumers'
CI submits usage reports here, and the Panel renders what the registry knows.
It is a Next.js app deployed on Vercel, backed by Postgres (Neon) through
drizzle.

The one thing to know before touching anything here: **the ingest pipeline is
fail-closed and every gate in it was measured against a real consumer.** The
order of gates, the missing `permissions:` block in the reusable workflow, and
the append-only storage are all decisions with a paper trail in ADR-0011 — 
read the design section there before "simplifying" any of them.

## Surface

| Route | What it is |
|-------|------------|
| `GET /api/v1/reports` | Public. Latest report per repository/app, from the `report_latest` view. |
| `GET /api/v1/reports/{owner}/{repo}` | Public. One repository's apps. |
| `POST /api/v1/reports` | OIDC-authenticated ingestion. GitHub Actions only. |
| `/` | The Panel: adoption per repository, versions, components. |
| `/deprecated` | Deprecated components still in use across consumers. |
| `/releases` | Release log, built from committed `packages/*/CHANGELOG.md` at build time — never a runtime GitHub API call. |

## The ingest pipeline (POST)

Gates run in this order, each measured to fail closed: declared
`Content-Length` cap before buffering, content-type, size backstop, JSON
parse, report schema, bearer token → OIDC verification (RS256 against
GitHub's JWKS, issuer/audience/expiry with 60 s skew, `jti` replay guard),
identity binding against `REGISTRY_ALLOWED_OWNERS`, rate limit
(60/repo/hour, counted from the append-only log), `generatedAt`
monotonicity, and finally an append-only insert — never UPDATE or DELETE on
`submissions`.

`registry-tenant-denylist.json` in this directory is not an ingest gate: it
feeds the RF-AR08 hygiene scan that keeps concrete tenant identifiers out of
`packages/*`. Extend its `names` as real consumers onboard.

The `oidc_jti` replay table prunes itself: every authenticated submission
deletes rows expired beyond the verifier's own skew window before recording
its `jti`, so its steady-state size is one traffic window and no cron owns it.

## Working locally

```bash
pnpm dev            # needs DATABASE_URL in .env.local
pnpm test           # unit suite; no live database required
pnpm db:migrate:local
pnpm export:registry
```

The unit tests never open a connection: query builders are asserted by SQL
shape over a lazy `pg` Pool, and the pipeline takes its DB operations as
injected dependencies. If a test you are writing needs a live database,
first check whether it is really testing this app or testing drizzle.

## Environment

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres connection string. |
| `REGISTRY_OIDC_AUDIENCE` | Expected `aud` claim of submitted tokens. |
| `REGISTRY_ALLOWED_OWNERS` | Comma-separated repository owners allowed to submit. |

Changing an environment variable in Vercel does **not** apply to the existing
deployment — redeploy after editing, or the old value keeps serving. This was
measured the hard way (a 403 that survived three "fixes"); see ADR-0011's
milestone log.
