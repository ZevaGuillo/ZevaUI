import type { RecipeConfig, SlotRecipeConfig } from "@pandacss/dev";
import { ALERT_RECIPE_KEY, alertRecipe } from "./alert/alert.recipe.js";
import { BUTTON_RECIPE_KEY, buttonRecipe } from "./button/button.recipe.js";
import { CARD_RECIPE_KEY, cardRecipe } from "./card/card.recipe.js";
import { DIALOG_RECIPE_KEY, dialogRecipe } from "./dialog/dialog.recipe.js";
import { INPUT_RECIPE_KEY, inputRecipe } from "./input/input.recipe.js";
import { MENU_RECIPE_KEY, menuRecipe } from "./menu/menu.recipe.js";

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
  /**
   * Whether the built module MUST start with the `"use client"` directive.
   *
   * Declared here — never derived — because there is nothing else to derive it FROM without
   * making the check that reads it circular: G6 in `__tests__/emit-gates.test.ts` needs to
   * compare the built artifact's actual first bytes against an EXPECTATION, and reading those
   * same bytes for both sides of that comparison would make the gate trivially true. This field
   * is that expectation. `scripts/build-manifest.js`'s own `isClientOnly` keeps reading the built
   * module directly for the manifest's `clientOnly` field, on purpose — the manifest reports what
   * the artifact actually shipped, not what this field predicted it would.
   */
  readonly clientOnly: boolean;
};

// `as const satisfies` (not a type annotation) keeps each entry's literal recipe type intact,
// the same reason the recipes themselves use `satisfies RecipeConfig`.
export const componentRegistry = [
  {
    name: "Button",
    recipeKey: BUTTON_RECIPE_KEY,
    recipe: buttonRecipe,
    modulePath: "button/Button.js",
    clientOnly: true,
  },
  // The first multi-part entry, and therefore the first real exercise of the slot branch that
  // `isSlotRecipe` partitions: it lands in `theme.slotRecipes` and reports its slots in the
  // manifest, both derived from the recipe rather than declared here.
  {
    name: "Input",
    recipeKey: INPUT_RECIPE_KEY,
    recipe: inputRecipe,
    modulePath: "input/Input.js",
    clientOnly: true,
  },
  {
    name: "Dialog",
    recipeKey: DIALOG_RECIPE_KEY,
    recipe: dialogRecipe,
    modulePath: "dialog/Dialog.js",
    clientOnly: true,
  },
  {
    name: "Menu",
    recipeKey: MENU_RECIPE_KEY,
    recipe: menuRecipe,
    modulePath: "menu/Menu.js",
    clientOnly: true,
  },
  // The first server-renderable entry: `Card.tsx` carries no "use client" directive because it
  // needs no react-aria-components and no hooks (see Card.tsx). `clientOnly: false` here is what
  // G6 in __tests__/emit-gates.test.ts checks the built module against; the manifest's own
  // `clientOnly` field keeps reading the built module directly (see build-manifest.js).
  {
    name: "Card",
    recipeKey: CARD_RECIPE_KEY,
    recipe: cardRecipe,
    modulePath: "card/Card.js",
    clientOnly: false,
  },
  // The second server-renderable entry, and the first single-part (flat) recipe registered after
  // Button: Alert carries no "use client" directive either, for the same reason Card does not —
  // see alert/Alert.tsx.
  {
    name: "Alert",
    recipeKey: ALERT_RECIPE_KEY,
    recipe: alertRecipe,
    modulePath: "alert/Alert.js",
    clientOnly: false,
  },
] as const satisfies readonly ComponentRegistryEntry[];
