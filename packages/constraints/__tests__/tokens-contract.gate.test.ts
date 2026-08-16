import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { contract } from "../src/contract.js";
import type { Theme } from "../src/index.js";
import { validateTheme } from "../src/index.js";

type ManifestToken = {
  readonly name: string;
  readonly type: string;
  readonly values: Record<string, string>;
};
type Manifest = { readonly themes: readonly string[]; readonly tokens: readonly ManifestToken[] };

const manifestPath = createRequire(import.meta.url).resolve("@zevaui/tokens/tokens.manifest.json");
const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// BA-10: the manifest keys theme VALUES by JS identifier, while the contract,
// the CSS selectors and manifest.themes use the kebab id. This object is the
// ONLY place that mapping exists anywhere in the repository.
const MANIFEST_VALUE_KEY: Record<string, string> = {
  light: "light",
  dark: "dark",
  "high-contrast": "highContrast",
};

const themeFrom = (themeId: string): Theme => ({
  id: themeId,
  colors: Object.fromEntries(
    manifest.tokens.map((t) => [t.name, t.values[MANIFEST_VALUE_KEY[themeId]]]),
  ),
});

describe.each(manifest.themes)("%s theme", (themeId: string) => {
  it("satisfies the declared contrast contract", () => {
    const result = validateTheme(themeFrom(themeId));
    expect(result.violations).toEqual([]);
    expect(result.pass).toBe(true);
  });
});

describe("manifest / contract type agreement", () => {
  const declaredType = new Map(
    Object.entries(contract.tokenTypes).flatMap(([type, names]) => names.map((n) => [n, type])),
  );

  it("declares a type for every semantic token", () => {
    expect(manifest.tokens.map((t) => [t.name, t.type])).toEqual(
      manifest.tokens.map((t) => [t.name, declaredType.get(t.name)]),
    );
  });
});
