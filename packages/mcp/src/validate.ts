import { type ValidationResult, validateTheme } from "@zevaui/constraints";
import { type ThemeId, themeFor } from "./themes.js";

export type ValidateThemeInput = {
  readonly theme: ThemeId;
  readonly colors?: Readonly<Record<string, string>>;
};

/**
 * Validates a theme request against the contrast contract.
 *
 * When `colors` is omitted, this self-checks the built-in palette for
 * `theme`. When `colors` is provided, it validates that candidate palette
 * against the threshold selected by `theme`.
 */
export function validateThemeRequest(input: ValidateThemeInput): ValidationResult {
  const { theme, colors } = input;
  return validateTheme(colors === undefined ? themeFor(theme) : { id: theme, colors });
}
