import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const m = JSON.parse(
  readFileSync(fileURLToPath(new URL("../dist/tokens.manifest.json", import.meta.url)), "utf8"),
);

it("every semantic token references a declared primitive in every theme", () => {
  const primPaths = new Set(m.primitives.map((p) => JSON.stringify(p.path)));
  for (const e of m.tokens)
    for (const t of ["light", "dark", "highContrast"]) {
      expect(Array.isArray(e.references[t])).toBe(true);
      expect(e.references[t].length).toBeGreaterThan(0);
      expect(primPaths.has(JSON.stringify(e.references[t]))).toBe(true);
    }
});
