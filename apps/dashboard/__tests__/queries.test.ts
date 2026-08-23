import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  allLatestReportsQuery,
  latestGeneratedAtQuery,
  recentSubmissionCountQuery,
  reportsForRepoQuery,
} from "../src/db/queries.js";

// A lazy `pg` Pool never connects until a query runs -- proves the real SQL shape, no live DB.
const db = drizzle(new Pool({ connectionString: "postgres://unused/unused" }));

describe("allLatestReportsQuery (D4: GET /api/v1/reports)", () => {
  it("selects from report_latest, ordered by repository then app label", () => {
    const { sql, params } = allLatestReportsQuery(db).toSQL();
    expect(sql).toContain('from "report_latest"');
    expect(sql).toContain(
      'order by "report_latest"."repository" asc, "report_latest"."app_label" asc',
    );
    expect(params).toEqual([]);
  });
});

describe("latestGeneratedAtQuery (RF-AR03 monotonicity)", () => {
  it("selects generated_at from report_latest filtered by repository and app", () => {
    const { sql, params } = latestGeneratedAtQuery(db, 123, "web").toSQL();
    expect(sql).toContain('select "generated_at" from "report_latest"');
    expect(sql).toContain('"report_latest"."repository_id" = $1');
    expect(sql).toContain('"report_latest"."app_label" = $2');
    expect(params).toEqual([123, "web"]);
  });
});

describe("reportsForRepoQuery (D4: GET /api/v1/reports/{owner}/{repo}, task 4.0)", () => {
  it("selects from report_latest filtered by repository, ordered by app label", () => {
    const { sql, params } = reportsForRepoQuery(db, "acme/web").toSQL();
    expect(sql).toContain('from "report_latest"');
    expect(sql).toContain('"report_latest"."repository" = $1');
    expect(sql).toContain('order by "report_latest"."app_label" asc');
    expect(params).toEqual(["acme/web"]);
  });
});

describe("recentSubmissionCountQuery (D4 rate limit)", () => {
  it("counts submissions for a repository since a timestamp", () => {
    const since = new Date("2026-01-01T00:00:00.000Z");
    const { sql, params } = recentSubmissionCountQuery(db, 123, since).toSQL();
    expect(sql).toContain('from "submissions"');
    expect(sql).toContain('"submissions"."repository_id" = $1');
    expect(sql).toContain('"submissions"."received_at" > $2');
    expect(params).toEqual([123, since.toISOString()]);
  });
});
