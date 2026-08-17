import { defineConfig, type RecipeConfig } from "@pandacss/dev";
import { componentRegistry } from "./src/registry";

// Derived, never a literal list (ADR-0004 D4): a value added to a recipe is emitted on the
// next build, and gate G5 (see __tests__/css-gates.test.ts) fails if this drifts.
const allVariantValues = (recipe: RecipeConfig): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(recipe.variants ?? {}).map(([axis, values]) => [axis, Object.keys(values)]),
  );

// Both maps come from src/registry.ts, so registering a component is one entry, not three edits.
const recipes = Object.fromEntries(
  componentRegistry.map((entry): [string, RecipeConfig] => [entry.recipeKey, entry.recipe]),
);

const staticCssRecipes = Object.fromEntries(
  componentRegistry.map((entry): [string, Array<Record<string, string[]>>] => [
    entry.recipeKey,
    [allVariantValues(entry.recipe)],
  ]),
);

// var(--zui-*) POINTERS ONLY — zero literal payload. G1 rejects anything else.
const ref = (name: string) => ({ value: `var(--zui-${name})` });

export default defineConfig({
  eject: true,
  // `@pandacss/preset-base` supplies the CSS-property -> token-category utility mappings
  // (backgroundColor -> colors, borderRadius -> radii, ...) without a default theme, unlike
  // `@pandacss/preset-panda`. Cost: it also unconditionally ships ~35 inert custom-property
  // defaults (--blur, --translate-x, --scale-x, --scroll-snap-strictness, ...) on a
  // `*, ::before, ::after, ::backdrop` rule, so its composable filter/transform/backdrop-filter
  // utilities compose even though this recipe never uses them, plus a `--made-with-panda`
  // branding variable. None of it is a real CSS property (see G3 in __tests__/css-gates.test.ts),
  // so it changes nothing a consumer renders, but it is real bytes shipped in every consumer's
  // CSS. It cannot be cancelled via `globalCss: {}` here — @pandacss/config deep-merges
  // `globalCss` across presets and does not support key deletion. If RNF-02's bundle budget
  // ever makes this a real constraint, `panda cssgen --splitting` plus a concatenation step
  // that drops the `base`/`global` layer outputs is the documented lever; not built here.
  presets: ["@pandacss/preset-base"],
  preflight: false,
  // Only the cssVar axis is prefixed by Panda itself: the recipe's own `className`
  // ("zui-button") already carries the brand prefix literally. Also setting
  // `prefix.className` here double-prefixes every recipe selector into
  // ".zui-zui-button" — verified against real 1.12.0 output, not assumed.
  prefix: { cssVar: "zuip" },
  include: ["./src/**/*.{ts,tsx}"],
  outdir: "styled-system",
  outExtension: "js",
  theme: {
    tokens: {
      colors: {
        accent: {
          default: ref("color-accent-default"),
          subtle: ref("color-accent-subtle"),
          strong: ref("color-accent-strong"),
        },
        danger: {
          default: ref("color-danger-default"),
          subtle: ref("color-danger-subtle"),
        },
        text: {
          default: ref("color-text-default"),
          inverse: ref("color-text-inverse"),
        },
        bg: {
          surface: ref("color-bg-surface"),
        },
        border: {
          default: ref("color-border-default"),
        },
        focusRing: ref("color-focus-ring"),
      },
      radii: {
        button: ref("radius-button"),
      },
      spacing: {
        button: {
          px: ref("space-button-px"),
          py: ref("space-button-py"),
        },
      },
      fonts: {
        body: ref("font-body-family"),
      },
      fontSizes: {
        body: ref("font-body-size"),
      },
      fontWeights: {
        body: ref("font-body-weight"),
      },
      lineHeights: {
        body: ref("font-body-line-height"),
      },
    },
    recipes,
  },
  staticCss: { recipes: staticCssRecipes },
});
