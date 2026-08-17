// Emits dist/components.manifest.json. Runs AFTER `tsc` and `panda cssgen`, and reads only
// generated output (dist/**/*.js, dist/styles.css) — never a source .tsx file. ADR-0001 D8
// requires the MCP server to read generated manifests, never scan source.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");

// src/registry.ts is the single declaration of what ships; this script never names a component.
const { componentRegistry } = await import(pathToFileURL(join(distDir, "registry.js")));
const { variantClassName } = await import(
  pathToFileURL(join(distDir, "internal", "recipe-class.js"))
);
const { consumedTokens } = await import(
  pathToFileURL(join(distDir, "internal", "consumed-tokens.js"))
);

const css = readFileSync(join(distDir, "styles.css"), "utf8");

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

// The built module, not its source: `modulePath` is relative to dist for exactly this reason.
function isClientOnly(modulePath) {
  return readFileSync(join(distDir, modulePath), "utf8").startsWith('"use client";');
}

const manifest = {
  version: "1.0.0",
  generated: new Date().toISOString(),
  components: componentRegistry.map((entry) => {
    const classNames = extractClassNames(entry.recipe);
    return {
      name: entry.name,
      className: entry.recipe.className,
      clientOnly: isClientOnly(entry.modulePath),
      import: "@zevaui/components",
      slots: [],
      variants: extractVariants(entry.recipe),
      classNames,
      // Scoped to this component's own rules: reporting what it ACTUALLY consumes rather than
      // everything the package happens to reference.
      tokens: consumedTokens(css, classNames),
    };
  }),
};

writeFileSync(join(distDir, "components.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
