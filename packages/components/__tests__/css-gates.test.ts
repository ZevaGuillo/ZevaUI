import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { variantClassName } from "../src/internal/recipe-class.js";
import { emittedSlotClassNames } from "../src/internal/slot-recipe-class.js";
import { componentRegistry, isSlotRecipe } from "../src/registry.js";

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

// Panda collapses rules that share an identical declaration block into one comma-separated
// selector list — `.zui-x__field--size_md,.zui-x__field--size_sm { ... }` — so a class is styled
// when it appears anywhere in a rule's selector, not only when it is the one selector right
// before the brace. Matching on `\.<class>\s*\{` sees only the last member of such a list and
// redlights a perfectly styled variant. Slot recipes hit this constantly, because per-slot
// variant styles are so often identical across two values of the same axis.
const hasRule = (source: string, className: string): boolean => {
  const pattern = classSelectorPattern(className);
  for (const match of source.matchAll(/([^{}]*)\{/g)) {
    if (pattern.test(match[1])) return true;
  }
  return false;
};

type GateRecipe = {
  readonly className: string;
  readonly slots?: readonly string[];
  readonly variants: Record<string, Record<string, unknown>>;
};

/**
 * Every class name the recipe obliges Panda to emit a rule for.
 *
 * A single-part recipe owes its base class plus one class per declared variant value. A slot
 * recipe owes less than a naive reading suggests, and the difference is measured against real
 * Panda 1.12.0 output rather than assumed: a slot with no base declarations gets no base rule,
 * and a variant value emits a class only for the slots that value actually styles. Demanding a
 * rule per (slot x axis x value) would redden a perfectly correct recipe; demanding fewer would
 * let an unstyled class ship. `emittedSlotClassNames` owns that derivation for slot recipes, so
 * this gate checks the shared helper against the real stylesheet instead of restating it.
 */
function requiredSelectors(recipe: GateRecipe): string[] {
  if (isSlotRecipe(recipe)) return emittedSlotClassNames(recipe);
  return [
    recipe.className,
    ...Object.entries(recipe.variants).flatMap(([axis, values]) =>
      Object.keys(values).map((value) => variantClassName(recipe.className, axis, value)),
    ),
  ];
}

const missingSelectors = (source: string, recipe: GateRecipe): string[] =>
  requiredSelectors(recipe).filter((className) => !hasRule(source, className));

describe("G5: every declared recipe variant renders a matching rule", () => {
  it("has at least one registered component to gate (sanity check)", () => {
    expect(componentRegistry.length).toBeGreaterThan(0);
  });

  it("owes at least the base rule for every registered recipe (sanity check)", () => {
    for (const { recipe } of componentRegistry) {
      expect(requiredSelectors(recipe).length).toBeGreaterThan(0);
    }
  });

  it("emits every rule the registered recipes owe, driven off the recipes themselves", () => {
    for (const { name, recipe } of componentRegistry) {
      expect({ [name]: missingSelectors(css, recipe) }).toEqual({ [name]: [] });
    }
  });
});

// No slot component ships yet, so the registry loop above cannot exercise the slot branch.
// These fixtures do, against CSS copied from the real Panda 1.12.0 spike output.
describe("G5: the slot-recipe branch of the gate", () => {
  const slotFixture = {
    className: "zui-fixture",
    slots: ["root", "input", "label"],
    base: {
      root: { display: "flex" },
      input: { borderWidth: "1px" },
      // `label` declares no base styles, so Panda emits no `.zui-fixture__label` rule.
    },
    variants: {
      size: { sm: { input: { padding: "2px" } }, md: { input: { padding: "4px" } } },
      visual: {
        solid: { root: { background: "red" }, label: { color: "white" } },
        subtle: { root: { background: "blue" }, label: { color: "black" } },
      },
    },
    defaultVariants: { size: "md", visual: "solid" },
  };

  // Verbatim shape of what `panda cssgen` produced for that recipe, `zui-x` renamed.
  const completeCss = `@layer recipes.slots{
  @layer _base{

    .zui-fixture__root {
      display: flex;
}

    .zui-fixture__input {
      border-width: 1px;
}
}

  .zui-fixture__input--size_md {
    padding: 4px;
}

  .zui-fixture__root--visual_solid {
    background: red;
}

  .zui-fixture__label--visual_solid {
    color: white;
}

  .zui-fixture__input--size_sm {
    padding: 2px;
}

  .zui-fixture__root--visual_subtle {
    background: blue;
}

  .zui-fixture__label--visual_subtle {
    color: black;
}
}
`;

  it("passes when every slot rule the recipe owes is present", () => {
    expect(missingSelectors(completeCss, slotFixture)).toEqual([]);
  });

  it("does not demand a base rule for a slot that declares no base styles", () => {
    expect(requiredSelectors(slotFixture)).not.toContain("zui-fixture__label");
  });

  it("does not demand a variant rule for the slots a variant value does not style", () => {
    expect(requiredSelectors(slotFixture)).not.toContain("zui-fixture__root--size_md");
    expect(requiredSelectors(slotFixture)).not.toContain("zui-fixture__label--size_md");
  });

  it("fails when a per-slot variant rule is missing, the unstyled-ship regression", () => {
    const withoutSubtleLabel = completeCss.replace(
      /\s*\.zui-fixture__label--visual_subtle \{[^}]*\}/,
      "",
    );
    expect(missingSelectors(withoutSubtleLabel, slotFixture)).toEqual([
      "zui-fixture__label--visual_subtle",
    ]);
  });

  it("fails when a slot base rule is missing", () => {
    const withoutInputBase = completeCss.replace(/\s*\.zui-fixture__input \{[^}]*\}/, "");
    expect(missingSelectors(withoutInputBase, slotFixture)).toEqual(["zui-fixture__input"]);
  });
});

// Two values of one axis very often carry identical per-slot styles, and Panda then emits ONE
// rule for both. Verbatim from a `panda cssgen` run over a three-slot recipe whose `sm` and `md`
// values styled `field` the same way.
describe("G5: rules Panda collapsed into a shared selector list still count", () => {
  const groupedFixture = {
    className: "zui-fixture",
    slots: ["root", "field"],
    base: { root: { display: "flex" }, field: { borderWidth: "1px" } },
    variants: {
      size: {
        sm: { field: { paddingInline: "button.px" } },
        md: { field: { paddingInline: "button.px" } },
      },
    },
  };

  const groupedCss = `@layer recipes.slots{
  @layer _base{

    .zui-fixture__root {
      display: flex;
}

    .zui-fixture__field {
      border-width: 1px;
}
}

  .zui-fixture__field--size_md,.zui-fixture__field--size_sm {
    padding-inline: var(--zuip-spacing-button-px);
}
}
`;

  it("counts a class that is not the last selector before the brace", () => {
    expect(missingSelectors(groupedCss, groupedFixture)).toEqual([]);
  });

  it("still fails when the shared rule is absent altogether", () => {
    const withoutGrouped = groupedCss.replace(/\s*\.zui-fixture__field--size_md[^{]*\{[^}]*\}/, "");
    expect(missingSelectors(withoutGrouped, groupedFixture)).toEqual([
      "zui-fixture__field--size_sm",
      "zui-fixture__field--size_md",
    ]);
  });

  it("never counts a class that is only a prefix of one present in the stylesheet", () => {
    const prefixFixture = {
      className: "zui-fixture",
      slots: ["fiel"],
      base: { fiel: { display: "flex" } },
      variants: {},
    };
    expect(missingSelectors(groupedCss, prefixFixture)).toEqual(["zui-fixture__fiel"]);
  });
});

// G5's REVERSE direction: every describe block above only ever asks "does the CSS have a rule for
// a class the recipe declares" — by construction, that question can never notice a class the CSS
// renders that no recipe's derivation produces. That gap matters because the SAME class-name
// derivation (`variantClassName`, `emittedSlotClassNames`, and `requiredSelectors` here, which
// wraps both) feeds THREE consumers beyond this test file: the runtime class strings a component
// renders, `components.manifest.json`'s `classNames` (scripts/build-manifest.js), and the scoping
// argument `consumedTokens()` takes to attribute `--zui-*` tokens to one component. If the
// derivation cannot see a selector the stylesheet genuinely contains, nothing fails today — that
// rule's tokens are silently dropped from the manifest, and the MCP server (ADR-0001 D8)
// publishes an under-report. This reverse direction is the only assertion in the repo that
// catches that failure mode.
//
// FORWARD AND REVERSE DELIBERATELY USE DIFFERENT PREDICATES, and the asymmetry is load-bearing.
// Forward's `hasRule` asks whether a class is MENTIONED anywhere in a rule's selector, compound
// or not — `.x[data-hovered] {` satisfies it just as a bare `.x {` would, because a slot or
// variant whose style object holds nothing but conditional keys (`&[data-hovered]`,
// `&[data-focus-visible]`) legitimately emits only that compound rule and no bare one; demanding
// a bare rule for it would redden a perfectly correct recipe. Reverse instead only ever inspects
// an EXACT single-class rule head (`.zui-x {`, or one member of a Panda-collapsed comma list —
// never a compound selector, an attribute selector, or a combinator), and for each one asks
// whether `requiredSelectors` — the same declared set forward already demands the stylesheet
// contain — counts it. That is "any class a recipe declares styles for": it does not require the
// class's OWN rule to be bare, only that walking the recipe's declared classes would have
// produced it, which accounts for the conditional-only case the same way forward's looseness
// does, without forcing reverse to parse attribute selectors itself.
//
// Matched PACKAGE-WIDE against the whole stylesheet, deliberately, rather than once per
// component: a per-component regex for `zui-button` would also capture a future
// `zui-button-group` and fail spuriously the day that ships.
//
// Do NOT rewrite either half as `slots.length * variantValues.length`: an empty per-slot style
// object emits nothing, so for a variant that styles only one slot that arithmetic demands rules
// that do not exist. When this gate goes red, the correct read is "the recipe and the CSS
// disagree", never "the gate is too strict" — fix the derivation or the recipe, not this
// assertion.
describe("G5 (reverse): every emitted single-class rule is declared by some registered recipe", () => {
  /**
   * Every distinct class name that opens as an EXACT single-class rule head somewhere in
   * `source`: `.zui-button {`, or one member of a Panda-collapsed comma list
   * (`.zui-input__label,.zui-input__input {`) — never a compound selector
   * (`.zui-button[data-hovered] {`), a descendant selector, or anything else that is not, on its
   * own, a bare class. Scoped to the `zui-` prefix so an unrelated selector (a future utility
   * class, `:root`, `::before`, ...) can never trigger a false positive.
   */
  function exactSingleClassRuleHeads(source: string): Set<string> {
    const names = new Set<string>();
    for (const match of source.matchAll(/([^{}]*)\{/g)) {
      for (const part of match[1].split(",")) {
        const single = /^\.(zui-[\w-]+)$/.exec(part.trim());
        if (single) names.add(single[1]);
      }
    }
    return names;
  }

  /** Every class name any registered recipe's derivation declares styles for, package-wide. */
  function allDeclaredClassNames(): Set<string> {
    const names = new Set<string>();
    for (const { recipe } of componentRegistry) {
      for (const className of requiredSelectors(recipe)) names.add(className);
    }
    return names;
  }

  /**
   * Whether `className` belongs to `recipeClassName`'s own namespace: the base class itself, one
   * of its `--axis_value` variants, or (for a slot recipe) one of its `__slot` parts.
   */
  function ownsClassName(recipeClassName: string, className: string): boolean {
    return (
      className === recipeClassName ||
      className.startsWith(`${recipeClassName}--`) ||
      className.startsWith(`${recipeClassName}__`)
    );
  }

  it("has at least one exact single-class rule head to check (sanity check)", () => {
    expect(exactSingleClassRuleHeads(css).size).toBeGreaterThan(0);
  });

  it("declares, via some registered recipe, every emitted class in that recipe's own namespace", () => {
    const declared = allDeclaredClassNames();
    const emitted = exactSingleClassRuleHeads(css);
    for (const { name, recipe } of componentRegistry) {
      const undeclared = [...emitted].filter(
        (className) => ownsClassName(recipe.className, className) && !declared.has(className),
      );
      expect({ [name]: undeclared }).toEqual({ [name]: [] });
    }
  });

  it("never emits a zui-* class outside every registered recipe's own namespace", () => {
    const unowned = [...exactSingleClassRuleHeads(css)].filter(
      (className) =>
        !componentRegistry.some(({ recipe }) => ownsClassName(recipe.className, className)),
    );
    expect(unowned).toEqual([]);
  });
});
