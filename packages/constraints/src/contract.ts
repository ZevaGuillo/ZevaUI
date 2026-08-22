import contractData from "./contract.json" with { type: "json" };

export type ContrastPair = { readonly foreground: string; readonly background: string };

export type ThemeRule = { readonly minContrastRatio: number };

export type ThemeContract = {
  readonly version: string;
  readonly defaultMinContrastRatio: number;
  readonly themes: Readonly<Record<string, ThemeRule>>;
  readonly tokenTypes: Readonly<Record<string, readonly string[]>>;
  readonly scales: Readonly<Record<string, readonly string[]>>;
  readonly contrastPairs: readonly ContrastPair[];
  // Sibling pair class for WCAG 1.4.11 (non-text contrast, 3.0:1). Distinct
  // from contrastPairs because 1.4.11 has no theme-scoped floor: the same
  // flat nonTextMinContrastRatio applies to every theme, including
  // high-contrast, which never gets a non-text AAA tier.
  readonly nonTextContrastPairs: readonly ContrastPair[];
  readonly nonTextMinContrastRatio: number;
};

// An annotation, never a cast: this is what type-checks the JSON at build
// time. A cast would silently accept a malformed contract.
export const contract: ThemeContract = contractData;

// Order-preserving dedup over the union of both pair classes, so
// requiredTokens can never drift from the tokens either class declares.
export const requiredTokens: readonly string[] = dedupeTokens([
  ...contract.contrastPairs,
  ...contract.nonTextContrastPairs,
]);

export function minContrastRatioFor(themeId: string): number {
  return contract.themes[themeId]?.minContrastRatio ?? contract.defaultMinContrastRatio;
}

function dedupeTokens(pairs: readonly ContrastPair[]): readonly string[] {
  const seen = new Set<string>();
  for (const pair of pairs) {
    seen.add(pair.foreground);
    seen.add(pair.background);
  }
  return [...seen];
}
