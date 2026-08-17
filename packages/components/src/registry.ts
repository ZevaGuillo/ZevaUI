import type { RecipeConfig } from "@pandacss/dev";
import { BUTTON_RECIPE_KEY, buttonRecipe } from "./button/button.recipe.js";

/**
 * One declaration per component, consumed by everything that used to hardcode "Button":
 * `panda.config.ts` (recipes + staticCss), `scripts/build-manifest.js`, and the manifest
 * and CSS gates. Adding a component means adding one entry here plus its own directory.
 *
 * This module must stay free of `.tsx` imports: `panda.config.ts` loads it at config time,
 * and pulling React / react-aria-components into that load is not acceptable. The built
 * component module is therefore referenced by path (`modulePath`), never imported.
 */
export type ComponentRegistryEntry = {
  /** Exported component name, exactly as `src/index.ts` exports it. */
  readonly name: string;
  /** Key the recipe is registered under in `panda.config.ts`. */
  readonly recipeKey: string;
  /** The recipe that owns the component's className, variants and emitted CSS. */
  readonly recipe: RecipeConfig;
  /** Built component module, relative to `dist` (e.g. "button/Button.js"). */
  readonly modulePath: string;
};

// `as const satisfies` (not a type annotation) keeps each entry's literal recipe type intact,
// the same reason the recipes themselves use `satisfies RecipeConfig`.
export const componentRegistry = [
  {
    name: "Button",
    recipeKey: BUTTON_RECIPE_KEY,
    recipe: buttonRecipe,
    modulePath: "button/Button.js",
  },
] as const satisfies readonly ComponentRegistryEntry[];
