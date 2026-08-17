import { describe, expect, it } from "vitest";
import { themeFor, themeIds } from "../src/themes.js";

describe("themeFor / id passthrough", () => {
  it("keeps the kebab id untranslated (THE regression guard)", () => {
    expect(themeFor("high-contrast").id).toBe("high-contrast");
  });
});

describe("themeFor / colors shape", () => {
  it("exposes exactly 44 semantic tokens for light", () => {
    expect(Object.keys(themeFor("light").colors)).toHaveLength(44);
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
