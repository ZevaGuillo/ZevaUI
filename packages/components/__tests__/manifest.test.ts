import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { consumedTokens } from "../src/internal/consumed-tokens.js";
import { variantClassName } from "../src/internal/recipe-class.js";
import { componentRegistry } from "../src/registry.js";

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

type ManifestEntry = {
  readonly name: string;
  readonly className: string;
  readonly slots: readonly string[];
  readonly variants: ReadonlyArray<{ axis: string; values: string[]; default?: string }>;
  readonly classNames: readonly string[];
  readonly tokens: readonly string[];
};

type RecipeShape = {
  readonly className: string;
  readonly variants: Record<string, Record<string, unknown>>;
  readonly defaultVariants?: Record<string, string>;
};

function manifestEntryFor(name: string): ManifestEntry {
  const entry = (manifest.components as ManifestEntry[]).find((c) => c.name === name);
  if (entry === undefined) throw new Error(`components.manifest.json has no entry named ${name}`);
  return entry;
}

// The variant contract the manifest must mirror, derived from the recipe itself.
function expectedVariants(recipe: RecipeShape) {
  return Object.entries(recipe.variants).map(([axis, values]) => ({
    axis,
    values: Object.keys(values),
    default: recipe.defaultVariants?.[axis],
  }));
}

// The class names a recipe can render, derived through the same convention the runtime uses.
function expectedClassNames(recipe: RecipeShape): string[] {
  return [
    recipe.className,
    ...Object.entries(recipe.variants).flatMap(([axis, values]) =>
      Object.keys(values).map((value) => variantClassName(recipe.className, axis, value)),
    ),
  ];
}

describe("G8: the components manifest mirrors every registered recipe's variant contract", () => {
  it("deep-equals variants derived from the registered recipes, never a literal copy", () => {
    for (const entry of componentRegistry) {
      expect(manifestEntryFor(entry.name).variants).toEqual(expectedVariants(entry.recipe));
    }
  });
});

describe("components.manifest.json shape", () => {
  it("has exactly one entry per registered component", () => {
    expect(manifest.components).toHaveLength(componentRegistry.length);
    expect((manifest.components as ManifestEntry[]).map((entry) => entry.name)).toEqual(
      componentRegistry.map((entry) => entry.name),
    );
  });

  it("names every entry after its registry entry, with the recipe className and no slots", () => {
    for (const entry of componentRegistry) {
      const manifestEntry = manifestEntryFor(entry.name);
      expect(manifestEntry.name).toBe(entry.name);
      expect(manifestEntry.className).toBe(entry.recipe.className);
      expect(manifestEntry.slots).toEqual([]);
    }
  });

  it("lists only tokens that exist as a cssVar in @zevaui/tokens' tokens.manifest.json", () => {
    for (const entry of componentRegistry) {
      const manifestEntry = manifestEntryFor(entry.name);
      expect(manifestEntry.tokens.length).toBeGreaterThan(0);
      for (const cssVar of manifestEntry.tokens) {
        expect(declaredCssVars.has(cssVar)).toBe(true);
      }
    }
  });

  it("lists only classNames that appear as a selector in the emitted dist/styles.css", () => {
    for (const entry of componentRegistry) {
      const manifestEntry = manifestEntryFor(entry.name);
      expect(manifestEntry.classNames.length).toBeGreaterThan(0);
      for (const className of manifestEntry.classNames) {
        expect(css).toMatch(new RegExp(`\\.${className}\\s*\\{`));
      }
    }
  });
});

describe("G9: each manifest entry claims only the tokens its own rules consume", () => {
  it("scopes every entry's token list to that component's own CSS rules", () => {
    for (const entry of componentRegistry) {
      const scoped = consumedTokens(css, expectedClassNames(entry.recipe));
      expect(scoped.length).toBeGreaterThan(0);
      expect(manifestEntryFor(entry.name).tokens).toEqual(scoped);
    }
  });

  // A package-wide scan would hand every component every other component's tokens. This is
  // what that regression looks like with more than one component in the stylesheet.
  const twoComponentCss = `@layer tokens{
  :where(:root, :host) {
    --zuip-colors-accent-default: var(--zui-color-accent-default);
    --zuip-shadows-modal: var(--zui-shadow-modal);
}
}

@layer recipes{
  .zui-alpha {
    background-color: var(--zuip-colors-accent-default);
}

  .zui-alpha-extra {
    box-shadow: var(--zuip-shadows-modal);
}

  .zui-beta {
    box-shadow: var(--zuip-shadows-modal);
}
}
`;

  it("reports only the tokens reachable from the requested class names", () => {
    expect(consumedTokens(twoComponentCss, ["zui-alpha"])).toEqual(["--zui-color-accent-default"]);
    expect(consumedTokens(twoComponentCss, ["zui-beta"])).toEqual(["--zui-shadow-modal"]);
  });

  it("never matches a class name that is only a prefix of another component's class", () => {
    expect(consumedTokens(twoComponentCss, ["zui-alph"])).toEqual([]);
  });

  it("resolves each rule's --zuip-* reference back to its upstream --zui-* token", () => {
    expect(consumedTokens(twoComponentCss, ["zui-alpha", "zui-beta"])).toEqual([
      "--zui-color-accent-default",
      "--zui-shadow-modal",
    ]);
  });
});
