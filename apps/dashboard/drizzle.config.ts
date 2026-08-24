import { defineConfig } from "drizzle-kit";

// D2: standard Postgres protocol only -- hand-written plain SQL migrations.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://placeholder/placeholder" },
});
