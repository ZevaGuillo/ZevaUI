// Emits dist/components.manifest.json. Runs AFTER `tsc` and `panda cssgen`, and reads only
// generated output (dist/**/*.js, dist/styles.css) — never a source .tsx file. ADR-0001 D8
// requires the MCP server to read generated manifests, never scan source.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildManifestEntry } from "./manifest-entry.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");

// src/registry.ts is the single declaration of what ships; this script never names a component.
const { componentRegistry, isSlotRecipe } = await import(
  pathToFileURL(join(distDir, "registry.js"))
);
const { variantClassName } = await import(
  pathToFileURL(join(distDir, "internal", "recipe-class.js"))
);
const { emittedSlotClassNames } = await import(
  pathToFileURL(join(distDir, "internal", "slot-recipe-class.js"))
);
const { consumedTokens } = await import(
  pathToFileURL(join(distDir, "internal", "consumed-tokens.js"))
);

const css = readFileSync(join(distDir, "styles.css"), "utf8");

// Derived from the recipe via variantClassName, mirroring the same convention `recipeClassName`
// uses at runtime — never a hand-maintained literal list.
function singlePartClassNames(recipe) {
  const classNames = new Set([recipe.className]);
  for (const [axis, values] of Object.entries(recipe.variants)) {
    for (const value of Object.keys(values)) {
      classNames.add(variantClassName(recipe.className, axis, value));
    }
  }
  return [...classNames];
}

// A slot recipe's classes are per slot, and only for the slots each declaration actually styles
// — `emittedSlotClassNames` owns that (measured) rule so the manifest lists exactly the classes
// that have a rule in dist/styles.css, which is what the manifest gate and G5 both check.
function extractClassNames(recipe) {
  return isSlotRecipe(recipe) ? emittedSlotClassNames(recipe) : singlePartClassNames(recipe);
}

// Derived, never declared on the registry entry: a single-part component reports no slots
// because its recipe has none, not because someone remembered to write an empty array.
function extractSlots(recipe) {
  return isSlotRecipe(recipe) ? [...recipe.slots] : [];
}

// Both recipe shapes key their variants identically (axis -> value -> styles), so the variant
// contract is read the same way for a slot recipe as for a single-part one.
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
    return buildManifestEntry(entry, {
      clientOnly: isClientOnly(entry.modulePath),
      slots: extractSlots(entry.recipe),
      variants: extractVariants(entry.recipe),
      classNames,
      // Scoped to this component's own rules: reporting what it ACTUALLY consumes rather than
      // everything the package happens to reference.
      tokens: consumedTokens(css, classNames),
    });
  }),
};

writeFileSync(join(distDir, "components.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
