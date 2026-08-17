import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const m = JSON.parse(
  readFileSync(fileURLToPath(new URL("../dist/tokens.manifest.json", import.meta.url)), "utf8"),
);

it("conforms to the pinned schema", () => {
  expect(m.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(m.themes).toEqual(["light", "dark", "high-contrast"]);
  expect(m.tokens).toHaveLength(44);
  for (const e of m.tokens) {
    expect(e.cssVar.startsWith("--zui-")).toBe(true);
    for (const t of ["light", "dark", "highContrast"]) expect(typeof e.values[t]).toBe("string");
    for (const t of ["light", "dark", "highContrast"])
      expect(e.values[t].length).toBeGreaterThan(0);
    expect(e.isSemantic).toBe(true);
  }
  expect(m.primitives.length).toBeGreaterThan(0);
  for (const p of m.primitives) {
    expect(typeof p.value).toBe("string");
    expect(p.cssVar.startsWith("--zui-")).toBe(true);
    expect(p.isSemantic).toBe(false);
  }
});
