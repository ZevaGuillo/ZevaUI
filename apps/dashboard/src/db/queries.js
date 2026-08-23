// D4 query builders, injectable (callers pass `db`) so the SQL shape is
// unit-testable over a lazy `pg` Pool -- no live Postgres needed for tests.
import { asc } from "drizzle-orm";
import { reportLatest } from "./schema.js";

// GET /api/v1/reports -- all latest rows, stably ordered. Also the export
// script's data source.
/** @param {import("drizzle-orm/node-postgres").NodePgDatabase} db */
export function allLatestReportsQuery(db) {
  return db
    .select()
    .from(reportLatest)
    .orderBy(asc(reportLatest.repository), asc(reportLatest.appLabel));
}
