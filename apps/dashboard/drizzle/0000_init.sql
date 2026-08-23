-- D3: append-only. No UPDATE/DELETE path -- the write log is the audit trail.
CREATE TABLE submissions (
  id bigserial PRIMARY KEY,
  repository_id bigint NOT NULL,
  repository text NOT NULL,
  app_label text NOT NULL,
  ds_version text NOT NULL,
  ds_version_source text NOT NULL CHECK (ds_version_source IN ('installed', 'declared')),
  components text[] NOT NULL,
  deprecated_components text[],
  schema_version smallint NOT NULL,
  generated_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL
);
CREATE INDEX submissions_repo_app_generated_idx ON submissions (repository_id, app_label, generated_at DESC);

-- Read-time "upsert" (D1's oidc_jti replay-guard table lands in PR3).
CREATE VIEW report_latest AS
  SELECT DISTINCT ON (repository_id, app_label) id, repository_id, repository, app_label,
    ds_version, ds_version_source, components, deprecated_components, schema_version,
    generated_at, received_at
  FROM submissions ORDER BY repository_id, app_label, generated_at DESC;
