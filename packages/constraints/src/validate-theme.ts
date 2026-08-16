import { contrastRatio } from "./color/contrast.js";
import { relativeLuminance } from "./color/luminance.js";
import { parseColor } from "./color/parse.js";
import type { ContrastPair } from "./contract.js";
import { contract, minContrastRatioFor, requiredTokens } from "./contract.js";

export type Theme = { readonly id: string; readonly colors: Readonly<Record<string, string>> };

export type ViolationRule = "missing-token" | "invalid-color" | "low-contrast";

export type Violation = {
  readonly rule: ViolationRule;
  readonly tokens: readonly [string] | readonly [string, string];
  readonly expected: string;
  readonly actual: string;
  readonly message: string;
};

export type ValidationResult = {
  readonly pass: boolean;
  readonly violations: readonly Violation[];
};

type ResolvedLuminances = { luminances: Map<string, number>; violations: Violation[] };

export function validateTheme(theme: Theme): ValidationResult {
  const resolved = resolveLuminances(theme.colors);
  const violations = [...resolved.violations, ...checkContrast(resolved.luminances, theme.id)];
  return { pass: violations.length === 0, violations };
}

function resolveLuminances(colors: Readonly<Record<string, string>>): ResolvedLuminances {
  const luminances = new Map<string, number>();
  const violations: Violation[] = [];

  for (const token of requiredTokens) {
    const raw = colors[token];
    if (raw === undefined) {
      violations.push(missingToken(token));
      continue;
    }
    const parsed = parseColor(raw);
    if (parsed === undefined) {
      violations.push(invalidColor(token, raw));
      continue;
    }
    luminances.set(token, relativeLuminance(parsed));
  }

  return { luminances, violations };
}

function checkContrast(luminances: Map<string, number>, themeId: string): Violation[] {
  const minRatio = minContrastRatioFor(themeId);
  const violations: Violation[] = [];

  for (const pair of contract.contrastPairs) {
    const fg = luminances.get(pair.foreground);
    const bg = luminances.get(pair.background);
    if (fg === undefined || bg === undefined) continue;

    const ratio = contrastRatio(fg, bg);
    if (ratio < minRatio) violations.push(lowContrast(pair, ratio, minRatio));
  }

  return violations;
}

function missingToken(token: string): Violation {
  return {
    rule: "missing-token",
    tokens: [token],
    expected: "present",
    actual: "missing",
    message: `Theme is missing required token "${token}".`,
  };
}

function invalidColor(token: string, value: string): Violation {
  return {
    rule: "invalid-color",
    tokens: [token],
    expected: "a parseable color",
    actual: value,
    message: `Token "${token}" has an unparseable color value: "${value}".`,
  };
}

function lowContrast(pair: ContrastPair, actual: number, required: number): Violation {
  const expected = required.toFixed(1);
  const actualDisplay = actual.toFixed(2);
  return {
    rule: "low-contrast",
    tokens: [pair.foreground, pair.background],
    expected,
    actual: actualDisplay,
    message: `Contrast between "${pair.foreground}" and "${pair.background}" is ${actualDisplay}, below the required ${expected}.`,
  };
}
