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

  it("reports exactly 17 missing-token violations for an empty candidate", () => {
    const result = validateThemeRequest({ theme: "light", colors: {} });

    expect(result.pass).toBe(false);
    expect(result.violations.filter((v) => v.rule === "missing-token")).toHaveLength(17);
  });

  it("reports an invalid-color violation for an unparseable value", () => {
    const colors = { ...themeFor("light").colors, "color-text-default": "not-a-color" };
    const result = validateThemeRequest({ theme: "light", colors });

    expect(result.violations.some((v) => v.rule === "invalid-color")).toBe(true);
  });

  it("reports a low-contrast violation at the 3.0 non-text floor for a weak border pair", () => {
    // gray.400 (oklch(0.707 0.022 261.325)) is the pre-repoint light
    // border-strong primitive, measured at ~2.49:1 against bg-canvas — well
    // under the flat 3.0 non-text floor. Proves the tier reaches MCP through
    // the same requiredTokens/nonTextContrastPairs plumbing as the text tier,
    // independent of whichever primitive the live theme currently ships.
    const colors = {
      ...themeFor("light").colors,
      "color-border-strong": "oklch(0.707 0.022 261.325)",
    };
    const result = validateThemeRequest({ theme: "light", colors });

    expect(result.pass).toBe(false);
    expect(
      result.violations.some(
        (v) =>
          v.rule === "low-contrast" &&
          v.expected === "3.0" &&
          v.tokens.includes("color-border-strong"),
      ),
    ).toBe(true);
  });
});
