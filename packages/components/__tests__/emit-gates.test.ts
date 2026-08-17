import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");
const srcDir = join(packageRoot, "src");

const FORBIDDEN_EMIT_PATTERN = /styled-system|@pandacss/;
const STYLED_SYSTEM_IMPORT_PATTERN = /from\s+["']styled-system/;

function listFilesRecursive(dir: string, extension: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(extension))
    .map((entry) => join(dir, entry));
}

describe("G7: the built package never re-exposes the ejected Panda output", () => {
  it("emits at least one dist/**/*.js file", () => {
    const jsFiles = listFilesRecursive(distDir, ".js");
    expect(jsFiles.length).toBeGreaterThan(0);
  });

  it("no dist/**/*.js file mentions styled-system or @pandacss", () => {
    const jsFiles = listFilesRecursive(distDir, ".js");
    for (const file of jsFiles) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(FORBIDDEN_EMIT_PATTERN);
    }
  });
});

describe("source never imports the generated Panda output", () => {
  it("no file under src imports styled-system", () => {
    const srcFiles = [
      ...listFilesRecursive(srcDir, ".ts"),
      ...listFilesRecursive(srcDir, ".tsx"),
    ];
    expect(srcFiles.length).toBeGreaterThan(0);
    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      expect(content).not.toMatch(STYLED_SYSTEM_IMPORT_PATTERN);
    }
  });
});

describe("the package build never runs panda codegen", () => {
  it("keeps codegen out of the build script", () => {
    const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    expect(pkg.scripts.build).not.toMatch(/panda codegen/);
  });
});
