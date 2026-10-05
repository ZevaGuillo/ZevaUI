import { describe, expect, it } from "vitest";
import { contract, minContrastRatioFor, requiredTokens } from "../src/contract.js";

describe("contract / contrastPairs", () => {
  it("declares exactly 17 contrast pairs", () => {
    expect(contract.contrastPairs).toHaveLength(17);
  });

  // This assertion used to read "never references color-bg-subtle or
  // color-bg-muted". ADR-0022 D1 inverted half of it: an ungated pair is
  // unacceptable once something paints text on that background, because D1
  // proved an unguarded move ships green. `color-bg-subtle` is now a declared
  // background and must stay one; `color-bg-muted` still carries no text in any
  // theme, so it stays out — the pair class is a statement about what is
  // measured, not a list of every token that exists.
  it("declares color-bg-subtle as a background, and still not color-bg-muted", () => {
    const backgrounds = contract.contrastPairs.map((pair) => pair.background);
    expect(backgrounds).toContain("color-bg-subtle");
    expect(backgrounds).not.toContain("color-bg-muted");
  });
});

describe("contract / nonTextContrastPairs", () => {
  it("declares exactly 5 non-text pairs (PR2: border + tone-default/tone-subtle)", () => {
    expect(contract.nonTextContrastPairs).toEqual([
      { foreground: "color-border-strong", background: "color-bg-canvas" },
      { foreground: "color-border-strong", background: "color-bg-surface" },
      { foreground: "color-danger-default", background: "color-danger-subtle" },
      { foreground: "color-success-default", background: "color-success-subtle" },
      { foreground: "color-warning-default", background: "color-warning-subtle" },
    ]);
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
  it("derives exactly 18 tokens, in first-appearance order", () => {
    expect(requiredTokens).toEqual([
      "color-text-default",
      "color-bg-canvas",
      "color-bg-surface",
      "color-text-secondary",
      "color-text-muted",
      // Sixth, not appended: the derived union walks contrastPairs in order and
      // the new text-muted x bg-subtle pair sits immediately after the two
      // older muted pairs, so bg-subtle first appears here. A third-party
      // palette that omits it now reports missing-token — the migration note in
      // README.md is the consumer-facing half of this line.
      "color-bg-subtle",
      "color-text-link",
      "color-text-danger",
      "color-text-success",
      "color-text-inverse",
      "color-bg-inverse",
      "color-danger-subtle",
      "color-success-subtle",
      "color-warning-subtle",
      "color-border-strong",
      "color-danger-default",
      "color-success-default",
      "color-warning-default",
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
