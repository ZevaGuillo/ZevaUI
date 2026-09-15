import type { CssKeyframes, RecipeConfig, SlotRecipeConfig } from "@pandacss/dev";
import { ALERT_RECIPE_KEY, alertRecipe } from "./alert/alert.recipe.js";
import { BADGE_RECIPE_KEY, badgeRecipe } from "./badge/badge.recipe.js";
import { BUTTON_RECIPE_KEY, buttonRecipe } from "./button/button.recipe.js";
import { CARD_RECIPE_KEY, cardRecipe } from "./card/card.recipe.js";
import { CHECKBOX_RECIPE_KEY, checkboxRecipe } from "./checkbox/checkbox.recipe.js";
import { DIALOG_RECIPE_KEY, dialogRecipe } from "./dialog/dialog.recipe.js";
import { INPUT_RECIPE_KEY, inputRecipe } from "./input/input.recipe.js";
import { MENU_RECIPE_KEY, menuRecipe } from "./menu/menu.recipe.js";
import {
  PROGRESS_RECIPE_KEY,
  progressKeyframes,
  progressRecipe,
} from "./progress/progress.recipe.js";
import { RADIO_GROUP_RECIPE_KEY, radioGroupRecipe } from "./radio-group/radio-group.recipe.js";
import { SELECT_RECIPE_KEY, selectRecipe } from "./select/select.recipe.js";
import {
  SKELETON_RECIPE_KEY,
  skeletonKeyframes,
  skeletonRecipe,
} from "./skeleton/skeleton.recipe.js";
import { SPINNER_RECIPE_KEY, spinnerKeyframes, spinnerRecipe } from "./spinner/spinner.recipe.js";
import { SWITCH_RECIPE_KEY, switchRecipe } from "./switch/switch.recipe.js";
import { TEXTAREA_RECIPE_KEY, textareaRecipe } from "./textarea/textarea.recipe.js";

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
  /**
   * Optional deprecation notice (RF-AR04, design D7). Richer than a boolean so the manifest —
   * and eventually the adoption panel — can say "use X instead", per RNF-09's migration-guide
   * culture. Absent by default: no component in `componentRegistry` sets this in this PR: the
   * field only ships the mechanism, `scripts/build-manifest.js` emits it additively.
   */
  readonly deprecated?: {
    readonly since: string;
    readonly replacement?: string;
    readonly note?: string;
  };
  /**
   * `@keyframes` this component's recipe runs, keyed by animation name.
   *
   * Declared beside the recipe and carried here rather than hand-registered in `panda.config.ts`,
   * for the same reason the recipe itself is: registering a component has to stay ONE entry plus
   * one directory, and a config that hand-lists animations would quietly re-introduce a second
   * place to remember. `panda.config.ts` merges every entry's keyframes into `theme.keyframes`.
   *
   * Absent by default — a transition needs no keyframes, and nine of the components here use
   * nothing else. `Progress` is the first that cannot: a looping sweep has no start and end state
   * a transition could interpolate between.
   */
  readonly keyframes?: CssKeyframes;
};

/**
 * One entry's keyframes, read through the declared entry type.
 *
 * `componentRegistry` is `as const satisfies`, so each entry keeps its own literal type and the
 * array's element type is a UNION in which only some members declare `keyframes` at all — reading
 * the property off that union directly is a type error, no matter that the declared entry type
 * marks it optional. Widening the whole registry to `ComponentRegistryEntry[]` to dodge that would
 * throw away the literal recipe types every other derivation depends on, so the widening is
 * confined to this one parameter instead. `deprecated` would need the same treatment the day a
 * TypeScript consumer reads it; today only the JS manifest builder does.
 */
export const keyframesOf = (entry: ComponentRegistryEntry): CssKeyframes => entry.keyframes ?? {};

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
  // The first markable control, and the shape Switch and RadioGroup are meant to inherit. A slot
  // recipe like Input, but its state lands on the ROOT rather than on the styled part, because
  // that is where react-aria-components puts it — see the argument in checkbox.recipe.ts.
  {
    name: "Checkbox",
    recipeKey: CHECKBOX_RECIPE_KEY,
    recipe: checkboxRecipe,
    modulePath: "checkbox/Checkbox.js",
    clientOnly: true,
  },
  // The second markable control. It inherits Checkbox's shape — a slot recipe whose state
  // attributes are stamped on the styled part rather than read from an ancestor — but is built on
  // SwitchField + SwitchButton, because RAC 1.20 deprecates the flat `Switch` AND omits
  // `isRequired`/`isInvalid` from its props. See the argument in Switch.tsx.
  {
    name: "Switch",
    recipeKey: SWITCH_RECIPE_KEY,
    recipe: switchRecipe,
    modulePath: "switch/Switch.js",
    clientOnly: true,
  },
  // The third markable control, and the first that is a GROUP: `isRequired`/`isInvalid` live on
  // the group rather than on any one option, which is where RAC 1.20 puts them and the opposite
  // of what Checkbox and Switch do. See the argument in radio-group.recipe.ts.
  {
    name: "RadioGroup",
    recipeKey: RADIO_GROUP_RECIPE_KEY,
    recipe: radioGroupRecipe,
    modulePath: "radio-group/RadioGroup.js",
    clientOnly: true,
  },
  // The second text surface, and the first entry added after three markable controls in a row.
  // It goes back to Input's shape — a slot recipe wrapping RAC's `TextField` — because `TextArea`
  // reuses `InputRenderProps` verbatim in RAC 1.20, so the two share their state attributes
  // exactly. Its own recipe all the same: see the argument in textarea.recipe.ts.
  {
    name: "Textarea",
    recipeKey: TEXTAREA_RECIPE_KEY,
    recipe: textareaRecipe,
    modulePath: "textarea/Textarea.js",
    clientOnly: true,
  },
  // The first entry that is BOTH a field and an overlay: it owes Input its resting appearance and
  // Menu its raised surface, and is the first collection in this package that exposes SELECTION,
  // so `[data-selected]` on a row is styled here for the first time (menu.recipe.ts documents it
  // as unreachable for Menu). It is also the first control of any kind with an open/closed state:
  // `[data-open]` lands on the ROOT, so Select.tsx stamps it onto the trigger and the chevron
  // rather than reading it off an ancestor — see the argument in select.recipe.ts.
  {
    name: "Select",
    recipeKey: SELECT_RECIPE_KEY,
    recipe: selectRecipe,
    modulePath: "select/Select.js",
    clientOnly: true,
  },
  // The first FEEDBACK component, and the first of any kind whose appearance is driven by a
  // runtime number rather than by a variant or a state attribute — so it is also the first to
  // render an inline style (the fill's width) and the first to declare `keyframes`, since a
  // looping sweep has no pair of states a transition could interpolate between. It is
  // `clientOnly: true` for a reason that needs no judgement call: RAC 1.20's
  // `dist/exports/ProgressBar.d.ts` does `import 'client-only'`, so importing it from a React
  // Server Component is a build-time error upstream.
  {
    name: "Progress",
    recipeKey: PROGRESS_RECIPE_KEY,
    recipe: progressRecipe,
    modulePath: "progress/Progress.js",
    clientOnly: true,
    keyframes: progressKeyframes,
  },
  // The first component since Alert that is neither a control nor a container: a short label with
  // a background and nothing else. It is also the first `clientOnly: false` entry added after five
  // client components in a row, which is the half of ADR-0001 D3 that had only Card and Alert
  // exercising it. Its tone is a BACKGROUND only — never a text colour — for the contrast reason
  // measured on Alert; see badge.recipe.ts.
  {
    name: "Badge",
    recipeKey: BADGE_RECIPE_KEY,
    recipe: badgeRecipe,
    modulePath: "badge/Badge.js",
    clientOnly: false,
  },
  // The first entry that is BOTH server-renderable and animated: it declares `keyframes` like
  // Progress does, but carries no "use client" directive, because nothing in it imports
  // react-aria-components. It is also the first component whose entire public API exists to
  // replace the `className` this package refuses to expose — `shape` and `width` are the typed
  // stand-ins for the utility classes every other skeleton library sizes itself with. See
  // skeleton.recipe.ts for why there is no `circle` shape and no length scale.
  {
    name: "Skeleton",
    recipeKey: SKELETON_RECIPE_KEY,
    recipe: skeletonRecipe,
    modulePath: "skeleton/Skeleton.js",
    clientOnly: false,
    keyframes: skeletonKeyframes,
  },
  // The SECOND component built on react-aria-components' `ProgressBar`, and therefore the first
  // time two entries here share a primitive. What they genuinely share now lives in
  // `internal/progress-surface.ts`, extracted on arrival rather than in advance — the same rule
  // `internal/text-surface.ts` was written under when `Textarea` joined `Input`.
  //
  // It is `clientOnly: true` for the same non-negotiable reason Progress is: RAC 1.20's
  // `dist/types/exports/ProgressBar.d.ts` does `import 'client-only'`.
  //
  // Together with Progress and Skeleton it is one of three entries declaring `keyframes`, which
  // `panda.config.ts` merges into one map with `Object.assign` — so a duplicate animation name
  // would silently overwrite. `__tests__/spinner.test.ts` asserts the names across this registry
  // are unique, a check that could not have existed while only one entry had any.
  {
    name: "Spinner",
    recipeKey: SPINNER_RECIPE_KEY,
    recipe: spinnerRecipe,
    modulePath: "spinner/Spinner.js",
    clientOnly: true,
    keyframes: spinnerKeyframes,
  },
] as const satisfies readonly ComponentRegistryEntry[];
