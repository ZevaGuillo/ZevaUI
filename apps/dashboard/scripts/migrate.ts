// D2: standard Postgres protocol only -- plain `pg`, no provider SDK. The
// migrations are hand-written SQL (drizzle/*.sql) with no drizzle-kit journal,
// so `drizzle-kit migrate` cannot drive them; this runner is what applies them.
//
// Invoked via `tsx` (package.json's `db:migrate`), which resolves extensionless
// local imports the same way Next/Vite do -- the convention the rest of
// `apps/dashboard` follows.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { isMainModule } from "../src/lib/is-main-module";

export const MIGRATIONS_TABLE = "schema_migrations";

// Fixed by contract: two runners serialize only if they pick the SAME key, so
// this constant must never be derived from anything environment-dependent.
const ADVISORY_LOCK_KEY = 4023986437;

/** The narrow slice of `pg.Client` this runner needs, so tests need no database. */
export type SqlExecutor = {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: readonly unknown[] }>;
};

export type MigrateOptions = {
  readonly sqlDir: string;
  readonly executor: SqlExecutor;
};

export type MigrateResult = {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
};

type Migration = { readonly id: string; readonly body: string };
type AppliedRow = { readonly id: string; readonly checksum: string };

function checksum(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

function readMigrations(sqlDir: string): Migration[] {
  return (
    readdirSync(sqlDir)
      .filter((name) => name.endsWith(".sql"))
      // Explicit byte comparator, not a bare `.sort()` and not `localeCompare`:
      // migration order is a correctness contract, and `localeCompare` resolves
      // against the host locale, so it is not the same order everywhere.
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .map((id) => ({ id, body: readFileSync(path.join(sqlDir, id), "utf8") }))
  );
}

function toAppliedRow(row: unknown): AppliedRow {
  const candidate = row as Partial<AppliedRow>;
  if (typeof candidate?.id !== "string" || typeof candidate?.checksum !== "string") {
    throw new Error(`[db:migrate] unreadable ${MIGRATIONS_TABLE} row: ${JSON.stringify(row)}`);
  }
  return { id: candidate.id, checksum: candidate.checksum };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Constitution principle 5, "versiones inmutables": an applied migration is
 * published history. If its bytes change, every database that already ran the
 * old text silently diverges and no later migration can detect the drift, so
 * the only safe move is to stop before touching anything.
 */
function assertHistoryIntact(applied: readonly AppliedRow[], present: readonly Migration[]): void {
  for (const row of applied) {
    const migration = present.find((candidate) => candidate.id === row.id);
    if (!migration) {
      throw new Error(
        `[db:migrate] ${row.id} was applied to this database but is missing from disk. ` +
          "An applied migration is immutable -- restore the file instead of deleting it.",
      );
    }
    if (checksum(migration.body) !== row.checksum) {
      throw new Error(
        `[db:migrate] ${row.id} changed after it was applied to this database. ` +
          "An applied migration is immutable -- add a new migration instead of editing it.",
      );
    }
  }
}

async function applyOne(executor: SqlExecutor, migration: Migration): Promise<void> {
  await executor.query("BEGIN");
  try {
    await executor.query(migration.body);
    await executor.query(`INSERT INTO ${MIGRATIONS_TABLE} (id, checksum) VALUES ($1, $2)`, [
      migration.id,
      checksum(migration.body),
    ]);
    await executor.query("COMMIT");
  } catch (error: unknown) {
    await executor.query("ROLLBACK");
    // Terminal by design: a later migration must never run over a schema its
    // own predecessor failed to establish.
    throw new Error(`[db:migrate] ${migration.id} failed: ${message(error)}`, { cause: error });
  }
}

/**
 * Applies every `.sql` file in `sqlDir` that this database has not run yet,
 * in lexicographic order, recording each one in `schema_migrations`.
 * Idempotent: re-running applies nothing.
 */
export async function migrate({ sqlDir, executor }: MigrateOptions): Promise<MigrateResult> {
  // Lock first: two runners racing on `CREATE TABLE IF NOT EXISTS` can still
  // collide on the underlying catalog insert.
  await executor.query(`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`);
  try {
    await executor.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
        id text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )`,
    );

    const present = readMigrations(sqlDir);
    const { rows } = await executor.query(`SELECT id, checksum FROM ${MIGRATIONS_TABLE}`);
    const alreadyApplied = rows.map(toAppliedRow);
    assertHistoryIntact(alreadyApplied, present);

    const appliedIds = new Set(alreadyApplied.map((row) => row.id));
    const applied: string[] = [];
    const skipped: string[] = [];
    for (const migration of present) {
      if (appliedIds.has(migration.id)) {
        skipped.push(migration.id);
        continue;
      }
      await applyOne(executor, migration);
      applied.push(migration.id);
    }
    return { applied, skipped };
  } finally {
    await executor.query(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`);
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const sqlDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
  // A dedicated Client, not a Pool: the advisory lock is session-scoped, so it
  // only serializes anything if every statement rides the same connection.
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const executor: SqlExecutor = {
      query: (text, values) => client.query(text, values ? [...values] : undefined),
    };
    const { applied, skipped } = await migrate({ sqlDir, executor });
    console.log(
      `[db:migrate] applied ${applied.length} migration(s)` +
        `${applied.length > 0 ? `: ${applied.join(", ")}` : ""}` +
        `, skipped ${skipped.length} already applied`,
    );
  } finally {
    await client.end();
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(`[db:migrate] FAILED: ${message(error)}`);
    process.exitCode = 1;
  });
}
