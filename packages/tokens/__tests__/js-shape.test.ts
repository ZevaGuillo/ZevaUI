import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("exports per-theme flat token maps with static types", async () => {
  const { tokens } = await import("../dist/index.js");
  expect(Object.keys(tokens).sort()).toEqual(["dark", "highContrast", "light"]);
  for (const t of ["light", "dark", "highContrast"]) {
    expect(Object.values(tokens[t]).every((v) => typeof v === "string")).toBe(true);
  }
  expect(typeof tokens.light["color-text-default"]).toBe("string");
  expect(tokens.light["color-text-default"].length).toBeGreaterThan(0);
  const dts = readFileSync(fileURLToPath(new URL("../dist/index.d.ts", import.meta.url)), "utf8");
  expect(dts).toContain("tokens");
  expect(dts).toContain("light");
  expect(dts).toContain("dark");
  expect(dts).toContain("highContrast");
});
