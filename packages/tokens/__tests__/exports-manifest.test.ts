import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

it("resolves the tokens.manifest.json export subpath and exposes theme/token/primitive arrays", () => {
  const require = createRequire(import.meta.url);
  const resolved = require.resolve("@zevaui/tokens/tokens.manifest.json");
  const manifest = JSON.parse(readFileSync(resolved, "utf8"));

  expect(Array.isArray(manifest.themes)).toBe(true);
  expect(Array.isArray(manifest.tokens)).toBe(true);
  expect(Array.isArray(manifest.primitives)).toBe(true);
});
