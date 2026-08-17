import type { RecipeConfig, SlotRecipeConfig } from "@pandacss/dev";
import { BUTTON_RECIPE_KEY, buttonRecipe } from "./button/button.recipe.js";
import { DIALOG_RECIPE_KEY, dialogRecipe } from "./dialog/dialog.recipe.js";
import { INPUT_RECIPE_KEY, inputRecipe } from "./input/input.recipe.js";

/**
 * One declaration per component, consumed by everything that used to hardcode "Button":
 * `panda.config.ts` (recipes + staticCss), `scripts/build-manifest.js`, and the manifest
 * and CSS gates. Adding a component means adding one entry here plus its own directory.
 *
 * This module must stay free of `.tsx` imports: `panda.config.ts` loads it at config time,
 * and pulling React / react-aria-components into that load is not acceptable. The built
 * component module is therefore referenced by path (`modulePath`), never imported.
 */
/**
 * A component is either single-part or multi-part, and the recipe itself says which: Panda's
 * `SlotRecipeConfig` declares `slots`, `RecipeConfig` does not. Discriminating on the recipe
 * rather than on a flag keeps a single-part entry as terse as it ever was — no empty slot
 * metadata to declare — and keeps the manifest's `slots` array DERIVED from the recipe rather
 * than hand-written, the same rule ADR-0004 D4 sets for `staticCss`.
 */
export type ComponentRecipe = RecipeConfig | SlotRecipeConfig;

/** The least a value must look like to be one of Panda's two recipe configs. */
type RecipeLike = { readonly className: string };

/**
 * The recipe shapes part: a slot recipe is exactly the one that declares slots.
 *
 * Generic on purpose. `componentRegistry` is `as const`, so each entry's `recipe` keeps its own
 * literal type — the type derivations depend on that — and a guard returning the bare
 * `SlotRecipeConfig` would throw that literal away and force a cast back at every call site.
 * Intersecting instead preserves it, and lets the gates apply the same one discriminator to the
 * synthetic recipe fixtures they test the slot branch with.
 */
export const isSlotRecipe = <T extends RecipeLike>(recipe: T): recipe is T & SlotRecipeConfig =>
  "slots" in recipe;

export type ComponentRegistryEntry = {
  /** Exported component name, exactly as `src/index.ts` exports it. */
  readonly name: string;
  /** Key the recipe is registered under in `panda.config.ts`. */
  readonly recipeKey: string;
  /**
   * The recipe that owns the component's className, variants, slots and emitted CSS.
   * A slot recipe lands in `theme.slotRecipes`, a single-part one in `theme.recipes`.
   */
  readonly recipe: ComponentRecipe;
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
  // The first multi-part entry, and therefore the first real exercise of the slot branch that
  // `isSlotRecipe` partitions: it lands in `theme.slotRecipes` and reports its slots in the
  // manifest, both derived from the recipe rather than declared here.
  {
    name: "Input",
    recipeKey: INPUT_RECIPE_KEY,
    recipe: inputRecipe,
    modulePath: "input/Input.js",
  },
  {
    name: "Dialog",
    recipeKey: DIALOG_RECIPE_KEY,
    recipe: dialogRecipe,
    modulePath: "dialog/Dialog.js",
  },
] as const satisfies readonly ComponentRegistryEntry[];
