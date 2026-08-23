// D2: writes reports/{owner}/{repo}/{app}.json, exactly the declined
// repo-as-registry layout -- the zero-infra escape hatch stays one command
// away.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getDb } from "../src/db/client.js";
import { allLatestReportsQuery } from "../src/db/queries.js";
import { toRegistryFileReport } from "../src/reports/serialize.js";

// The registry keys report identity on the PAIR (repository, app) -- see the
// view's DISTINCT ON in drizzle/0000_init.sql. The export path must carry the
// same pair: keyed on the app alone, two repositories reporting the same app
// label overwrite each other and one report is lost with no error raised.
// Both halves are consumer-supplied text, so each segment is checked too: a
// separator or parent-directory segment would otherwise let a report escape
// outDir once the ingestion path lands in PR3.
const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * @param {string} segment
 * @param {string} field
 */
function assertSafeSegment(segment, field) {
  if (segment === "." || segment === ".." || !SAFE_SEGMENT.test(segment)) {
    throw new Error(`[export:registry] unsafe ${field} segment: ${JSON.stringify(segment)}`);
  }
}

/**
 * @param {import("../src/reports/serialize.js").ReportRow} row
 * @returns {string[]} path segments under outDir, identity-preserving
 */
function identitySegments(row) {
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

/**
 * `listAllLatest` is injectable, so this is a pure unit under test.
 * @param {{ outDir: string, listAllLatest?: () => Promise<import("../src/reports/serialize.js").ReportRow[]> }} options
 * @returns {Promise<string[]>} the file paths written
 */
export async function exportRegistry({
  outDir,
  listAllLatest = () => allLatestReportsQuery(getDb()),
}) {
  mkdirSync(outDir, { recursive: true });
  const rows = await listAllLatest();
  return rows.map((row) => {
    const filePath = path.join(outDir, ...identitySegments(row));
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(toRegistryFileReport(row), null, 2)}\n`);
    return filePath;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = path.resolve(process.cwd(), "reports");
  exportRegistry({ outDir })
    .then((written) =>
      console.log(`[export:registry] wrote ${written.length} file(s) to ${outDir}`),
    )
    .catch((error) => {
      console.error(`[export:registry] FAILED: ${error.message}`);
      process.exitCode = 1;
    });
}
