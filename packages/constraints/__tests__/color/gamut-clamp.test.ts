import { describe, expect, it } from "vitest";
import { contrastRatio } from "../../src/color/contrast.js";
import { relativeLuminance } from "../../src/color/luminance.js";
import { parseColor } from "../../src/color/parse.js";

// red.600 primitive: oklch(0.577 0.245 27.325). Its raw (unclamped) OKLab->linear-sRGB
// conversion produces a slightly negative green channel, which is out of the sRGB gamut.
// The clamp must be the LAST operation inside the oklch path — applying it changes the
// resulting WCAG contrast ratio against a light canvas, proving its position is
// outcome-affecting and not merely cosmetic.
const RED_600 = "oklch(0.577 0.245 27.325)";
const GRAY_50 = "oklch(0.985 0.002 247.839)";

describe("gamut clamping in the oklch path", () => {
  it("clamps the out-of-gamut green channel of red.600 to exactly 0", () => {
    const red600 = parseColor(RED_600);
    expect(red600).toBeDefined();
    expect(red600?.g).toBe(0);
    expect(red600?.r).toBeCloseTo(0.800251, 6);
    expect(red600?.b).toBeCloseTo(0.003272, 6);
  });

  it("produces a different contrast ratio than the raw unclamped value would", () => {
    const red600 = parseColor(RED_600);
    const gray50 = parseColor(GRAY_50);
    expect(red600).toBeDefined();
    expect(gray50).toBeDefined();
    if (!red600 || !gray50) return;

    const clampedRatio = contrastRatio(relativeLuminance(red600), relativeLuminance(gray50));
    expect(clampedRatio).toBeCloseTo(4.56, 2);

    // Same computation using the raw, unclamped green channel: g = -0.009405.
    const rawGreen = -0.009405;
    const rawLuminance = 0.2126 * red600.r + 0.7152 * rawGreen + 0.0722 * red600.b;
    const rawRatio = contrastRatio(rawLuminance, relativeLuminance(gray50));
    expect(rawRatio).toBeCloseTo(4.71, 2);

    expect(clampedRatio).not.toBeCloseTo(rawRatio, 1);
  });
});
