import { describe, expect, it } from "vitest";
import { relativeLuminance } from "../src/color/luminance.js";
import { parseColor } from "../src/color/parse.js";
import { contract, minContrastRatioFor } from "../src/contract.js";
import type { Theme } from "../src/validate-theme.js";
import { checkContrast, validateTheme } from "../src/validate-theme.js";

const WHITE = "oklch(1 0 0)";
const BLACK = "oklch(0 0 0)";

// Black text on white surfaces, white text on a black inverse pair: every one
// of the 16 declared text pairs sits at a ratio of 21, far above any threshold.
// The 3 tone-`-subtle` tokens are included so the union of contrastPairs +
// nonTextContrastPairs (still empty in PR1) resolves without missing-token noise.
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
    "color-danger-subtle": WHITE,
    "color-success-subtle": WHITE,
    "color-warning-subtle": WHITE,
  };
}

// Shared helper for the checkContrast unit tests below: turns a hex string
// into the luminance value checkContrast actually consumes, without going
// through the full theme-resolution pipeline.
function luminanceOf(hex: string): number {
  const parsed = parseColor(hex);
  if (parsed === undefined) throw new Error(`Test fixture color "${hex}" must be parseable.`);
  return relativeLuminance(parsed);
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

describe("checkContrast / signature", () => {
  it("takes exactly three arguments: luminances, pairs, minRatio", () => {
    expect(checkContrast.length).toBe(3);
  });
});

describe("checkContrast / two-tier floor discriminator", () => {
  // Reuses the exact #0b0b0b/#5f5f5f fixture from the low-contrast test above
  // (measured ratio 3.08): it clears the 3.0 non-text floor but fails the 4.5
  // text floor, which is exactly the boundary a floor parameter must respect.
  const luminances = new Map<string, number>([
    ["fg", luminanceOf("#0b0b0b")],
    ["bg", luminanceOf("#5f5f5f")],
  ]);
  const pair = { foreground: "fg", background: "bg" };

  it("passes at the 3.0 non-text floor", () => {
    expect(checkContrast(luminances, [pair], 3.0)).toEqual([]);
  });

  it("fails at the 4.5 text floor with the same 3.08 ratio", () => {
    const violations = checkContrast(luminances, [pair], 4.5);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      rule: "low-contrast",
      tokens: ["fg", "bg"],
      expected: "4.5",
      actual: "3.08",
    });
  });
});

describe("checkContrast / sub-floor synthetic pair", () => {
  it("reports a low-contrast violation carrying the passed 3.0 floor", () => {
    const luminances = new Map<string, number>([
      ["a", luminanceOf("#808080")],
      ["b", luminanceOf("#888888")],
    ]);
    const violations = checkContrast(luminances, [{ foreground: "a", background: "b" }], 3.0);

    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ rule: "low-contrast", expected: "3.0" });
  });
});

describe("checkContrast / non-text floor stays flat across themes (D2)", () => {
  it("passes a 3.45 ratio pair at the flat non-text floor, even though minContrastRatioFor('high-contrast') is 7.0", () => {
    const luminances = new Map<string, number>([
      ["ntfg", luminanceOf("#8a8a8a")],
      ["ntbg", luminanceOf("#ffffff")],
    ]);
    const pair = { foreground: "ntfg", background: "ntbg" };

    // WCAG 1.4.11 defines no AAA non-text tier: the text-only 7.0 escalation
    // for the high-contrast theme must never leak into the non-text floor.
    expect(minContrastRatioFor("high-contrast")).toBe(7.0);
    expect(contract.nonTextMinContrastRatio).toBe(3.0);
    expect(checkContrast(luminances, [pair], contract.nonTextMinContrastRatio)).toEqual([]);
  });
});
