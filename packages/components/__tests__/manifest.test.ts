import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buttonRecipe } from "../src/button/button.recipe.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");

const manifest = JSON.parse(readFileSync(join(distDir, "components.manifest.json"), "utf8"));
const css = readFileSync(join(distDir, "styles.css"), "utf8");

const tokensManifestPath = createRequire(import.meta.url).resolve(
  "@zevaui/tokens/tokens.manifest.json",
);
const tokensManifest = JSON.parse(readFileSync(tokensManifestPath, "utf8"));
const declaredCssVars = new Set<string>(
  (tokensManifest.tokens as Array<{ cssVar: string }>).map((token) => token.cssVar),
);

describe("G8: the components manifest mirrors the recipe's variant contract", () => {
  it("deep-equals variants derived from the imported buttonRecipe, never a literal copy", () => {
    const defaultVariants = buttonRecipe.defaultVariants as Record<string, string>;
    const expectedVariants = Object.entries(buttonRecipe.variants).map(([axis, values]) => ({
      axis,
      values: Object.keys(values),
      default: defaultVariants[axis],
    }));

    const [button] = manifest.components;
    expect(button.variants).toEqual(expectedVariants);
  });
});

describe("components.manifest.json shape", () => {
  it("has exactly one component entry", () => {
    expect(manifest.components).toHaveLength(1);
  });

  it("names it Button with the recipe className and no slots", () => {
    const [button] = manifest.components;
    expect(button.name).toBe("Button");
    expect(button.className).toBe("zui-button");
    expect(button.slots).toEqual([]);
  });

  it("lists only tokens that exist as a cssVar in @zevaui/tokens' tokens.manifest.json", () => {
    const [button] = manifest.components;
    expect(button.tokens.length).toBeGreaterThan(0);
    for (const cssVar of button.tokens as string[]) {
      expect(declaredCssVars.has(cssVar)).toBe(true);
    }
  });

  it("lists only classNames that appear as a selector in the emitted dist/styles.css", () => {
    const [button] = manifest.components;
    expect(button.classNames.length).toBeGreaterThan(0);
    for (const className of button.classNames as string[]) {
      expect(css).toMatch(new RegExp(`\\.${className}\\s*\\{`));
    }
  });
});
