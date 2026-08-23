import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(dirname, "..", "src");

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// Threat Matrix: poisoned report on a public panel (XSS). React auto-escaping
// is the primary defense; this gate locks the invariant for every future
// change so `dangerouslySetInnerHTML` can never quietly reopen it.
describe("no dangerouslySetInnerHTML anywhere in apps/dashboard/src", () => {
  it("bans the raw-HTML-injection escape hatch across every source file", () => {
    const offenders = listSourceFiles(srcDir).filter((file) =>
      readFileSync(file, "utf8").includes("dangerouslySetInnerHTML"),
    );
    expect(offenders).toEqual([]);
  });
});
