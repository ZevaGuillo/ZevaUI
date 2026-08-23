// D4 query builders, injectable (callers pass `db`) so the SQL shape is
// unit-testable over a lazy `pg` Pool -- no live Postgres needed for tests.
import { and, asc, count, eq, gt } from "drizzle-orm";
import { reportLatest, submissions } from "./schema.js";

// GET /api/v1/reports -- all latest rows, stably ordered. Also the export
// script's data source.
/** @param {import("drizzle-orm/node-postgres").NodePgDatabase} db */
export function allLatestReportsQuery(db) {
  return db
    .select()
    .from(reportLatest)
    .orderBy(asc(reportLatest.repository), asc(reportLatest.appLabel));
}

// D4: GET /api/v1/reports/{owner}/{repo} -- one repository's latest rows,
// task 4.0 (deferred from PR2 -- the Panel is its first real consumer).
/** @param {import("drizzle-orm/node-postgres").NodePgDatabase} db @param {string} repository */
export function reportsForRepoQuery(db, repository) {
  return db
    .select()
    .from(reportLatest)
    .where(eq(reportLatest.repository, repository))
    .orderBy(asc(reportLatest.appLabel));
}

// RF-AR03 monotonicity gate: the stored latest generatedAt for one repo/app pair.
/** @param {import("drizzle-orm/node-postgres").NodePgDatabase} db @param {number} repositoryId @param {string} appLabel */
export function latestGeneratedAtQuery(db, repositoryId, appLabel) {
  return db
    .select({ generatedAt: reportLatest.generatedAt })
    .from(reportLatest)
    .where(and(eq(reportLatest.repositoryId, repositoryId), eq(reportLatest.appLabel, appLabel)));
}

// D4 rate limit gate: submissions for one repo within the rolling window.
// Counts the append-only log directly -- no separate counter state to drift.
/** @param {import("drizzle-orm/node-postgres").NodePgDatabase} db @param {number} repositoryId @param {Date} since */
export function recentSubmissionCountQuery(db, repositoryId, since) {
  return db
    .select({ value: count() })
    .from(submissions)
    .where(and(eq(submissions.repositoryId, repositoryId), gt(submissions.receivedAt, since)));
}

// D3 append-only insert -- never UPDATE/DELETE.
/** @param {import("drizzle-orm/node-postgres").NodePgDatabase} db @param {import("./schema.js").NewSubmission} values */
export function insertSubmissionQuery(db, values) {
  return db.insert(submissions).values(values);
}
