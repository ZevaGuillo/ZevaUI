import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { componentRegistry } from "../src/registry.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");
const srcDir = join(packageRoot, "src");

const FORBIDDEN_EMIT_PATTERN = /styled-system|@pandacss/;
const STYLED_SYSTEM_IMPORT_PATTERN = /from\s+["']styled-system/;

function listFilesRecursive(dir: string, extension: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { recursive: true }) as string[];
  return entries.filter((entry) => entry.endsWith(extension)).map((entry) => join(dir, entry));
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
    const srcFiles = [...listFilesRecursive(srcDir, ".ts"), ...listFilesRecursive(srcDir, ".tsx")];
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

// G6, consolidated and made registry-driven. It used to live as one hand-written describe block
// per component test file (button.test.ts, input.test.ts, dialog.test.ts, menu.test.ts each
// asserted `true`; card.test.ts and alert.test.ts each asserted `false`), which meant a seventh
// component only got covered the day someone remembered to copy the block. `componentRegistry` is
// this package's single declaration of what ships (see its header comment), so this gate loops it
// instead: a future entry is covered the moment it is registered, with no test file to remember.
//
// The registry's own `modulePath` + `clientOnly` fields are what `scripts/build-manifest.js`
// already reads to fill in the manifest's `clientOnly` field (`isClientOnly`, reading the FIRST
// BYTES of the built module rather than trusting a hand-maintained flag anywhere else) — this test
// reuses exactly that mechanism for the ACTUAL side of the assertion, rather than inventing a
// second way to detect a `"use client"` directive. `clientOnly` on the registry entry is the
// EXPECTED side: a build-artifact read alone cannot gate anything, since comparing a file's
// content against itself is trivially true and tests nothing. Declaring the expectation once, on
// the entry a component owns, is the field `ComponentRegistryEntry` was missing — see its comment
// in src/registry.ts for why it belongs there and not on the recipe or the .tsx source.
//
// This is also the first time this gate exercises BOTH directions in one registry loop: until
// Card and Alert existed every registered entry was client, so the "does NOT ship the directive"
// half was only ever asserted per-component, never driven off data that could vary.
describe('G6: the emitted module matches the registry-declared "use client" boundary', () => {
  it("has at least one registered component to gate (sanity check)", () => {
    expect(componentRegistry.length).toBeGreaterThan(0);
  });

  it("starts the built module with the client directive exactly when clientOnly says so", () => {
    for (const { name, modulePath, clientOnly } of componentRegistry) {
      const built = readFileSync(join(distDir, modulePath), "utf8");
      expect({ [name]: built.startsWith('"use client";') }).toEqual({ [name]: clientOnly });
    }
  });
});
