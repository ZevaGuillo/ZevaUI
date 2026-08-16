import { describe, expect, it } from "vitest";
import { themeFor, themeIds } from "../src/themes.js";
import { validateThemeRequest } from "../src/validate.js";

describe("validateThemeRequest / self-check mode", () => {
  it.each(themeIds)("passes with no violations for %s", (id) => {
    expect(validateThemeRequest({ theme: id })).toEqual({ pass: true, violations: [] });
  });
});

describe("validateThemeRequest / candidate mode", () => {
  it("fails the light palette against the high-contrast threshold", () => {
    const result = validateThemeRequest({
      theme: "high-contrast",
      colors: themeFor("light").colors,
    });

    expect(result.pass).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.rule === "low-contrast" && v.expected === "7.0")).toBe(
      true,
    );
  });

  it("reports exactly 10 missing-token violations for an empty candidate", () => {
    const result = validateThemeRequest({ theme: "light", colors: {} });

    expect(result.pass).toBe(false);
    expect(result.violations.filter((v) => v.rule === "missing-token")).toHaveLength(10);
  });

  it("reports an invalid-color violation for an unparseable value", () => {
    const colors = { ...themeFor("light").colors, "color-text-default": "not-a-color" };
    const result = validateThemeRequest({ theme: "light", colors });

    expect(result.violations.some((v) => v.rule === "invalid-color")).toBe(true);
  });
});
