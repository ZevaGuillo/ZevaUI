-- D1: OIDC JWT replay guard. One row per seen `jti`; a row is safe to prune
-- once its own `expires_at` has passed (the token itself is no longer valid).
CREATE TABLE oidc_jti (
  jti text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
