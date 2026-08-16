import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("exposes a single source of truth for theme ids and their JS key mapping", async () => {
  const { default: tokens, themeIds, themeKeyOf } = await import("../dist/index.js");
  const require = createRequire(import.meta.url);
  const manifest = JSON.parse(
    readFileSync(require.resolve("../dist/tokens.manifest.json"), "utf8"),
  );

  expect(themeIds).toEqual(["light", "dark", "high-contrast"]);
  expect(themeKeyOf).toEqual({ light: "light", dark: "dark", "high-contrast": "highContrast" });
  expect(Object.keys(tokens)).toEqual(themeIds.map((id: string) => themeKeyOf[id]));
  expect(manifest.themes).toEqual(themeIds);
  expect(Object.keys(tokens.light).length).toBe(42);

  const dts = readFileSync(fileURLToPath(new URL("../dist/index.d.ts", import.meta.url)), "utf8");
  expect(dts.startsWith("type ZevauiThemeTokens = {")).toBe(true);
  expect(dts).toContain("export { themeIds, themeKeyOf };");
  expect(dts).toContain("declare const themeIds: readonly ['light', 'dark', 'high-contrast'];");
});
