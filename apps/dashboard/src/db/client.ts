// D2: standard `pg` driver only -- no provider-coupled client. The pool is
// lazy and connects only on first query, so importing this is network-free.
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let db: NodePgDatabase | undefined;

export function getDb(): NodePgDatabase {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = drizzle(new Pool({ connectionString: url }));
  }
  return db;
}
