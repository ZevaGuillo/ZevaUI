import { describe, expect, it } from "vitest";
import { relativeLuminance } from "../../src/color/luminance.js";

describe("relativeLuminance", () => {
  it("returns 1 for white", () => {
    expect(relativeLuminance({ r: 1, g: 1, b: 1 })).toBe(1);
  });

  it("returns 0 for black", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("isolates the red coefficient", () => {
    expect(relativeLuminance({ r: 1, g: 0, b: 0 })).toBeCloseTo(0.2126, 10);
  });

  it("isolates the green coefficient", () => {
    expect(relativeLuminance({ r: 0, g: 1, b: 0 })).toBeCloseTo(0.7152, 10);
  });

  it("isolates the blue coefficient", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 1 })).toBeCloseTo(0.0722, 10);
  });
});
