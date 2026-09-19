// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "../src/avatar/Avatar.js";
import { avatarRecipe } from "../src/avatar/avatar.recipe.js";
import type { AvatarProps, AvatarShape, AvatarSize } from "../src/avatar/avatar.types.js";
import { AVATAR_DIAMETER } from "../src/internal/avatar-diameter.js";
import { cssUrl } from "../src/internal/css-url.js";
import { selectorSegments } from "../src/internal/selector-segments.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { skeletonRecipe } from "../src/skeleton/skeleton.recipe.js";
import { emittedStylesheet, styledClassPredicate } from "./support/emitted-css.js";

const css = emittedStylesheet();

const SIZES: readonly AvatarSize[] = ["sm", "md", "lg"];
const SHAPES: readonly AvatarShape[] = ["circle", "rounded"];

afterEach(() => {
  cleanup();
});

function renderAvatar(props: Partial<AvatarProps> = {}) {
  return render(createElement(Avatar, { name: "Ana Beltrán", ...props }));
}

describe("Avatar", () => {
  // `role="img"` with `aria-label` makes the whole circle one graphic called by the person's name,
  // which is what it is. Neither the initials nor the photograph announce themselves.
  it("is one named graphic, however it is rendered", () => {
    renderAvatar();
    const avatar = screen.getByRole("img", { name: "Ana Beltrán" });
    expect(avatar.tagName).toBe("SPAN");
  });

  it("falls back to size=md and shape=circle", () => {
    renderAvatar();
    expect(screen.getByRole("img").className).toBe(slotRecipeClassNames(avatarRecipe, {}).root);
  });

  it("emits one class per declared value on both axes", () => {
    for (const size of SIZES) {
      for (const shape of SHAPES) {
        cleanup();
        renderAvatar({ size, shape });
        expect(screen.getByRole("img").className).toBe(
          slotRecipeClassNames(avatarRecipe, { size, shape }).root,
        );
      }
    }
  });
});

/**
 * THE FALLBACK IS IN THE DOM WHETHER OR NOT THERE IS A PHOTOGRAPH, AND THAT IS THE WHOLE REASON
 * THIS COMPONENT IS SERVER-RENDERABLE.
 *
 * Every other design system swaps the image for initials in an `onError` handler, which makes the
 * component stateful and therefore client-only — in the component that appears in server-rendered
 * lists of people more than anything else here. Layering the photograph OVER an always-present
 * fallback needs no state at all.
 *
 * THE PHOTOGRAPH IS A `background-image` ON A `<span>`, AND THAT IS A CORRECTION RATHER THAN A
 * PREFERENCE. The `<img alt="">` version was built first, on the claim that a failed source paints
 * nothing — and the first baseline `Avatar.stories.tsx > BrokenImage` produced refuted it:
 * Chromium draws a broken-image glyph over the monogram, which `alt=""` does not suppress. A
 * background has no failure rendering at all, because there is no replaced element for a user
 * agent to draw a placeholder for.
 *
 * `noImgElement` below is the assertion that keeps the refuted version from coming back.
 */
describe("Avatar draws its fallback without needing to know the image failed", () => {
  it("renders the initials even when there is a photograph to cover them", () => {
    const { container } = renderAvatar({ src: "https://example.com/ana.jpg" });
    expect(container.querySelector(".zui-avatar__initials")?.textContent).toBe("AB");
    expect(container.querySelector(".zui-avatar__image")).toBeTruthy();
  });

  it("renders no image layer at all when there is no src", () => {
    const { container } = renderAvatar();
    expect(container.querySelector(".zui-avatar__image")).toBeNull();
    expect(container.querySelector(".zui-avatar__initials")?.textContent).toBe("AB");
  });

  // The regression guard for the refuted design: an `<img>` here brings the broken-image glyph
  // back with it, and no attribute suppresses that.
  it("uses no <img> element, which is what a broken source would draw a glyph for", () => {
    const { container } = renderAvatar({ src: "https://example.com/ana.jpg" });
    expect(container.querySelector("img")).toBeNull();
  });

  it("hides both renderings of the name from assistive tech", () => {
    const { container } = renderAvatar({ src: "https://example.com/ana.jpg" });
    expect(container.querySelector(".zui-avatar__initials")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(container.querySelector(".zui-avatar__image")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("carries the source as a background, not as an attribute", () => {
    const { container } = renderAvatar({ src: "https://example.com/ana.jpg" });
    const layer = container.querySelector<HTMLElement>(".zui-avatar__image");
    expect(layer?.style.backgroundImage).toBe('url("https://example.com/ana.jpg")');
  });
});

/**
 * The `src` is the only caller-supplied text in this package that reaches a stylesheet, so it is
 * the only place a CSS breakout is possible at all. The escaping itself is `internal/css-url.ts`
 * and is tested as a unit in `css-url.test.ts` — NOT here, and that is a deliberate split rather
 * than a missing test.
 *
 * Measured: jsdom's CSSOM refuses to parse a hostile value and leaves the style attribute `null`,
 * so a DOM-level assertion would pass identically for an implementation that escaped correctly and
 * one that emitted nothing at all. What belongs here is the wiring — that the component routes its
 * `src` through that function and puts the result where the recipe expects it.
 */
describe("Avatar routes its src through the CSS escaper", () => {
  it("writes the escaped url() onto the image layer", () => {
    const src = "https://example.com/ana.jpg";
    const { container } = renderAvatar({ src });
    expect(container.querySelector<HTMLElement>(".zui-avatar__image")?.style.backgroundImage).toBe(
      cssUrl(src),
    );
  });
});

/**
 * The monogram, and the two decisions in it that are forced rather than preferred — both because
 * this component is server-rendered and its output has to survive hydration byte for byte.
 */
describe("Avatar derives its initials", () => {
  it("takes the first letter of the first and last words", () => {
    renderAvatar({ name: "Ana Beltrán" });
    expect(screen.getByRole("img").textContent).toBe("AB");
  });

  it("takes one letter from a single-word name", () => {
    renderAvatar({ name: "Prince" });
    expect(screen.getByRole("img").textContent).toBe("P");
  });

  it("skips the middle names rather than growing past two letters", () => {
    renderAvatar({ name: "Ana María Beltrán Ruiz" });
    expect(screen.getByRole("img").textContent).toBe("AR");
  });

  it("survives the whitespace a real database hands you", () => {
    renderAvatar({ name: "  Ana   Beltrán  " });
    expect(screen.getByRole("img").textContent).toBe("AB");
  });

  /**
   * ITERATED BY CODE POINT, NEVER BY INDEX. A name starting outside the Basic Multilingual Plane
   * is two UTF-16 units, so `name[0]` would hand back half a surrogate pair and the browser would
   * draw a replacement glyph. This is the assertion that fails if anyone "simplifies" it back to
   * `charAt`.
   */
  it("does not cut an astral character in half", () => {
    // U+1D400 MATHEMATICAL BOLD CAPITAL A, and an emoji — both surrogate pairs.
    renderAvatar({ name: "𝐀lpha 🎯arget" });
    const text = screen.getByRole("img").textContent ?? "";
    expect(text).toBe("𝐀🎯");
    expect(text).not.toContain("�");
    expect([...text]).toHaveLength(2);
  });

  // `toUpperCase()` rather than `toLocaleUpperCase()` is forced: the locale-aware form reads the
  // HOST's locale, which differs between the server that renders this and the browser that
  // hydrates it, and React reports the difference as a hydration error.
  it("uppercases locale-independently, so server and client agree", () => {
    renderAvatar({ name: "ismail kaya" });
    expect(screen.getByRole("img").textContent).toBe("IK");
  });

  // A name of only whitespace is a caller bug, but it must not throw in the middle of a list of
  // two hundred people. The circle renders empty and the accessible name is still whatever was
  // passed.
  it("renders an empty monogram rather than throwing on a blank name", () => {
    renderAvatar({ name: "   " });
    expect(screen.getByRole("img").textContent).toBe("");
  });
});

function avatarElement(props: AvatarProps) {
  return createElement(Avatar, props);
}

describe("Avatar public API surface (type-level)", () => {
  it("rejects className, style, an unknown size and an unknown shape at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      avatarElement({ className: "x", name: "A B" }),
      // @ts-expect-error style is not part of the public API
      avatarElement({ style: {}, name: "A B" }),
      // @ts-expect-error unknown size value
      avatarElement({ size: "xl", name: "A B" }),
      // @ts-expect-error unknown shape value
      avatarElement({ shape: "squircle", name: "A B" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  /**
   * `name` does three jobs — accessible name, initials source, and the thing that makes an
   * unnamed avatar unconstructable — which is why it is one required prop rather than the
   * `alt` + `fallback` pair most libraries expose. Splitting them lets the three drift:
   * `alt="Profile photo"` with `fallback="AB"` is perfectly typeable, announces the wrong thing
   * and draws initials belonging to nobody.
   */
  it("cannot be constructed without a name, and takes no separate alt or fallback", () => {
    const constructed = [
      // @ts-expect-error name is required — a role="img" with no name announces nothing
      avatarElement({ src: "/ana.jpg" }),
      // @ts-expect-error the name is the alt; there is no second one to drift from it
      avatarElement({ name: "A B", alt: "Profile photo" }),
      // @ts-expect-error the name is the fallback source; there is no second one
      avatarElement({ name: "A B", fallback: "ZZ" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

describe("the emitted CSS Avatar owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits a rule for every slot it styles", () => {
    for (const slot of avatarRecipe.slots) {
      expect({ [slot]: hasRule(`zui-avatar__${slot}`) }).toEqual({ [slot]: true });
    }
  });

  it("emits one rule per declared size and shape", () => {
    const sizes = [...new Set(css.match(/\.zui-avatar__root--size_[a-z]+/g) ?? [])];
    const shapes = [...new Set(css.match(/\.zui-avatar__root--shape_[a-z]+/g) ?? [])];
    expect(sizes.sort()).toEqual(SIZES.map((s) => `.zui-avatar__root--size_${s}`).sort());
    expect(shapes.sort()).toEqual(SHAPES.map((s) => `.zui-avatar__root--shape_${s}`).sort());
  });

  /**
   * A circle that shrinks is an ellipse, and an avatar in a flex row is an ordinary flex item —
   * the first thing a crowded row squashes. Same declaration and same reason as the one
   * `separator.recipe.ts` leans on, and the same kind of regression: it appears only under
   * pressure, which is the hardest kind to see.
   */
  it("refuses to shrink", () => {
    const base = selectorSegments(css).filter(
      (segment) =>
        segment.selector.includes(".zui-avatar__root") && !segment.selector.includes("--"),
    );
    expect(base.length).toBeGreaterThan(0);
    const body = base
      .map((segment) =>
        css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex)),
      )
      .join(";");
    expect(body).toMatch(/flex-shrink:\s*0/);
  });
});

/**
 * THE ANTI-DRIFT GATE, AND THE REASON `internal/avatar-diameter.ts` EXISTS AT ALL.
 *
 * `skeleton.recipe.ts` refused a `circle` shape when it shipped and named this hazard as one of
 * its two reasons: a diameter scale invented in one component and matched by hand in the other
 * would eventually drift, and the page would jump at the exact moment the real avatar replaced its
 * placeholder.
 *
 * `circle` is not here yet — the mechanical half of that refusal still stands, and
 * `skeleton.recipe.ts` records both what is now unblocked and what the remaining work is. What
 * this asserts is that the hazard cannot come back: the scale lives in one module, Avatar reads it
 * rather than restating it, and the day Skeleton grows its circle it reads the same constant.
 */
describe("the diameter scale has exactly one owner", () => {
  it("is what Avatar's size axis is built from, not a copy of it", () => {
    for (const size of SIZES) {
      const styles = avatarRecipe.variants.size[size].root;
      expect({ [size]: styles.inlineSize }).toEqual({ [size]: AVATAR_DIAMETER[size] });
      expect({ [size]: styles.blockSize }).toEqual({ [size]: AVATAR_DIAMETER[size] });
    }
  });

  // The standing invariant while Skeleton's `circle` is still outstanding: if someone adds it
  // without reading the scale, this fails and points at the module they should have used.
  it("is the only place a circle diameter may come from", () => {
    const shapes: Record<string, unknown> = skeletonRecipe.variants.shape;
    const circle = shapes.circle as { blockSize?: string; inlineSize?: string } | undefined;
    if (circle === undefined) return;

    const diameters = Object.values(AVATAR_DIAMETER) as string[];
    expect(diameters).toContain(circle.inlineSize);
    expect(diameters).toContain(circle.blockSize);
  });
});
