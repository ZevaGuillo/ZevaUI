import { describe, expect, it } from "vitest";
import { recipeClassName, variantClassName } from "../src/internal/recipe-class.js";

const recipeWithoutDefaults = {
  className: "zui-fixture",
  variants: {
    visual: { solid: {}, subtle: {} },
  },
};

const recipeWithDefaults = {
  className: "zui-fixture",
  variants: {
    visual: { solid: {}, subtle: {}, danger: {} },
    size: { sm: {}, md: {}, lg: {} },
  },
  defaultVariants: { visual: "solid", size: "md" },
};

describe("variantClassName", () => {
  it("joins base, axis and value with the recipe convention", () => {
    expect(variantClassName("zui-button", "visual", "solid")).toBe("zui-button--visual_solid");
  });
});

describe("recipeClassName", () => {
  it("returns only the base class when the recipe has no defaults and nothing is selected", () => {
    expect(recipeClassName(recipeWithoutDefaults, {})).toBe("zui-fixture");
  });

  it("applies default variants when a variant is omitted from the selection", () => {
    expect(recipeClassName(recipeWithDefaults, {})).toBe(
      "zui-fixture zui-fixture--visual_solid zui-fixture--size_md",
    );
  });

  it("lets an explicit selection override the default for that axis", () => {
    expect(recipeClassName(recipeWithDefaults, { visual: "danger" })).toBe(
      "zui-fixture zui-fixture--visual_danger zui-fixture--size_md",
    );
  });

  it("orders class names by variant declaration order, not by selection insertion order", () => {
    const first = recipeClassName(recipeWithDefaults, { size: "lg", visual: "subtle" });
    const second = recipeClassName(recipeWithDefaults, { visual: "subtle", size: "lg" });
    expect(first).toBe(second);
    expect(first).toBe("zui-fixture zui-fixture--visual_subtle zui-fixture--size_lg");
  });
});
