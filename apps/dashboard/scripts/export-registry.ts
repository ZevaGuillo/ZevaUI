// D2: writes reports/{owner}/{repo}/{app}.json, exactly the declined
// repo-as-registry layout -- the zero-infra escape hatch stays one command
// away.
//
// This script is invoked directly via `tsx` (see package.json's
// `export:registry` script), which resolves extensionless local imports the
// same way Next/Vite do -- the same convention as the rest of the app.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../src/db/client";
import { allLatestReportsQuery } from "../src/db/queries";
import { isMainModule } from "../src/lib/is-main-module";
import { type ReportRow, toRegistryFileReport } from "../src/reports/serialize";

// The registry keys report identity on the PAIR (repository, app) -- see the
// view's DISTINCT ON in drizzle/0000_init.sql. The export path must carry the
// same pair: keyed on the app alone, two repositories reporting the same app
// label overwrite each other and one report is lost with no error raised.
// Both halves are consumer-supplied text, so each segment is checked too: a
// separator or parent-directory segment would otherwise let a report escape
// outDir once the ingestion path lands in PR3.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function assertSafeSegment(segment: string, field: string): void {
  if (segment === "." || segment === ".." || !SAFE_SEGMENT.test(segment)) {
    throw new Error(`[export:registry] unsafe ${field} segment: ${JSON.stringify(segment)}`);
  }
}

/** Path segments under outDir, identity-preserving. */
function identitySegments(row: ReportRow): string[] {
  // A slug must be exactly two segments. Checking the count says that rule out
  // loud; destructuring past the end and testing for undefined only *looks*
  // like it says it, and reads as dead code because the element type is string.
  const parts = row.repository.split("/");
  if (parts.length !== 2) {
    throw new Error(
      `[export:registry] repository must be "owner/name": ${JSON.stringify(row.repository)}`,
    );
  }
  const [owner, repo] = parts;
  assertSafeSegment(owner, "repository owner");
  assertSafeSegment(repo, "repository name");
  assertSafeSegment(row.appLabel, "app");
  return [owner, repo, `${row.appLabel}.json`];
}

export type ExportRegistryOptions = {
  readonly outDir: string;
  readonly listAllLatest?: () => Promise<ReportRow[]>;
};

/**
 * `listAllLatest` is injectable, so this is a pure unit under test.
 * @returns the file paths written
 */
export async function exportRegistry({
  outDir,
  listAllLatest = async () => allLatestReportsQuery(getDb()),
}: ExportRegistryOptions): Promise<string[]> {
  mkdirSync(outDir, { recursive: true });
  const rows = await listAllLatest();
  return rows.map((row) => {
    const filePath = path.join(outDir, ...identitySegments(row));
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(toRegistryFileReport(row), null, 2)}\n`);
    return filePath;
  });
}

if (isMainModule(import.meta.url, process.argv[1])) {
  const outDir = path.resolve(process.cwd(), "reports");
  exportRegistry({ outDir })
    .then((written) =>
      console.log(`[export:registry] wrote ${written.length} file(s) to ${outDir}`),
    )
    .catch((error: unknown) => {
      console.error(
        `[export:registry] FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
