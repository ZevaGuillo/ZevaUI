import { describe, expect, it } from "vitest";
import { contract, minContrastRatioFor, requiredTokens } from "../src/contract.js";

describe("contract / contrastPairs", () => {
  it("declares exactly 16 contrast pairs", () => {
    expect(contract.contrastPairs).toHaveLength(16);
  });

  it("never references color-bg-subtle or color-bg-muted", () => {
    const backgrounds = contract.contrastPairs.map((pair) => pair.background);
    expect(backgrounds).not.toContain("color-bg-subtle");
    expect(backgrounds).not.toContain("color-bg-muted");
  });
});

describe("contract / nonTextContrastPairs (PR1: inert)", () => {
  it("declares the sibling array empty, awaiting PR2 population", () => {
    expect(contract.nonTextContrastPairs).toEqual([]);
  });

  it("declares a flat 3.0 non-text floor, distinct from the per-theme text floors", () => {
    expect(contract.nonTextMinContrastRatio).toBe(3.0);
  });
});

describe("contract / thresholds", () => {
  it("declares the theme thresholds and default", () => {
    expect(contract.themes.light.minContrastRatio).toBe(4.5);
    expect(contract.themes.dark.minContrastRatio).toBe(4.5);
    expect(contract.themes["high-contrast"].minContrastRatio).toBe(7.0);
    expect(contract.defaultMinContrastRatio).toBe(4.5);
  });

  it("uses the kebab-case literal 'high-contrast', never 'highContrast'", () => {
    expect(contract.themes["high-contrast"]).toBeDefined();
    expect((contract.themes as Record<string, unknown>).highContrast).toBeUndefined();
  });
});

describe("contract / declared-but-unconsumed blocks", () => {
  it("declares tokenTypes and scales", () => {
    expect(contract.tokenTypes).toBeDefined();
    expect(contract.scales).toBeDefined();
  });
});

describe("contract / requiredTokens", () => {
  it("derives exactly 13 tokens, in first-appearance order", () => {
    expect(requiredTokens).toEqual([
      "color-text-default",
      "color-bg-canvas",
      "color-bg-surface",
      "color-text-secondary",
      "color-text-muted",
      "color-text-link",
      "color-text-danger",
      "color-text-success",
      "color-text-inverse",
      "color-bg-inverse",
      "color-danger-subtle",
      "color-success-subtle",
      "color-warning-subtle",
    ]);
  });

  // Union property: requiredTokens must equal the deduplicated set of every
  // token referenced by EITHER pair array, so no separate registration step
  // can drift from the pairs that actually declare tokens. Vacuously true
  // once the union call exists (nonTextContrastPairs is still empty in PR1);
  // it stays true unedited once PR2 populates the non-text array.
  it("equals the deduplicated union of contrastPairs and nonTextContrastPairs tokens", () => {
    const flattened = [
      ...contract.contrastPairs.flatMap((pair) => [pair.foreground, pair.background]),
      ...contract.nonTextContrastPairs.flatMap((pair) => [pair.foreground, pair.background]),
    ];
    expect(new Set(requiredTokens)).toEqual(new Set(flattened));
  });
});

describe("contract / minContrastRatioFor", () => {
  it("resolves high-contrast to 7.0", () => {
    expect(minContrastRatioFor("high-contrast")).toBe(7.0);
  });

  it("falls back to the default for an unknown theme id", () => {
    expect(minContrastRatioFor("sepia")).toBe(4.5);
  });
});
