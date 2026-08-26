import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MIGRATIONS_TABLE, migrate, type SqlExecutor } from "../scripts/migrate";

let sqlDir = "";
afterEach(() => rmSync(sqlDir, { recursive: true, force: true }));

function makeSqlDir(files: Readonly<Record<string, string>>): string {
  sqlDir = mkdtempSync(path.join(tmpdir(), "zevaui-dashboard-migrate-"));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(path.join(sqlDir, name), body);
  }
  return sqlDir;
}

type AppliedRow = { readonly id: string; readonly checksum: string };

/**
 * Records every statement the runner issues, so the transaction envelope and
 * the bookkeeping writes are assertable without a live database. `applied`
 * seeds the rows `schema_migrations` already holds; `failOn` makes one
 * statement throw, the way a bad migration would.
 */
function fakeExecutor(options: { applied?: readonly AppliedRow[]; failOn?: string } = {}) {
  const log: string[] = [];
  const recorded: AppliedRow[] = [...(options.applied ?? [])];
  const executor: SqlExecutor = {
    async query(text, values) {
      log.push(text);
      if (options.failOn !== undefined && text.includes(options.failOn)) {
        throw new Error(`syntax error at or near "${options.failOn}"`);
      }
      if (text.includes(`SELECT id, checksum FROM ${MIGRATIONS_TABLE}`)) {
        return { rows: recorded };
      }
      if (text.includes(`INSERT INTO ${MIGRATIONS_TABLE}`)) {
        recorded.push({ id: String(values?.[0]), checksum: String(values?.[1]) });
      }
      return { rows: [] };
    },
  };
  return { executor, log, recorded };
}

describe("migrate (versioned, idempotent, no live DB)", () => {
  it("applies every pending migration in lexicographic order and records each one", async () => {
    // Written out of order on purpose: the runner must not inherit whatever
    // order the filesystem happens to hand back from readdir.
    const dir = makeSqlDir({
      "0002_third.sql": "CREATE TABLE third ();",
      "0000_first.sql": "CREATE TABLE first ();",
      "0001_second.sql": "CREATE TABLE second ();",
    });
    const { executor, recorded } = fakeExecutor();

    const result = await migrate({ sqlDir: dir, executor });

    expect(result.applied).toEqual(["0000_first.sql", "0001_second.sql", "0002_third.sql"]);
    expect(result.skipped).toEqual([]);
    expect(recorded.map((row) => row.id)).toEqual([
      "0000_first.sql",
      "0001_second.sql",
      "0002_third.sql",
    ]);
  });

  it("ignores non-.sql files sitting in the migrations directory", async () => {
    const dir = makeSqlDir({
      "0000_first.sql": "CREATE TABLE first ();",
      "README.md": "not a migration",
    });
    const { executor } = fakeExecutor();

    const result = await migrate({ sqlDir: dir, executor });

    expect(result.applied).toEqual(["0000_first.sql"]);
  });

  it("is idempotent: a second run over the same directory applies nothing", async () => {
    const dir = makeSqlDir({ "0000_first.sql": "CREATE TABLE first ();" });
    const { executor, recorded } = fakeExecutor();

    await migrate({ sqlDir: dir, executor });
    const second = await migrate({ sqlDir: dir, executor });

    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["0000_first.sql"]);
    expect(recorded).toHaveLength(1);
  });

  it("applies only the pending migrations when earlier ones are already recorded", async () => {
    const dir = makeSqlDir({
      "0000_first.sql": "CREATE TABLE first ();",
      "0001_second.sql": "CREATE TABLE second ();",
    });
    const { executor, log } = fakeExecutor({
      applied: [{ id: "0000_first.sql", checksum: sha256("CREATE TABLE first ();") }],
    });

    const result = await migrate({ sqlDir: dir, executor });

    expect(result.applied).toEqual(["0001_second.sql"]);
    expect(result.skipped).toEqual(["0000_first.sql"]);
    expect(log).not.toContain("CREATE TABLE first ();");
    expect(log).toContain("CREATE TABLE second ();");
  });

  // Constitution principle 5: "versiones inmutables". An applied migration is
  // published history; rewriting its bytes desynchronizes every database that
  // already ran the old text, and no later migration can detect that drift.
  it("refuses to run when an already-applied migration's bytes changed", async () => {
    const dir = makeSqlDir({ "0000_first.sql": "CREATE TABLE rewritten ();" });
    const { executor } = fakeExecutor({
      applied: [{ id: "0000_first.sql", checksum: sha256("CREATE TABLE first ();") }],
    });

    await expect(migrate({ sqlDir: dir, executor })).rejects.toThrow(/0000_first\.sql/);
  });

  it("refuses to run when an already-applied migration file is gone", async () => {
    const dir = makeSqlDir({ "0001_second.sql": "CREATE TABLE second ();" });
    const { executor } = fakeExecutor({
      applied: [{ id: "0000_first.sql", checksum: sha256("CREATE TABLE first ();") }],
    });

    await expect(migrate({ sqlDir: dir, executor })).rejects.toThrow(/0000_first\.sql/);
  });

  it("wraps each migration and its bookkeeping row in one transaction", async () => {
    const dir = makeSqlDir({ "0000_first.sql": "CREATE TABLE first ();" });
    const { executor, log } = fakeExecutor();

    await migrate({ sqlDir: dir, executor });

    const begin = log.indexOf("BEGIN");
    const body = log.indexOf("CREATE TABLE first ();");
    const insert = log.findIndex((text) => text.includes(`INSERT INTO ${MIGRATIONS_TABLE}`));
    const commit = log.indexOf("COMMIT");
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(body).toBeGreaterThan(begin);
    expect(insert).toBeGreaterThan(body);
    expect(commit).toBeGreaterThan(insert);
    expect(log).not.toContain("ROLLBACK");
  });

  it("rolls back and stops at the first migration that fails", async () => {
    const dir = makeSqlDir({
      "0000_first.sql": "CREATE TABLE first ();",
      "0001_broken.sql": "CREATE TABL broken ();",
      "0002_third.sql": "CREATE TABLE third ();",
    });
    const { executor, log, recorded } = fakeExecutor({ failOn: "CREATE TABL broken" });

    await expect(migrate({ sqlDir: dir, executor })).rejects.toThrow(/0001_broken\.sql/);

    expect(log).toContain("ROLLBACK");
    // The failure is terminal: a later migration must never run over a schema
    // its own predecessor failed to establish.
    expect(log).not.toContain("CREATE TABLE third ();");
    expect(recorded.map((row) => row.id)).toEqual(["0000_first.sql"]);
  });

  it("serializes concurrent runners with a session advisory lock, released at the end", async () => {
    const dir = makeSqlDir({ "0000_first.sql": "CREATE TABLE first ();" });
    const { executor, log } = fakeExecutor();

    await migrate({ sqlDir: dir, executor });

    const lock = log.findIndex((text) => text.includes("pg_advisory_lock"));
    const unlock = log.findIndex((text) => text.includes("pg_advisory_unlock"));
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(unlock).toBeGreaterThan(lock);
  });

  it("releases the advisory lock even when a migration fails", async () => {
    const dir = makeSqlDir({ "0000_broken.sql": "CREATE TABL broken ();" });
    const { executor, log } = fakeExecutor({ failOn: "CREATE TABL broken" });

    await expect(migrate({ sqlDir: dir, executor })).rejects.toThrow();

    expect(log.some((text) => text.includes("pg_advisory_unlock"))).toBe(true);
  });

  it("creates the bookkeeping table before reading it, so a fresh database works", async () => {
    const dir = makeSqlDir({ "0000_first.sql": "CREATE TABLE first ();" });
    const { executor, log } = fakeExecutor();

    await migrate({ sqlDir: dir, executor });

    const create = log.findIndex((text) =>
      text.includes(`CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE}`),
    );
    const read = log.findIndex((text) =>
      text.includes(`SELECT id, checksum FROM ${MIGRATIONS_TABLE}`),
    );
    expect(create).toBeGreaterThanOrEqual(0);
    expect(read).toBeGreaterThan(create);
  });
});

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
