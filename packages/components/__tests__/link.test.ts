// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { recipeClassName } from "../src/internal/recipe-class.js";
import { selectorSegments } from "../src/internal/selector-segments.js";
import { Link } from "../src/link/Link.js";
import { linkRecipe } from "../src/link/link.recipe.js";
import type { LinkProps, LinkTone, LinkUnderline } from "../src/link/link.types.js";
import { emittedStylesheet, styledClassPredicate } from "./support/emitted-css.js";

const css = emittedStylesheet();

const TONES: readonly LinkTone[] = ["accent", "neutral"];
const UNDERLINES: readonly LinkUnderline[] = ["always", "hover"];

afterEach(() => {
  cleanup();
});

function renderLink(props: LinkProps) {
  return render(createElement(Link, props));
}

describe("Link", () => {
  it("renders an anchor carrying the href it was given", () => {
    renderLink({ href: "/docs", children: "Docs" });
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/docs");
  });

  it("falls back to tone=accent and underline=always when neither is given", () => {
    renderLink({ href: "/docs", children: "Docs" });
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link.className).toBe("zui-link zui-link--tone_accent zui-link--underline_always");
    expect(link.className).toBe(recipeClassName(linkRecipe, {}));
  });

  it("emits one class per declared value on both axes, and nothing else", () => {
    for (const tone of TONES) {
      for (const underline of UNDERLINES) {
        cleanup();
        renderLink({ href: "/x", tone, underline, children: `${tone}-${underline}` });
        expect(screen.getByRole("link").className).toBe(
          `zui-link zui-link--tone_${tone} zui-link--underline_${underline}`,
        );
      }
    }
  });

  // The whole reason `href` is required rather than optional: react-aria-components will happily
  // render an `<a role="link">` with no destination, which loses middle-click, "open in new tab"
  // and the status-bar preview. This pins that the element we ship is a real navigable link.
  it("renders a real destination rather than a role-only link", () => {
    renderLink({ href: "https://example.com/pricing", children: "Pricing" });
    expect(screen.getByRole("link").hasAttribute("href")).toBe(true);
    // RAC only adds an explicit `role="link"` when it is compensating for a missing href.
    expect(screen.getByRole("link").hasAttribute("role")).toBe(false);
  });
});

describe("Link and the rel a target=_blank link would otherwise ship without", () => {
  it('defaults rel to "noopener noreferrer" for target="_blank"', () => {
    renderLink({ href: "/report", target: "_blank", children: "Report" });
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
  });

  // The default is an opinion, not a lock: `rel="me"` and `rel="license"` on a `_blank` link are
  // both legitimate, and a caller who names one gets exactly that.
  it("lets an explicit rel replace the default entirely", () => {
    renderLink({ href: "/profile", target: "_blank", rel: "me", children: "Profile" });
    expect(screen.getByRole("link").getAttribute("rel")).toBe("me");
  });

  // `rel={undefined}` means "I did not choose one", which is the same request as omitting it —
  // which is why Link.tsx uses `??` rather than checking whether the key was present.
  it("treats an explicitly undefined rel as no choice at all", () => {
    renderLink({ href: "/report", target: "_blank", rel: undefined, children: "Report" });
    expect(screen.getByRole("link").getAttribute("rel")).toBe("noopener noreferrer");
  });

  // The default is scoped to the one target that opens a new browsing context. A same-tab link
  // has no opener to leak through and no referrer policy to override.
  it("adds no rel to a link that stays in the current tab", () => {
    renderLink({ href: "/settings", children: "Settings" });
    expect(screen.getByRole("link").hasAttribute("rel")).toBe(false);
  });
});

/**
 * WHAT `isDisabled` ACTUALLY PRODUCES, MEASURED ON REACT-ARIA-COMPONENTS 1.20 RATHER THAN ASSUMED.
 *
 * The obvious guess — and the one written here first — is that RAC keeps the `<a>` and drops its
 * `href`. It does neither. A disabled link is rendered as a `<span role="link">`, and the `href` is
 * forwarded onto that span as an ordinary attribute, where it is inert: `href` means nothing on a
 * `<span>`, so there is nothing to navigate to and nothing to middle-click.
 *
 * That element swap is the part worth pinning, because it is the part a consumer can trip over.
 * A stylesheet or a test selecting `a[href]` will not match a disabled link, and neither will
 * `getByRole("link")` — the accessible name is still there, but the tag is not. These assertions
 * exist so that if a future RAC version changes its mind, this package finds out here rather than
 * in a consumer's suite.
 */
describe("Link when the destination is unavailable", () => {
  it("becomes an inert span that still announces itself as a disabled link", () => {
    renderLink({ href: "/admin", isDisabled: true, children: "Admin" });
    const link = screen.getByText("Admin");
    expect(link.tagName).toBe("SPAN");
    expect(link.getAttribute("role")).toBe("link");
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.hasAttribute("data-disabled")).toBe(true);
  });

  // The half that actually matters for keyboard users: no `tabindex`, so the element is not
  // focusable and a disabled destination cannot be tabbed into and pressed.
  it("leaves the tab order", () => {
    renderLink({ href: "/admin", isDisabled: true, children: "Admin" });
    expect(screen.getByText("Admin").hasAttribute("tabindex")).toBe(false);
  });

  // The class contract does not move: disabled is STATE, carried by an attribute, never a variant.
  // Adding a class for it would change the class every existing link renders.
  it("keeps the same classes it had when enabled", () => {
    renderLink({ href: "/admin", isDisabled: true, children: "Admin" });
    expect(screen.getByText("Admin").className).toBe(recipeClassName(linkRecipe, {}));
  });
});

function linkElement(props: LinkProps) {
  return createElement(Link, props);
}

describe("Link public API surface (type-level)", () => {
  it("rejects className, style, an unknown tone and an open-ended target at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      linkElement({ className: "x", href: "/x", children: "x" }),
      // @ts-expect-error style is not part of the public API
      linkElement({ style: {}, href: "/x", children: "x" }),
      // @ts-expect-error unknown tone value
      linkElement({ tone: "danger", href: "/x", children: "x" }),
      // @ts-expect-error unknown underline value
      linkElement({ underline: "never", href: "/x", children: "x" }),
      // @ts-expect-error target is narrowed to the four browsing-context keywords
      linkElement({ target: "compare", href: "/x", children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // The one required prop, and the argument for it is in link.types.ts: an interaction with no URL
  // behind it is a Button, not a Link.
  it("rejects a link with no destination", () => {
    // @ts-expect-error href is required
    expect(isValidElement(linkElement({ children: "x" }))).toBe(true);
  });
});

describe("the emitted CSS Link owes, and the contract gap it deliberately does not open", () => {
  const hasRule = styledClassPredicate(css);

  it("emits the base .zui-link rule", () => {
    expect(hasRule("zui-link")).toBe(true);
  });

  it("emits exactly two .zui-link--tone_* rules and two .zui-link--underline_* rules", () => {
    const toneSelectors = [...new Set(css.match(/\.zui-link--tone_[a-z]+/g) ?? [])];
    const underlineSelectors = [...new Set(css.match(/\.zui-link--underline_[a-z]+/g) ?? [])];
    expect(toneSelectors.sort()).toEqual(TONES.map((t) => `.zui-link--tone_${t}`).sort());
    expect(underlineSelectors.sort()).toEqual(
      UNDERLINES.map((u) => `.zui-link--underline_${u}`).sort(),
    );
  });

  /**
   * THE LOAD-BEARING GATE OF THIS FILE. `@zevaui/constraints` validates `color-text-link` and
   * `color-text-default` against both `color-bg-canvas` and `color-bg-surface` in all three
   * themes; it validates NO other colour as a text foreground that this recipe could reach for.
   * The conventional hover treatment — darkening to `accent.strong` — would paint an ungated text
   * colour on every link in every paragraph, which is why link.recipe.ts moves the hover
   * affordance onto the underline instead.
   *
   * This pins the consequence rather than the intent: no rule whose selector mentions a hovered
   * link may declare `color` at all. Written against the emitted stylesheet, so a future edit to
   * the recipe cannot quietly reintroduce it.
   */
  it("no hover rule declares a text colour — the hover affordance is the underline", () => {
    const hoverSegments = selectorSegments(css).filter(
      (segment) =>
        segment.selector.includes(".zui-link") && segment.selector.includes("[data-hovered]"),
    );
    expect(hoverSegments.length).toBeGreaterThan(0);
    for (const segment of hoverSegments) {
      const body = css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex));
      expect(body).not.toMatch(/(^|[;\s])color\s*:/);
    }
  });

  /**
   * A link is text inside other text, so fixing its type would make it stop matching the sentence
   * it lives in — a link in an `<h2>` would shrink to body size. This is the assertion that keeps
   * a later "make it consistent with Button" edit from doing exactly that.
   */
  it("declares no font or line-height property anywhere in its own rules", () => {
    const linkSegments = selectorSegments(css).filter((segment) =>
      segment.selector.includes(".zui-link"),
    );
    expect(linkSegments.length).toBeGreaterThan(0);
    for (const segment of linkSegments) {
      const body = css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex));
      expect(body).not.toMatch(/(^|[;\s])font(-[a-z]+)?\s*:/);
      expect(body).not.toMatch(/(^|[;\s])line-height\s*:/);
    }
  });
});
