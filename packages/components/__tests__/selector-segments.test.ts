import { describe, expect, it } from "vitest";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { selectorSegments } from "../src/internal/selector-segments.js";

const selectorsOf = (css: string): string[] =>
  selectorSegments(css).map(({ selector }) => selector);

describe("selectorSegments: one linear pass over a stylesheet's rule heads", () => {
  it("yields the selector of each rule", () => {
    expect(selectorsOf(".a{color:red}.b{color:blue}")).toEqual([".a", ".b"]);
  });

  // The reason the scan cannot be a simple split: a closing brace ends the previous segment, so
  // a rule BODY never bleeds into the next rule's selector.
  it("resets at a closing brace, so a body never leaks into the next selector", () => {
    expect(selectorsOf(".a{color:red}\n.b{}")).toEqual([".a", "\n.b"]);
  });

  // Panda wraps everything in cascade layers, so the common case is nested. An at-rule head is a
  // segment of its own, and the rules inside it are segments in their own right.
  it("treats a nested at-rule head as its own segment", () => {
    expect(selectorsOf("@layer recipes{.a{color:red}}")).toEqual(["@layer recipes", ".a"]);
  });

  // THIS IS THE PROPERTY THE CSS GATES ARE BUILT ON. Panda collapses rules that share an
  // identical declaration block into one comma-separated list, so a class is styled when it
  // appears anywhere in the head — not only right before the brace. Returning the head WHOLE is
  // what lets a caller ask that question; returning only the last member would redlight a
  // perfectly styled variant.
  it("returns a comma-separated selector list whole", () => {
    expect(selectorsOf(".a--md,.a--sm{padding:4px}")).toEqual([".a--md,.a--sm"]);
  });

  it("reports the index of each opening brace, so a caller can read the block", () => {
    const css = ".a{color:red}";
    const [segment] = selectorSegments(css);
    expect(css[segment.openBraceIndex]).toBe("{");
  });

  it("yields nothing for a source that opens no rule", () => {
    expect(selectorSegments("/* nothing but a comment */")).toEqual([]);
  });

  it("ignores a trailing head that never opens a brace", () => {
    expect(selectorsOf(".a{color:red}.b")).toEqual([".a"]);
  });

  // A stray closing brace before any rule resets a boundary that was never open, which is a
  // no-op rather than an off-by-one. Worth pinning because the reset is unconditional.
  it("survives a closing brace before any rule opens", () => {
    expect(selectorsOf("}.a{color:red}")).toEqual([".a"]);
  });
});

// KNOWN LIMITATION, MEASURED AND PINNED rather than papered over or silently fixed.
//
// The scan does not parse strings, comments or url() literals, so a brace inside one is read as
// a real boundary. Both prior implementations behaved identically — this is the shared version of
// a limitation that already shipped, not a regression the extraction introduced.
//
// It is left unfixed deliberately. The input is `dist/styles.css`, which Panda generates, and
// string-literal braces would have to appear in a `content` or `url()` value to matter. Teaching
// the scanner to parse CSS strings would buy nothing the callers can observe, and the second test
// below is the reason: a spurious head is INERT, because it names no class, so every caller —
// all of which ask "does this head name my class?" — skips it.
describe("selectorSegments and braces inside literals", () => {
  it("splits inside a string literal, producing a head that is not a selector", () => {
    expect(selectorsOf('.a{content:"{"}.b{color:red}')).toEqual([".a", 'content:"', ".b"]);
  });

  it("still answers the only question its callers ask, because a spurious head names no class", () => {
    const css = '.zui-x{content:"{"}.zui-y{background:url(a{b)}';
    const heads = selectorSegments(css).map(({ selector }) => selector);
    const names = (className: string) =>
      heads.some((head) => classSelectorPattern(className).test(head));

    expect(names("zui-x")).toBe(true);
    expect(names("zui-y")).toBe(true);
    expect(heads.filter((head) => head.includes("."))).toEqual([".zui-x", ".zui-y"]);
  });
});
