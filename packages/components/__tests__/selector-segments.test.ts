import { describe, expect, it } from "vitest";
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
});
