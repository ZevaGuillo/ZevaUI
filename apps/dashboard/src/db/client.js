// D2: standard `pg` driver only -- no provider-coupled client. The pool is
// lazy and connects only on first query, so importing this is network-free.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/** @type {import("drizzle-orm/node-postgres").NodePgDatabase | undefined} */
let db;

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    db = drizzle(new Pool({ connectionString: url }));
  }
  return db;
}
