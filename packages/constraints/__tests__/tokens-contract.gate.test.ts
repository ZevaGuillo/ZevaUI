import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { themeIds, themeKeyOf } from "@zevaui/tokens";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "../src/color/contrast.js";
import { relativeLuminance } from "../src/color/luminance.js";
import { parseColor } from "../src/color/parse.js";
import { contract, minContrastRatioFor } from "../src/contract.js";
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

const themeFrom = (themeId: string): Theme => ({
  id: themeId,
  colors: Object.fromEntries(manifest.tokens.map((t) => [t.name, t.values[themeKeyOf[themeId]]])),
});

// Module scope rather than inside one describe: three blocks below measure
// ratios now, and a helper visible to only the first of them would have been
// copied into the other two.
function ratioOf(themeId: string, foreground: string, background: string): number {
  const { colors } = themeFrom(themeId);
  const fg = parseColor(colors[foreground]);
  const bg = parseColor(colors[background]);
  if (fg === undefined || bg === undefined) {
    throw new Error(`${themeId} "${foreground}"/"${background}" tokens must be parseable`);
  }
  return contrastRatio(relativeLuminance(fg), relativeLuminance(bg));
}

describe.each(themeIds)("%s theme", (themeId: string) => {
  it("satisfies the declared contrast contract", () => {
    const result = validateTheme(themeFrom(themeId));
    expect(result.violations).toEqual([]);
    expect(result.pass).toBe(true);
  });
});

describe("high-contrast AAA headroom", () => {
  // `color-text-success` clears the 7.0 AAA floor by roughly 1.3%, the narrowest
  // margin in any base theme. The gate above only notices once the ratio has
  // already broken; this pins the measured value so an edit to the green ramp or
  // to the high-contrast canvas surfaces as a failure here first.
  // If this fails because the margin WIDENED, update the README's stated headroom
  // rather than loosening the assertion.
  it("keeps color-text-success just above its 7.0 floor", () => {
    const { colors } = themeFrom("high-contrast");
    const foreground = parseColor(colors["color-text-success"]);
    const background = parseColor(colors["color-bg-canvas"]);
    if (foreground === undefined || background === undefined) {
      throw new Error("high-contrast success and canvas tokens must be parseable");
    }

    const ratio = contrastRatio(relativeLuminance(foreground), relativeLuminance(background));

    expect(ratio).toBeGreaterThan(contract.themes["high-contrast"].minContrastRatio);
    expect(ratio).toBeCloseTo(7.09, 2);
  });
});

describe("non-text contrast headroom (PR2 repoints)", () => {
  // The two tightest ratios introduced by the PR2 repoint. The gate above only
  // notices once a ratio has already dropped below 3.0; these pin the measured
  // values so a primitive-scale edit surfaces as a failure here first, at the
  // narrowest margins, rather than silently eroding until the gate itself trips.
  // If either fails because headroom WIDENED, update the README's stated
  // headroom rather than loosening the assertion.

  it("keeps dark color-danger-default just above its 3.0 non-text floor (16% headroom)", () => {
    const ratio = ratioOf("dark", "color-danger-default", "color-danger-subtle");
    expect(ratio).toBeGreaterThan(contract.nonTextMinContrastRatio);
    expect(ratio).toBeCloseTo(3.48, 2);
  });

  it("keeps dark color-border-strong x color-bg-surface just above its 3.0 non-text floor (22% headroom)", () => {
    const ratio = ratioOf("dark", "color-border-strong", "color-bg-surface");
    expect(ratio).toBeGreaterThan(contract.nonTextMinContrastRatio);
    expect(ratio).toBeCloseTo(3.67, 2);
  });
});

describe("light color-text-muted on gray.550 (ADR-0022 D1)", () => {
  // `text.muted` moved off `gray.500` onto the new `gray.550` so that painting
  // text on `bg.subtle` clears 4.5. These pin all three muted backgrounds, not
  // only the new one: the repoint lifted every muted ratio in the light theme,
  // and a later nudge back toward gray.500 would erode them together.
  // If one fails because headroom WIDENED, update the README's stated headroom
  // rather than loosening the assertion.
  const floor = minContrastRatioFor("light");

  it("clears 4.5 on bg-subtle, the pair D1 gated", () => {
    const ratio = ratioOf("light", "color-text-muted", "color-bg-subtle");
    expect(ratio).toBeGreaterThan(floor);
    expect(ratio).toBeCloseTo(4.64, 2);
  });

  it("clears 4.5 on bg-canvas", () => {
    const ratio = ratioOf("light", "color-text-muted", "color-bg-canvas");
    expect(ratio).toBeGreaterThan(floor);
    expect(ratio).toBeCloseTo(4.89, 2);
  });

  it("clears 4.5 on bg-surface", () => {
    const ratio = ratioOf("light", "color-text-muted", "color-bg-surface");
    expect(ratio).toBeGreaterThan(floor);
    expect(ratio).toBeCloseTo(5.11, 2);
  });
});

describe("the newly gated pair in the other two themes", () => {
  // Gating `text-muted` x `bg-subtle` put the pair under a floor in all three
  // themes at once, not only the light one the repoint fixed. Dark and
  // high-contrast `text.muted` are untouched here — they resolve to `gray.400`
  // and `gray.700` and already cleared their floors — but the pair is newly
  // contract-relevant in both, and README.md now states both ratios. These pin
  // what the README claims so the doc cannot drift from the measurement.
  // Each theme is asserted against its OWN floor, not a shared 4.5: the
  // high-contrast floor is 7.0, which is why that ratio needs to be far higher
  // to mean the same thing.
  it("clears the 4.5 dark floor", () => {
    const ratio = ratioOf("dark", "color-text-muted", "color-bg-subtle");
    expect(ratio).toBeGreaterThan(minContrastRatioFor("dark"));
    expect(ratio).toBeCloseTo(5.64, 2);
  });

  it("clears the steeper 7.0 high-contrast floor", () => {
    const ratio = ratioOf("high-contrast", "color-text-muted", "color-bg-subtle");
    expect(ratio).toBeGreaterThan(minContrastRatioFor("high-contrast"));
    expect(ratio).toBeCloseTo(9.37, 2);
  });
});

describe("color-border-strong regression fence (still gray.500)", () => {
  // `border.strong` deliberately did NOT move with `text.muted`: the two shared
  // `gray.500`, and D1 proved there is no single lightness where muted clears
  // 4.5 on bg-subtle AND border-strong still clears 3.0 on it. Splitting the
  // rung is what made both possible, so these pin the ratios that stayed put.
  // A future edit that "finishes the job" by moving border.strong to gray.550
  // fails here, which is the entire point of the block.
  // dark x bg-surface is already pinned above at 3.67 and is not repeated.
  it("keeps light border-strong x bg-canvas where it was", () => {
    const ratio = ratioOf("light", "color-border-strong", "color-bg-canvas");
    expect(ratio).toBeGreaterThan(contract.nonTextMinContrastRatio);
    expect(ratio).toBeCloseTo(4.63, 2);
  });

  it("keeps light border-strong x bg-surface where it was", () => {
    const ratio = ratioOf("light", "color-border-strong", "color-bg-surface");
    expect(ratio).toBeGreaterThan(contract.nonTextMinContrastRatio);
    expect(ratio).toBeCloseTo(4.84, 2);
  });

  it("keeps dark border-strong x bg-canvas where it was", () => {
    const ratio = ratioOf("dark", "color-border-strong", "color-bg-canvas");
    expect(ratio).toBeGreaterThan(contract.nonTextMinContrastRatio);
    expect(ratio).toBeCloseTo(4.16, 2);
  });

  // No high-contrast assertion here on purpose: high-contrast `border-strong`
  // is `oklch(0 0 0)`, pure black, and consumes no gray rung at all. Measured,
  // it sits at 19.08 against bg-subtle — a trivial pass that would test
  // nothing and would read as coverage.
});

describe("the dark Badge edge, in neither pair array", () => {
  // `color-border-strong` x `color-bg-subtle` is declared in NEITHER
  // contrastPairs nor nonTextContrastPairs, so `validateTheme` never looks at
  // it. It exists here because D1 is the proof that an ungated pair ships
  // green: the same window that broke muted on bg-subtle would have taken this
  // edge below 3.0 had border.strong moved too, and no gate would have said so.
  // Measured 3.04 against a 3.0 floor it is not held to — 1.2% of room. If this
  // fails, the question is not how to make it pass but whether the pair now
  // belongs in nonTextContrastPairs.
  it("sits at 3.04, just above the floor nothing applies to it", () => {
    const ratio = ratioOf("dark", "color-border-strong", "color-bg-subtle");
    expect(ratio).toBeCloseTo(3.04, 2);
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
