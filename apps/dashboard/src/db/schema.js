// D3: append-only submissions + a report_latest view (never destructive
// upsert). deprecated_components: NULL = unknown, {} = known-none. View DDL
// is in drizzle/0000_init.sql (D2, plain SQL); columns are declared once
// here and shared with the view, so both are typed identically.
import {
  bigint,
  bigserial,
  index,
  jsonb,
  pgTable,
  pgView,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const reportColumns = {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
  repository: text("repository").notNull(),
  appLabel: text("app_label").notNull(),
  dsVersion: text("ds_version").notNull(),
  dsVersionSource: text("ds_version_source").notNull(),
  components: text("components").array().notNull(),
  deprecatedComponents: text("deprecated_components").array(),
  schemaVersion: smallint("schema_version").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
};

export const submissions = pgTable(
  "submissions",
  { ...reportColumns, payload: jsonb("payload").notNull() },
  (table) => [
    index("submissions_repo_app_generated_idx").on(
      table.repositoryId,
      table.appLabel,
      table.generatedAt,
    ),
  ],
);

export const reportLatest = pgView("report_latest", reportColumns).existing();
