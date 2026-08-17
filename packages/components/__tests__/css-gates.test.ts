import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buttonRecipe } from "../src/button/button.recipe.js";
import { variantClassName } from "../src/internal/recipe-class.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(packageRoot, "dist", "styles.css"), "utf8");

const tokensCssPath = createRequire(import.meta.url).resolve("@zevaui/tokens/styles.css");
const tokensCss = readFileSync(tokensCssPath, "utf8");

// Extracts the raw contents between the matching braces of `@layer <layerName> { ... }`,
// tolerant of nested rules/selectors inside the layer.
function extractLayer(source: string, layerName: string): string {
  const marker = `@layer ${layerName}`;
  const markerStart = source.indexOf(marker);
  if (markerStart === -1) {
    throw new Error(`@layer ${layerName} was not found in the emitted CSS`);
  }
  const openBrace = source.indexOf("{", markerStart);
  let depth = 0;
  for (let i = openBrace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBrace + 1, i);
    }
  }
  throw new Error(`@layer ${layerName} has no matching closing brace`);
}

const tokensLayer = extractLayer(css, "tokens");
const tokenDeclarations = tokensLayer.match(/--[\w-]+:\s*[^;]+;/g) ?? [];

describe("G1: the token layer is a pure zuip -> zui var() bridge", () => {
  it("declares at least one custom property", () => {
    expect(tokenDeclarations.length).toBeGreaterThan(0);
  });

  it("every declaration is a zero-literal-payload var() pointer", () => {
    for (const declaration of tokenDeclarations) {
      const normalized = declaration.replace(/;$/, "").trim();
      expect(normalized).toMatch(/^--zuip-[a-z0-9-]+:\s*var\(--zui-[a-z0-9-]+\)$/);
    }
  });

  it("actually lands the zuip cssVar prefix", () => {
    expect(tokenDeclarations.some((declaration) => declaration.startsWith("--zuip-"))).toBe(true);
  });
});

describe("G2: no foreign palette or literal colors leak into the emitted CSS", () => {
  it("contains no hex colors", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("contains no rgb/hsl/oklch/lab color functions", () => {
    expect(css).not.toMatch(/\b(rgb|hsl|oklch|lab)\(/);
  });
});

describe("G3: preflight stays disabled (ADR-0001 D5)", () => {
  it("emits no reset layer", () => {
    expect(css).not.toMatch(/@layer\s+reset\b/);
  });

  it("emits no universal selector", () => {
    expect(css).not.toMatch(/(^|[\s,{}])\*\s*[,{]/);
  });

  it("emits no bare html or body selector", () => {
    expect(css).not.toMatch(/(^|[\s,{}])html\s*\{/);
    expect(css).not.toMatch(/(^|[\s,{}])body\s*\{/);
  });
});

describe("G4: every var(--zui-*) reference resolves against @zevaui/tokens", () => {
  const declaredZuiNames = new Set(
    Array.from(tokensCss.matchAll(/(?:^|\n)\s*(--zui-[a-z0-9-]+)\s*:/g)).map((match) => match[1]),
  );

  it("found at least one declared upstream token (sanity check)", () => {
    expect(declaredZuiNames.size).toBeGreaterThan(0);
  });

  it("resolves every var(--zui-*) usage to a real @zevaui/tokens declaration", () => {
    const used = Array.from(css.matchAll(/var\((--zui-[a-z0-9-]+)\)/g)).map((match) => match[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      expect(declaredZuiNames.has(name)).toBe(true);
    }
  });
});

describe("G5: every declared recipe variant renders a matching rule", () => {
  it("emits the base .zui-button rule", () => {
    expect(css).toMatch(new RegExp(`\\.${buttonRecipe.className}\\s*\\{`));
  });

  it("emits a rule for every declared variant value, driven off the recipe itself", () => {
    for (const [axis, values] of Object.entries(buttonRecipe.variants)) {
      for (const value of Object.keys(values)) {
        const selector = variantClassName(buttonRecipe.className, axis, value);
        expect(css).toMatch(new RegExp(`\\.${selector}\\s*\\{`));
      }
    }
  });
});
