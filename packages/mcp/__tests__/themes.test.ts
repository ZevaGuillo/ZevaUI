import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { themeFor, themeIds } from "../src/themes.js";

// The count lives in @zevaui/tokens, which owns it. Reading it here asserts that
// the MCP resource exposes everything the manifest declares, rather than pinning a
// number that would silently drift out of step with the token layer.
const manifest = JSON.parse(
  readFileSync(
    createRequire(import.meta.url).resolve("@zevaui/tokens/tokens.manifest.json"),
    "utf8",
  ),
);

describe("themeFor / id passthrough", () => {
  it("keeps the kebab id untranslated (THE regression guard)", () => {
    expect(themeFor("high-contrast").id).toBe("high-contrast");
  });
});

describe("themeFor / colors shape", () => {
  it("exposes every semantic token the manifest declares, for light", () => {
    expect(Object.keys(themeFor("light").colors)).toHaveLength(manifest.tokens.length);
  });

  it("selects a different token bucket for high-contrast than light", () => {
    const highContrast = themeFor("high-contrast").colors["color-bg-canvas"];
    const light = themeFor("light").colors["color-bg-canvas"];
    expect(highContrast).not.toBe(light);
  });
});

describe("themeFor / every theme id", () => {
  it.each(themeIds)("returns only non-empty string values for %s", (id) => {
    const colors = themeFor(id).colors;
    for (const value of Object.values(colors)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
