// Emits dist/components.manifest.json. Runs AFTER `tsc` and `panda cssgen`, and reads only
// generated output (dist/**/*.js, dist/styles.css) — never a source .tsx file. ADR-0001 D8
// requires the MCP server to read generated manifests, never scan source.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");

const { buttonRecipe } = await import(pathToFileURL(join(distDir, "button", "button.recipe.js")));
const { variantClassName } = await import(
  pathToFileURL(join(distDir, "internal", "recipe-class.js"))
);

const css = readFileSync(join(distDir, "styles.css"), "utf8");
const builtButtonSource = readFileSync(join(distDir, "button", "Button.js"), "utf8");

// Reports what Button ACTUALLY consumes rather than what someone remembered to list.
function extractConsumedTokens(source) {
  const cssVars = new Set();
  for (const match of source.matchAll(/var\(--zui-([a-z0-9-]+)\)/g)) {
    cssVars.add(`--zui-${match[1]}`);
  }
  return [...cssVars].sort();
}

// Derived from the recipe via variantClassName, mirroring the same convention `recipeClassName`
// uses at runtime — never a hand-maintained literal list.
function extractClassNames(recipe) {
  const classNames = new Set([recipe.className]);
  for (const [axis, values] of Object.entries(recipe.variants)) {
    for (const value of Object.keys(values)) {
      classNames.add(variantClassName(recipe.className, axis, value));
    }
  }
  return [...classNames];
}

function extractVariants(recipe) {
  return Object.entries(recipe.variants).map(([axis, values]) => ({
    axis,
    values: Object.keys(values),
    default: recipe.defaultVariants?.[axis],
  }));
}

const manifest = {
  version: "1.0.0",
  generated: new Date().toISOString(),
  components: [
    {
      name: "Button",
      className: buttonRecipe.className,
      clientOnly: builtButtonSource.startsWith('"use client";'),
      import: "@zevaui/components",
      slots: [],
      variants: extractVariants(buttonRecipe),
      classNames: extractClassNames(buttonRecipe),
      tokens: extractConsumedTokens(css),
    },
  ],
};

writeFileSync(join(distDir, "components.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
