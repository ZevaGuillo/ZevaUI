// The consumer-tree walk (design #156, D10), split out of audit-usage.js so
// its central promise can actually be proven: EVERY file this walk fails to
// read is named in `skipped`.
//
// It used to make that promise in a comment and break it in two places — a
// symlinked entry and an unreadable directory were both dropped with a bare
// `continue`, so the step summary's "skipped files" count stayed at 0 while
// real usage vanished from the report. That is the same failure this whole
// package exists to prevent: a silent under-count that looks like a clean
// audit. It was invisible because the walk lived inside a runnable entry with
// no seam to test through.
//
// Hence the `io` parameter. It is not indirection for its own sake: neither
// skip path can be produced portably — Windows refuses `symlinkSync` with
// EPERM without elevation, and an unreadable directory has no portable recipe
// at all — so without a seam the two paths that lied would stay untested on
// the machines this repo is developed on.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { scanSource } from "./scan-source.js";

// The directory the reusable workflow checks THIS design system out into,
// inside the consumer's own workspace. The name is a contract between
// `.github/workflows/audit-ds-usage.yml` and this list, and it is load-bearing
// in both directions: change it in one place and a consumer scanning with
// working-directory "." walks straight into the DS checkout and reports our
// storybook's imports as theirs. Measured before it was pruned — a consumer
// using only Button got back Alert, Button, Dialog.
export const WORKFLOW_DS_CHECKOUT_DIR = ".zevaui-audit";

const PRUNED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "build",
  "out",
  "coverage",
  ".turbo",
  "storybook-static",
  WORKFLOW_DS_CHECKOUT_DIR,
]);
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

export const MAX_FILE_BYTES = 1 * 1024 * 1024;
export const MAX_SCANNED_FILES = 20000;

/**
 * The slice of the filesystem this walk uses, declared structurally rather
 * than inferred from `node:fs`. Inferring it would drag in PathLike and the
 * readFileSync overloads, and no hand-written fake could ever satisfy those —
 * which would put the seam back out of reach of a test.
 *
 * @typedef {object} SourceTreeIo
 * @property {(dir: string, options: { withFileTypes: true }) => Array<{
 *   name: string,
 *   isSymbolicLink(): boolean,
 *   isDirectory(): boolean,
 *   isFile(): boolean,
 * }>} readdirSync
 * @property {(filePath: string) => { size: number }} statSync
 * @property {(filePath: string, encoding: "utf8") => string} readFileSync
 */

/** @type {SourceTreeIo} */
const nodeIo = { readdirSync, statSync, readFileSync };

/**
 * Walks `consumerRoot` and scans every allowlisted source file.
 *
 * Returns `{ imports, skipped, overflowed }`.
 *
 * `skipped` names everything the walk could NOT read: symlinks (never
 * followed), unreadable directories, non-file entries, files over the size
 * cap, and files that threw on read. It deliberately does NOT name pruned
 * directories or non-allowlisted extensions — those are documented, stable
 * exclusions, and counting them would drown the one signal this array
 * carries: something was there and we could not look at it.
 *
 * `overflowed` is returned rather than exiting, so the caller owns the
 * failure message and this module stays testable.
 *
 * @param {string} consumerRoot
 * @param {SourceTreeIo} [io]
 */
export function walkAndScan(consumerRoot, io = nodeIo) {
  const imports = [];
  const skipped = [];
  let scannedCount = 0;
  let overflowed = false;
  const stack = [consumerRoot];

  while (stack.length > 0 && !overflowed) {
    const dir = stack.pop();
    let entries;
    try {
      entries = io.readdirSync(dir, { withFileTypes: true });
    } catch {
      // An unreadable directory is an unscanned subtree, not a non-existent
      // one. The root itself relativises to "", so name it explicitly.
      skipped.push(path.relative(consumerRoot, dir) || ".");
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(consumerRoot, fullPath);

      // Checked before isDirectory(): a symlinked directory is an unscanned
      // subtree and has to be named, not quietly stepped over.
      if (entry.isSymbolicLink()) {
        skipped.push(relativePath);
        continue;
      }
      if (entry.isDirectory()) {
        if (!PRUNED_DIRS.has(entry.name)) stack.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        skipped.push(relativePath);
        continue;
      }
      if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name))) continue;

      scannedCount += 1;
      if (scannedCount > MAX_SCANNED_FILES) {
        overflowed = true;
        break;
      }

      try {
        if (io.statSync(fullPath).size > MAX_FILE_BYTES) {
          skipped.push(relativePath);
          continue;
        }
        imports.push(...scanSource(io.readFileSync(fullPath, "utf8")));
      } catch {
        skipped.push(relativePath);
      }
    }
  }

  return { imports, skipped, overflowed };
}
