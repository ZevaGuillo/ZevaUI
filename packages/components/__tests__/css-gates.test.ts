import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { variantClassName } from "../src/internal/recipe-class.js";
import { componentRegistry } from "../src/registry.js";

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

// Finds the raw contents between the matching braces of the block that opens at
// `source[openBraceIndex]` (which must be a "{").
function extractBlockAt(source: string, openBraceIndex: number): string {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBraceIndex + 1, i);
    }
  }
  throw new Error("block has no matching closing brace");
}

const isUniversalSelector = (selectorText: string) =>
  /(^|[\s,])\*($|[\s,])/.test(`${selectorText} `);

// Collects the body of every rule whose selector list contains a standalone `*`
// (the universal selector), regardless of nesting depth.
function universalSelectorRuleBodies(source: string): string[] {
  const bodies: string[] = [];
  for (const match of source.matchAll(/([^{}]*)\{/g)) {
    const selectorText = match[1];
    if (!isUniversalSelector(selectorText)) continue;
    const matchIndex = match.index ?? -1;
    if (matchIndex === -1) continue;
    const openBraceIndex = matchIndex + match[0].length - 1;
    bodies.push(extractBlockAt(source, openBraceIndex));
  }
  return bodies;
}

describe("G3: no global CSS reset ships (ADR-0001 D5)", () => {
  // `@pandacss/preset-base` unconditionally emits a `*, ::before, ::after, ::backdrop` rule
  // with ~35 custom-property defaults (--blur, --translate-x, --scale-x, --scroll-snap-strictness,
  // ...) plus a `--made-with-panda` branding variable, so its composable filter/transform/
  // backdrop-filter utilities compose safely even when a consuming recipe never reaches for
  // them (this recipe doesn't). It ships regardless of `preflight`, and is not something
  // `globalCss: {}` in our own config can cancel (verified: @pandacss/config deep-merges
  // `globalCss` across presets, it does not support key deletion). Those ~35 lines are inert
  // — every declaration is a custom property, none of them a real CSS property — so nothing a
  // consumer renders changes. If RNF-02's bundle budget ever makes those bytes a real problem,
  // `panda cssgen --splitting` plus a concatenation step that drops the `base`/`global` layer
  // outputs is the documented lever; not built here, since ~35 inert lines don't justify the
  // extra build machinery yet.
  //
  // D5 forbids a global reset that changes how a consumer's page renders — not the presence of
  // a universal selector as such. So this gate asserts the property D5 actually cares about:
  // every declaration reachable through a global/universal-selector rule must be a custom
  // property. A single non-custom-property declaration there (margin, box-sizing, font-size,
  // color, ...) is a real visual reset and must fail this gate — do not loosen it back to a
  // bare "no universal selector at all" check if this ever turns red.
  it("has no @layer reset block with content (the bare cascade-order statement is fine)", () => {
    expect(css).not.toMatch(/@layer\s+reset\s*\{/);
  });

  it("every declaration inside a global/universal-selector rule is an inert custom property", () => {
    const bodies = universalSelectorRuleBodies(css);
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      const lines = body.split("\n").filter((line) => line.trim().length > 0);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line).toMatch(/^\s*--[a-z-]+\s*:/);
      }
    }
  });

  it("emits no bare html or body selector", () => {
    expect(css).not.toMatch(/(^|[\s,{}])html\s*\{/);
    expect(css).not.toMatch(/(^|[\s,{}])body\s*\{/);
  });
});

function capturedNames(source: string, pattern: RegExp): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(pattern)) {
    const [, name] = match;
    if (name !== undefined) names.push(name);
  }
  return names;
}

describe("G4: every var(--zui-*) reference resolves against @zevaui/tokens", () => {
  const declaredZuiNames = new Set(capturedNames(tokensCss, /(?:^|\n)\s*(--zui-[a-z0-9-]+)\s*:/g));

  it("found at least one declared upstream token (sanity check)", () => {
    expect(declaredZuiNames.size).toBeGreaterThan(0);
  });

  it("resolves every var(--zui-*) usage to a real @zevaui/tokens declaration", () => {
    const used = capturedNames(css, /var\((--zui-[a-z0-9-]+)\)/g);
    expect(used.length).toBeGreaterThan(0);
    for (const name of used) {
      expect(declaredZuiNames.has(name)).toBe(true);
    }
  });
});

describe("G5: every declared recipe variant renders a matching rule", () => {
  it("has at least one registered component to gate (sanity check)", () => {
    expect(componentRegistry.length).toBeGreaterThan(0);
  });

  it("emits the base rule of every registered recipe", () => {
    for (const { recipe } of componentRegistry) {
      expect(css).toMatch(new RegExp(`\\.${recipe.className}\\s*\\{`));
    }
  });

  it("emits a rule for every declared variant value, driven off the recipes themselves", () => {
    for (const { recipe } of componentRegistry) {
      for (const [axis, values] of Object.entries(recipe.variants)) {
        for (const value of Object.keys(values)) {
          const selector = variantClassName(recipe.className, axis, value);
          expect(css).toMatch(new RegExp(`\\.${selector}\\s*\\{`));
        }
      }
    }
  });
});
