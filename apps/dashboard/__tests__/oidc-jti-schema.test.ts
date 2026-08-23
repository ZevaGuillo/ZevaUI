import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTableColumns, getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { oidcJti } from "../src/db/schema.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(path.join(dirname, "..", "drizzle", "0001_oidc_jti.sql"), "utf8");

// D1: replay guard, PR2's deferred `oidc_jti` table -- unique on `jti`,
// pruned by its own `expires_at`. Its only reader/writer is the OIDC
// verification code (task 3.1/3.2), landing in this same PR.
describe("oidc_jti table (D1 replay guard)", () => {
  it("has a jti primary key and an expires_at column", () => {
    expect(getTableName(oidcJti)).toBe("oidc_jti");
    expect(Object.keys(getTableColumns(oidcJti))).toEqual(["jti", "expiresAt"]);
  });

  it("0001_oidc_jti.sql creates the table with jti as primary key", () => {
    expect(migrationSql).toMatch(/CREATE TABLE oidc_jti/i);
    expect(migrationSql).toMatch(/jti\s+text\s+PRIMARY KEY/i);
    expect(migrationSql).toMatch(/expires_at\s+timestamptz\s+NOT NULL/i);
  });
});
