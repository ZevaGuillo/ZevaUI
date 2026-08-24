// RF-AR07 / ADR-0009 D2: the scanner (audit-usage.js and everything it
// transitively imports) MUST make no outbound network call. Only the
// separate, opt-in submit-report.js (Phase 5) is allowed to reach the
// network, and it is never imported by the scan path — that separation is
// what this test locks in, not just today's absence of a `fetch()` call.
//
// This is a source scan, not an AST parse: the whole package is deliberately
// dependency-free (no ts-morph/acorn), so the same "regex over sanitized-ish
// text" trade the scanner itself makes (scan-source.js) is made here too. The
// closure walk only follows RELATIVE specifiers, so a node: built-in never
// widens the set of files read — it only ever narrows what gets asserted
// against, which is the property this gate exists to prove.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const entryFile = path.join(dirname, "..", "scripts", "audit-usage.js");

// Forbidden specifiers, both bare and `node:`-prefixed: RF-AR07 names
// node:http(s), net, and dns explicitly. `fetch` is checked separately below
// (it is a global, not a specifier).
const FORBIDDEN_SPECIFIERS = new Set([
  "http",
  "node:http",
  "https",
  "node:https",
  "net",
  "node:net",
  "dns",
  "node:dns",
]);

const FETCH_CALL = /\bfetch\s*\(/;

/**
 * Every import/require specifier a file references — relative or not. RF-AR07
 * cares about ALL of them, not only the ones this closure walk follows.
 */
function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  const importFrom = /\bfrom\s+["']([^"']+)["']/g;
  const requireCall = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
  for (const pattern of [importFrom, requireCall]) {
    let match = pattern.exec(source);
    while (match) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }
  return specifiers;
}

/**
 * Walks the RELATIVE import closure starting at `entry`. Non-relative
 * specifiers (bare packages, `node:` built-ins) end the walk at that edge —
 * this is the scanner's OWN module graph, not everything it depends on.
 *
 * @returns absolute file path -> source text
 */
function collectTransitiveModules(entry: string): Map<string, string> {
  const files = new Map<string, string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || files.has(file)) continue;
    const source = readFileSync(file, "utf8");
    files.set(file, source);
    for (const specifier of extractSpecifiers(source)) {
      if (!specifier.startsWith(".")) continue;
      const resolved = path.resolve(path.dirname(file), specifier);
      if (!files.has(resolved)) queue.push(resolved);
    }
  }
  return files;
}

describe("audit-usage.js and its transitive imports stay network-free (RF-AR07, ADR-0009 D2)", () => {
  const modules = collectTransitiveModules(entryFile);
  const entries = [...modules.entries()];

  it("the closure reaches more than the entry file, so this gate is exercising something real", () => {
    expect(modules.size).toBeGreaterThan(1);
  });

  it.each(entries)("%s references no forbidden network specifier", (file: string, source: string) => {
    const found = extractSpecifiers(source).filter((specifier) =>
      FORBIDDEN_SPECIFIERS.has(specifier),
    );
    expect(found, `${path.basename(file)} imports: ${found.join(", ")}`).toEqual([]);
  });

  it.each(entries)("%s calls no bare fetch()", (file: string, source: string) => {
    expect(FETCH_CALL.test(source), `${path.basename(file)} calls fetch()`).toBe(false);
  });
});
