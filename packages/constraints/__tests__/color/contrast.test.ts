import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/color/contrast.js";
import { relativeLuminance } from "../../src/color/luminance.js";
import { parseColor } from "../../src/color/parse.js";

describe("contrastRatio", () => {
  it("returns exactly 21 for black on white", () => {
    expect(contrastRatio(1, 0)).toBe(21);
  });

  it("returns 1 for identical luminances", () => {
    expect(contrastRatio(0.5, 0.5)).toBe(1);
  });

  it("is symmetric", () => {
    const a = 0.8;
    const b = 0.2;
    expect(contrastRatio(a, b)).toBe(contrastRatio(b, a));
  });

  it("matches the canonical WCAG boundary for #ffffff on #767676", () => {
    // #767676 is the well-known WCAG AA boundary color for white text (~4.54:1).
    // Tolerance of ~0.01 accounts for floating point rounding in the sRGB decode.
    const white = parseColor("#ffffff");
    const gray = parseColor("#767676");
    if (!white || !gray) throw new Error("expected valid colors in test fixture");

    const ratio = contrastRatio(relativeLuminance(white), relativeLuminance(gray));
    expect(ratio).toBeGreaterThan(4.53);
    expect(ratio).toBeLessThan(4.55);
  });
});
