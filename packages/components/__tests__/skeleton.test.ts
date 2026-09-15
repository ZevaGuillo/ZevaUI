// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, exactly as badge.test.ts explains.
// `React.createElement` gives the same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on.
import { cleanup, render } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { recipeClassName } from "../src/internal/recipe-class.js";
import { selectorSegments } from "../src/internal/selector-segments.js";
import { Skeleton } from "../src/skeleton/Skeleton.js";
import { skeletonRecipe } from "../src/skeleton/skeleton.recipe.js";
import type {
  SkeletonProps,
  SkeletonShape,
  SkeletonWidth,
} from "../src/skeleton/skeleton.types.js";
import {
  ancestorStateSelectors,
  emittedStylesheet,
  styledClassPredicate,
} from "./support/emitted-css.js";

const css = emittedStylesheet();

const SHAPES: readonly SkeletonShape[] = ["block", "heading", "text"];
const WIDTHS: readonly SkeletonWidth[] = ["full", "half", "narrow", "wide"];

afterEach(() => {
  cleanup();
});

// Skeleton renders no text, so nothing here can be found by its content. The placeholder is
// located by the one thing it is guaranteed to be: the only element the render produced.
function renderSkeleton(props: SkeletonProps = {}): HTMLElement {
  const { container } = render(createElement(Skeleton, props));
  const [element] = Array.from(container.children);
  return element as HTMLElement;
}

describe("Skeleton", () => {
  it("stands in for one full-width line of body copy when nothing is asked for", () => {
    const skeleton = renderSkeleton();
    expect(skeleton.className).toBe(
      "zui-skeleton zui-skeleton--shape_text zui-skeleton--width_full",
    );
    expect(skeleton.className).toBe(recipeClassName(skeletonRecipe, {}));
  });

  it("carries the class of every shape it is asked for", () => {
    for (const shape of SHAPES) {
      const skeleton = renderSkeleton({ shape });
      expect(skeleton.className).toBe(
        `zui-skeleton zui-skeleton--shape_${shape} zui-skeleton--width_full`,
      );
    }
  });

  it("carries the class of every width it is asked for", () => {
    for (const width of WIDTHS) {
      const skeleton = renderSkeleton({ width });
      expect(skeleton.className).toBe(
        `zui-skeleton zui-skeleton--shape_text zui-skeleton--width_${width}`,
      );
    }
  });

  // THE ACCESSIBILITY DECISION, PINNED. A skeleton is a shape, not a message: it has nothing to
  // read, it arrives in crowds (a list of eight rows is two dozen of these), and this package
  // already owns the component that announces work in progress — `Progress` renders RAC's
  // `ProgressBar`, indeterminate case included. So the placeholder is hidden from assistive tech
  // outright and the loading state stays the REGION's job, announced once. Skeleton.tsx argues it
  // at length; this test is what stops a later "let's add role=status" from being a silent change.
  it("is hidden from assistive technology, with no role and nothing to announce", () => {
    const skeleton = renderSkeleton({ shape: "block" });
    expect(skeleton.getAttribute("aria-hidden")).toBe("true");
    expect(skeleton.hasAttribute("role")).toBe(false);
    expect(skeleton.getAttributeNames().filter((name) => name.startsWith("aria-"))).toEqual([
      "aria-hidden",
    ]);
    expect(skeleton.textContent).toBe("");
  });

  // A `<span>`, not a `<div>`, and the reason is markup validity rather than taste: a skeleton
  // stands in for content wherever that content was, including inside a `<p>`, where a `<div>` is
  // invalid and no consumer can work around it because this package exposes no element override.
  it("renders an empty span so it is valid wherever the real content was", () => {
    const skeleton = renderSkeleton();
    expect(skeleton.tagName).toBe("SPAN");
    expect(skeleton.childNodes.length).toBe(0);
  });
});

// Routed through a plain function typed as `SkeletonProps` (rather than a direct call to
// `createElement`) for the same reason badge.test.ts does it: the excess-property checks below
// must apply to a fresh object literal.
function skeletonElement(props: SkeletonProps) {
  return createElement(Skeleton, props);
}

describe("Skeleton public API surface (type-level)", () => {
  it("rejects className, style and unknown axis values at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      skeletonElement({ className: "h-4 w-1/2" }),
      // @ts-expect-error style is not part of the public API
      skeletonElement({ style: { height: 16 } }),
      // @ts-expect-error unknown shape value
      skeletonElement({ shape: "circle" }),
      // @ts-expect-error unknown width value
      skeletonElement({ width: "1/2" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // The omission is load-bearing, not an oversight. Wrapping the real content so the placeholder
  // inherits its size is a sizing escape hatch wearing a content prop's clothes — and it would put
  // arbitrary markup inside an element that is `aria-hidden`, i.e. text no screen reader can ever
  // reach. `shape` and `width` are the entire sizing answer.
  it("takes no children at all", () => {
    // @ts-expect-error Skeleton has no children prop
    expect(isValidElement(skeletonElement({ children: "Loading" }))).toBe(true);
  });

  it("accepts a skeleton with no props at all", () => {
    expect(isValidElement(skeletonElement({}))).toBe(true);
  });
});

describe("the emitted CSS Skeleton owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits the base .zui-skeleton rule", () => {
    expect(hasRule("zui-skeleton")).toBe(true);
  });

  it("emits exactly one rule per declared shape", () => {
    const emitted = [...new Set(css.match(/\.zui-skeleton--shape_[a-z]+/g) ?? [])];
    expect(emitted.sort()).toEqual(SHAPES.map((shape) => `.zui-skeleton--shape_${shape}`).sort());
  });

  it("emits exactly one rule per declared width", () => {
    const emitted = [...new Set(css.match(/\.zui-skeleton--width_[a-z]+/g) ?? [])];
    expect(emitted.sort()).toEqual(WIDTHS.map((width) => `.zui-skeleton--width_${width}`).sort());
  });

  // The two axes are separate because they answer different questions — `shape` owns the block
  // extent and the corner, `width` owns the inline extent — and that separation is the only thing
  // keeping a caller from building a 6em-tall box with a text corner. A width rule that grew a
  // height would collapse it silently, so the boundary is asserted rather than merely written
  // down, the same way badge.test.ts pins that no tone rule declares a text colour.
  it("no width rule decides how tall the placeholder is", () => {
    const widthSegments = selectorSegments(css).filter((segment) =>
      /\.zui-skeleton--width_[a-z]+/.test(segment.selector),
    );
    expect(widthSegments.length).toBe(WIDTHS.length);
    for (const segment of widthSegments) {
      const body = css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex));
      expect(body).not.toMatch(/(^|[;\s])(block-size|min-block-size|height)\s*:/);
    }
  });

  it("never lets an ancestor's state attribute paint it", () => {
    expect(ancestorStateSelectors(css, "zui-skeleton")).toEqual([]);
  });
});

// Skeleton is the second component in this package with motion of its own, and the first that is
// animated AND server-renderable. `prefers-reduced-motion` support is mandatory here, so these
// assertions exist so that it cannot be dropped, weakened, or moved out of the media query
// without a test going red.
describe("Skeleton's motion is cancellable", () => {
  /** Every `@media (prefers-reduced-motion: reduce)` block in the sheet, brace-matched. */
  function reducedMotionBlocks(): string[] {
    const marker = "@media (prefers-reduced-motion: reduce)";
    const blocks: string[] = [];
    for (let from = css.indexOf(marker); from !== -1; from = css.indexOf(marker, from + 1)) {
      let depth = 0;
      for (let i = css.indexOf("{", from); i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        if (css[i] === "}") {
          depth -= 1;
          if (depth === 0) {
            blocks.push(css.slice(from, i + 1));
            break;
          }
        }
      }
    }
    return blocks;
  }

  it("declares the pulse keyframes and runs them from the base rule", () => {
    expect(css).toMatch(/@keyframes\s+zui-skeleton-pulse\s*\{/);
    expect(css).toMatch(/animation-name:\s*zui-skeleton-pulse/);
  });

  // Brace-matched rather than substring-sliced, for progress.test.ts's reason: an
  // `animation-name: none` sitting anywhere in the sheet would satisfy a looser check while the
  // rule actually lived outside the media query — which is the exact defect this asserts against,
  // and which would also make every visual baseline non-deterministic, since the Playwright
  // context pins `reducedMotion: "reduce"` for each capture.
  it("cancels the pulse inside a prefers-reduced-motion block, not merely somewhere", () => {
    const cancelling = reducedMotionBlocks().filter(
      (block) => block.includes(".zui-skeleton") && /animation-name:\s*none/.test(block),
    );
    expect(cancelling.length).toBeGreaterThan(0);
  });

  // The other half of reduced-motion support, and the half that is easy to get backwards. With
  // the animation cancelled the box keeps the `opacity` its base rule left it at — which is the
  // BRIGHT end. Parking it at the 0.55 floor instead would leave a permanently faded placeholder
  // that reads as disabled content rather than as content still arriving, the same mistake
  // Progress avoids by not parking its indeterminate bar at a full track.
  it("parks the box at the bright end rather than at the dim frame", () => {
    for (const block of reducedMotionBlocks()) {
      if (!block.includes(".zui-skeleton")) continue;
      expect(block).not.toMatch(/(^|[;\s{])opacity\s*:/);
    }
    // Spelled `subject.match(pattern)`, which G12 in test-hygiene-gates.test.ts requires of every
    // test file in this package (that gate cannot name the spelling it forbids either).
    const [, base = ""] = css.match(/\.zui-skeleton\s*\{([^}]*)\}/) ?? [];
    expect(base).not.toMatch(/(^|[;\s])opacity\s*:/);
  });
});
