import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { allLatestReportsQuery } from "../src/db/queries.js";

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
