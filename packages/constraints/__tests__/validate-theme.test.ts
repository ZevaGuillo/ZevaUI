import { describe, expect, it } from "vitest";
import type { Theme } from "../src/validate-theme.js";
import { validateTheme } from "../src/validate-theme.js";

const WHITE = "oklch(1 0 0)";
const BLACK = "oklch(0 0 0)";

// Black text on white surfaces, white text on a black inverse pair: every one
// of the 13 declared pairs sits at a ratio of 21, far above any threshold.
function compliantColors(): Record<string, string> {
  return {
    "color-text-default": BLACK,
    "color-text-secondary": BLACK,
    "color-text-muted": BLACK,
    "color-text-link": BLACK,
    "color-text-danger": BLACK,
    "color-text-success": BLACK,
    "color-text-inverse": WHITE,
    "color-bg-canvas": WHITE,
    "color-bg-surface": WHITE,
    "color-bg-inverse": BLACK,
  };
}

describe("validateTheme / signature", () => {
  it("takes exactly one argument", () => {
    expect(validateTheme.length).toBe(1);
  });
});

describe("validateTheme / compliant theme", () => {
  it("passes with no violations", () => {
    const theme: Theme = { id: "light", colors: compliantColors() };
    expect(validateTheme(theme)).toEqual({ pass: true, violations: [] });
  });
});

describe("validateTheme / missing token", () => {
  it("reports exactly one missing-token violation and continues without throwing", () => {
    const colors = compliantColors();
    delete colors["color-text-muted"];
    const theme: Theme = { id: "light", colors };

    expect(() => validateTheme(theme)).not.toThrow();
    const result = validateTheme(theme);

    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "missing-token",
      tokens: ["color-text-muted"],
    });
  });
});

describe("validateTheme / invalid color", () => {
  it("reports exactly one invalid-color violation without throwing", () => {
    const colors = compliantColors();
    colors["color-text-link"] = "not-a-color";
    const theme: Theme = { id: "light", colors };

    expect(() => validateTheme(theme)).not.toThrow();
    const result = validateTheme(theme);

    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "invalid-color",
      tokens: ["color-text-link"],
    });
  });
});

describe("validateTheme / known-failing pair", () => {
  it("reports a low-contrast violation carrying both token names and the rounded ratios", () => {
    const colors = compliantColors();
    // Isolated to the text-inverse/bg-inverse pair, the only pair that reads
    // these two tokens, so this is the sole violation produced.
    colors["color-text-inverse"] = "#0b0b0b";
    colors["color-bg-inverse"] = "#5f5f5f";
    const theme: Theme = { id: "light", colors };

    const result = validateTheme(theme);

    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "low-contrast",
      tokens: ["color-text-inverse", "color-bg-inverse"],
      expected: "4.5",
      actual: "3.08",
    });
  });
});

describe("validateTheme / theme.id threshold selection", () => {
  it("validates an unknown theme.id at the default 4.5, not 7.0", () => {
    const colors = compliantColors();
    // Ratio 6.000000000000001: passes 4.5, fails 7.0.
    colors["color-text-inverse"] = "oklch(0.5 0 0)";
    colors["color-bg-inverse"] = WHITE;
    const theme: Theme = { id: "sepia", colors };

    const result = validateTheme(theme);

    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("applies 7.0 when theme.id is 'high-contrast'", () => {
    const colors = compliantColors();
    colors["color-text-inverse"] = "oklch(0.5 0 0)";
    colors["color-bg-inverse"] = WHITE;
    const theme: Theme = { id: "high-contrast", colors };

    const result = validateTheme(theme);

    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "low-contrast",
      tokens: ["color-text-inverse", "color-bg-inverse"],
      expected: "7.0",
    });
  });
});

describe("validateTheme / boundary comparison on the unrounded float", () => {
  it("passes a ratio that is >= 4.5", () => {
    const colors = compliantColors();
    colors["color-text-inverse"] = "oklch(0.568085640286245 0 0)";
    colors["color-bg-inverse"] = WHITE;
    const theme: Theme = { id: "light", colors };

    const result = validateTheme(theme);

    expect(result.pass).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("fails a ratio that is < 4.5, even though it displays as 4.50", () => {
    const colors = compliantColors();
    colors["color-text-inverse"] = "oklch(0.5680909960443082 0 0)";
    colors["color-bg-inverse"] = WHITE;
    const theme: Theme = { id: "light", colors };

    const result = validateTheme(theme);

    expect(result.pass).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toMatchObject({
      rule: "low-contrast",
      expected: "4.5",
      actual: "4.50",
    });
  });
});
