import { describe, expect, it } from "vitest";
import { parseColor } from "../../src/color/parse.js";

describe("parseColor / oklch", () => {
  it("parses oklch(1 0 0) as white", () => {
    expect(parseColor("oklch(1 0 0)")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("parses oklch(0 0 0) as black", () => {
    expect(parseColor("oklch(0 0 0)")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("parseColor / hex", () => {
  it("parses #fff as white", () => {
    expect(parseColor("#fff")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("parses #ffffff as white", () => {
    expect(parseColor("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("parses #000000 as black", () => {
    expect(parseColor("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("parseColor / tolerant formatting", () => {
  it("tolerates surrounding whitespace", () => {
    expect(parseColor("  #fff  ")).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseColor("  oklch(1 0 0)  ")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("tolerates uppercase input", () => {
    expect(parseColor("#FFF")).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseColor("OKLCH(1 0 0)")).toEqual({ r: 1, g: 1, b: 1 });
  });
});

describe("parseColor / rejects invalid input without throwing", () => {
  const invalidInputs = [
    ".",
    "1.2.3",
    "oklch(50% 0.1 200)",
    "oklch(0.5 0.1 200 / 0.5)",
    "rgb(0,0,0)",
    "hsl(0,0%,0%)",
    "red",
    "#ffff",
    "",
  ];

  for (const input of invalidInputs) {
    it(`returns undefined for ${JSON.stringify(input)}`, () => {
      expect(() => parseColor(input)).not.toThrow();
      expect(parseColor(input)).toBeUndefined();
    });
  }
});
