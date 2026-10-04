import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const m = JSON.parse(
  readFileSync(fileURLToPath(new URL("../dist/tokens.manifest.json", import.meta.url)), "utf8"),
);

const THEMES = ["light", "dark", "highContrast"] as const;

// ADR-0022 repoints the semantic radius scale at coarser primitives that already
// existed. no-literals.test.ts only proves a semantic token resolves to *some*
// declared primitive, so it stays green whichever radius a theme points at —
// including the pre-ADR-0022 values, and including a theme that silently failed to
// move. These pins are what make the repoint, and any later drift away from it,
// visible to the suite.
//
// Each case asserts the reference path *and* the resolved value on purpose. The
// reference alone would let the geometry change under us: if radius.lg were
// retuned to 10px, every input and button would change shape while still pointing
// at the primitive this test names, and ADR-0022's decision would be void in
// silence. The two assertions carry separate messages so a failure says which of
// the two contracts broke.
const EXPECTED = [
  { name: "radius-input", reference: ["radius", "lg"], value: "8px" },
  { name: "radius-card", reference: ["radius", "xl"], value: "12px" },
  { name: "radius-button", reference: ["radius", "lg"], value: "8px" },
] as const;

const tokenNamed = (name: string) => {
  const entry = m.tokens.find((t: { name: string }) => t.name === name);
  expect(entry, `no semantic token named ${name} in the manifest`).toBeDefined();
  return entry;
};

describe("ADR-0022 radius geometry", () => {
  for (const { name, reference, value } of EXPECTED) {
    it(`${name} points at {${reference.join(".")}} in every theme`, () => {
      const entry = tokenNamed(name);
      for (const theme of THEMES) {
        expect(entry.references[theme], `${name} reference in ${theme}`).toEqual([...reference]);
        expect(entry.values[theme], `${name} resolved value in ${theme}`).toBe(value);
      }
    });
  }
});
