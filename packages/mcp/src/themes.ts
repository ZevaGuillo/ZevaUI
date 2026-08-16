import type { Theme } from "@zevaui/constraints";
import tokens, { themeIds, themeKeyOf } from "@zevaui/tokens";

export { themeIds };

export type ThemeId = (typeof themeIds)[number];

/**
 * Resolves a theme id to its full token set.
 *
 * `id` is passed through unchanged (kebab-case) since `validateTheme` uses it
 * only to look up the contrast threshold — translating it to the JS key
 * spelling here would silently select the wrong bucket downstream.
 */
export const themeFor = (id: ThemeId): Theme => ({ id, colors: tokens[themeKeyOf[id]] });
