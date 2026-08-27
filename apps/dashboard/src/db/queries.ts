// D4 query builders, injectable (callers pass `db`) so the SQL shape is
// unit-testable over a lazy `pg` Pool -- no live Postgres needed for tests.
import { and, asc, count, eq, gt, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NewSubmission } from "./schema";
import { oidcJti, reportLatest, submissions } from "./schema";

// GET /api/v1/reports -- all latest rows, stably ordered. Also the export
// script's data source.
export function allLatestReportsQuery(db: NodePgDatabase) {
  return db
    .select()
    .from(reportLatest)
    .orderBy(asc(reportLatest.repository), asc(reportLatest.appLabel));
}

// D4: GET /api/v1/reports/{owner}/{repo} -- one repository's latest rows,
// task 4.0 (deferred from PR2 -- the Panel is its first real consumer).
export function reportsForRepoQuery(db: NodePgDatabase, repository: string) {
  return db
    .select()
    .from(reportLatest)
    .where(eq(reportLatest.repository, repository))
    .orderBy(asc(reportLatest.appLabel));
}

// RF-AR03 monotonicity gate: the stored latest generatedAt for one repo/app pair.
export function latestGeneratedAtQuery(db: NodePgDatabase, repositoryId: number, appLabel: string) {
  return db
    .select({ generatedAt: reportLatest.generatedAt })
    .from(reportLatest)
    .where(and(eq(reportLatest.repositoryId, repositoryId), eq(reportLatest.appLabel, appLabel)));
}

// D4 rate limit gate: submissions for one repo within the rolling window.
// Counts the append-only log directly -- no separate counter state to drift.
export function recentSubmissionCountQuery(db: NodePgDatabase, repositoryId: number, since: Date) {
  return db
    .select({ value: count() })
    .from(submissions)
    .where(and(eq(submissions.repositoryId, repositoryId), gt(submissions.receivedAt, since)));
}

// D3 append-only insert -- never UPDATE/DELETE.
export function insertSubmissionQuery(db: NodePgDatabase, values: NewSubmission) {
  return db.insert(submissions).values(values);
}

// D1 replay-guard upkeep: drop jti rows no verifier can accept anymore. The
// append-only rule (D3) covers `submissions`; `oidc_jti` was always designed
// to be pruned by its own `expires_at`. Callers pass a cutoff already backed
// off by the verifier's clock skew, so a jti is only deleted once its token
// would be rejected as expired anyway.
export function pruneExpiredJtiQuery(db: NodePgDatabase, cutoff: Date) {
  return db.delete(oidcJti).where(lt(oidcJti.expiresAt, cutoff));
}
