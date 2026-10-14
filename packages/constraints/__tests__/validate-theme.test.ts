import { describe, expect, it } from "vitest";
import { relativeLuminance } from "../src/color/luminance.js";
import { parseColor } from "../src/color/parse.js";
import { contract, minContrastRatioFor } from "../src/contract.js";
import type { Theme, ValidationResult, Violation } from "../src/validate-theme.js";
import { checkContrast, validateTheme } from "../src/validate-theme.js";

const WHITE = "oklch(1 0 0)";
const BLACK = "oklch(0 0 0)";

// Black text on white surfaces, white text on a black inverse pair: every one
// of the 17 declared text pairs sits at a ratio of 21, far above any threshold.
// The 3 tone-`-subtle` tokens plus `border-strong` and the 3 tone-`-default`
// tokens are included so the union of contrastPairs + nonTextContrastPairs
// (5 entries as of PR2) resolves without missing-token noise; BLACK-on-WHITE
// clears both the 4.5 text floor and the flat 3.0 non-text floor.
//
// This fixture must carry every token in `requiredTokens`, so it grows when the
// contract gates a new pair: ADR-0022 D1 added text-muted x bg-subtle, which
// made `color-bg-subtle` required and turned eight tests in this file red with
// missing-token violations until it was listed here.
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
    "color-bg-subtle": WHITE,
    "color-bg-inverse": BLACK,
    "color-danger-subtle": WHITE,
    "color-success-subtle": WHITE,
    "color-warning-subtle": WHITE,
    "color-border-strong": BLACK,
    "color-danger-default": BLACK,
    "color-success-default": BLACK,
    "color-warning-default": BLACK,
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

// EVERY SOLE-VIOLATION TEST BELOW WAS THE SAME BODY WITH ONE LITERAL CHANGED,
// SO IT SAYS IT ONCE. Six tests built a theme from a mutated palette, validated
// it, asserted `pass: false` and exactly one violation, then matched that
// violation's shape — differing only in which token they broke and what they
// expected back. SonarCloud normalises literals before comparing blocks, so to
// its duplication detector those bodies were IDENTICAL, and the matching run
// did not stop at a test boundary: it continued into the opening lines of the
// next `describe`. That is how adding ONE block took this file's new code to
// 5.3% duplication against a 3% ceiling, while the two bodies it matched had
// been sitting here unchanged since before the change that got flagged.
// `pinRatio` in tokens-contract.gate.test.ts carries the same note for the
// same reason.
//
// `themeId` is a parameter rather than fixed to "light" because three callers
// pass something else, and which threshold a theme selects is the one thing
// those three tests are arguing about.
function validate(colors: Record<string, string>, themeId = "light"): ValidationResult {
  return validateTheme({ id: themeId, colors });
}

// Returns the single violation so each caller still matches its own shape —
// the rule, the tokens, and for some the rendered expected/actual ratios.
// `expect(...).not.toThrow()` is deliberately NOT folded in here: only two of
// the six tests argue it, and asserting it for the other four would be adding
// coverage under cover of a refactor. Those two keep saying it themselves.
function soleViolation(colors: Record<string, string>, themeId = "light"): Violation {
  const result = validate(colors, themeId);

  expect(result.pass).toBe(false);
  expect(result.violations).toHaveLength(1);
  return result.violations[0];
}

// The passing counterpart. Two tests make this exact claim about a palette that
// clears its floor, and they sit directly above two `soleViolation` tests — so
// leaving them expanded re-formed the duplicated run one `describe` further
// down, which is how the first attempt at this fix moved the duplication rather
// than removing it. Asserting the empty array as well as the flag is the
// existing claim kept whole: `pass: true` with a non-empty `violations` would
// be a contradiction worth failing on.
function expectClean(colors: Record<string, string>, themeId = "light"): void {
  const result = validate(colors, themeId);

  expect(result.pass).toBe(true);
  expect(result.violations).toEqual([]);
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

    expect(() => validate(colors)).not.toThrow();
    expect(soleViolation(colors)).toMatchObject({
      rule: "missing-token",
      tokens: ["color-text-muted"],
    });
  });
});

describe("validateTheme / the 2.0.0 breaking change", () => {
  it("fails a palette that supplies every other required token but not color-bg-subtle", () => {
    // The migration scenario README.md describes, asserted as BEHAVIOR rather
    // than as a count. The "18 missing-token violations for an empty candidate"
    // test in packages/mcp cannot show this: that number would stay green if
    // some OTHER token had become required instead of color-bg-subtle, so it
    // measures the size of requiredTokens and not which token joined it.
    // This is the whole justification for the major version bump, so it is
    // worth a test that fails for the right reason.
    const colors = compliantColors();
    delete colors["color-bg-subtle"];

    expect(soleViolation(colors)).toMatchObject({
      rule: "missing-token",
      tokens: ["color-bg-subtle"],
    });
  });
});

describe("validateTheme / invalid color", () => {
  it("reports exactly one invalid-color violation without throwing", () => {
    const colors = compliantColors();
    colors["color-text-link"] = "not-a-color";

    expect(() => validate(colors)).not.toThrow();
    expect(soleViolation(colors)).toMatchObject({
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

    expect(soleViolation(colors)).toMatchObject({
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

    expectClean(colors, "sepia");
  });

  it("applies 7.0 when theme.id is 'high-contrast'", () => {
    const colors = compliantColors();
    colors["color-text-inverse"] = "oklch(0.5 0 0)";
    colors["color-bg-inverse"] = WHITE;

    expect(soleViolation(colors, "high-contrast")).toMatchObject({
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

    expectClean(colors);
  });

  it("fails a ratio that is < 4.5, even though it displays as 4.50", () => {
    const colors = compliantColors();
    colors["color-text-inverse"] = "oklch(0.5680909960443082 0 0)";
    colors["color-bg-inverse"] = WHITE;

    expect(soleViolation(colors)).toMatchObject({
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
