import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig, getViewConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { reportLatest, submissions } from "../src/db/schema.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(path.join(dirname, "..", "drizzle", "0000_init.sql"), "utf8");

describe("submissions table and report_latest view (D3)", () => {
  it("has the append-only column shape, indexed, with an existing (not drizzle-managed) view", () => {
    expect(getTableName(submissions)).toBe("submissions");
    expect(Object.keys(getTableColumns(submissions))).toEqual([
      "id",
      "repositoryId",
      "repository",
      "appLabel",
      "dsVersion",
      "dsVersionSource",
      "components",
      "deprecatedComponents",
      "schemaVersion",
      "generatedAt",
      "receivedAt",
      "payload",
    ]);
    const indexNames = getTableConfig(submissions).indexes.map((index) => index.config.name);
    expect(indexNames).toContain("submissions_repo_app_generated_idx");

    const viewConfig = getViewConfig(reportLatest);
    expect(viewConfig.name).toBe("report_latest");
    expect(viewConfig.isExisting).toBe(true);
  });

  it("0000_init.sql is append-only, creates report_latest via DISTINCT ON, checks ds_version_source", () => {
    expect(migrationSql).not.toMatch(/\bUPDATE\s+submissions\b/i);
    expect(migrationSql).not.toMatch(/\bDELETE\s+FROM\s+submissions\b/i);
    expect(migrationSql).toMatch(/DISTINCT ON \(repository_id, app_label\)/i);
    expect(migrationSql).toMatch(
      /ds_version_source[\s\S]*CHECK[\s\S]*'installed'[\s\S]*'declared'/i,
    );
  });
});
