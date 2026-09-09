import { describe, expect, it } from "vitest";
import {
  assertHoverDoesNotOutrankInvalid,
  assertNoAncestorReachesTheControl,
  type MarkableControl,
} from "./support/markable-control-css.js";

// PROOF OF TEETH, and the reason this file exists at all.
//
// These two assertions were copied between `Checkbox` and `Switch`, and `RadioGroup` would have
// made three. Sharing them removes the drift, but it also concentrates the risk: one weakened
// helper now silently disarms the guard for every markable control at once, and both guards fail
// by returning an EMPTY offender list, which reads as a pass. So each assertion is exercised here
// against a stylesheet that violates it, and against one that is merely vacuous.
const control: MarkableControl = {
  name: "fixture",
  classPrefix: "zui-fixture",
  statefulPart: "zui-fixture__part",
};

describe("the markable-control cascade guard bites on a hover rule that outranks invalid", () => {
  it("passes a hover rule that excludes the invalid state", () => {
    const css = ".zui-fixture__part[data-hovered]:not([data-invalid]){border-color:blue}";
    expect(() => assertHoverDoesNotOutrankInvalid(css, control)).not.toThrow();
  });

  // The real Checkbox bug: `:not([data-disabled])` scores (0,3,0) against `[data-invalid]`'s
  // (0,2,0), so the hover tint wins regardless of source order.
  it("fails a hover rule guarded on disabled but not on invalid", () => {
    const css = ".zui-fixture__part[data-hovered]:not([data-disabled]){border-color:blue}";
    expect(() => assertHoverDoesNotOutrankInvalid(css, control)).toThrow();
  });

  // Without the vacuity guard this stylesheet would PASS: no hover rules means no offenders.
  it("fails a stylesheet with no hover rule at all, rather than passing vacuously", () => {
    const css = ".zui-fixture__part{border-color:blue}";
    expect(() => assertHoverDoesNotOutrankInvalid(css, control)).toThrow();
  });
});

describe("the markable-control cascade guard bites on an ancestor-state selector", () => {
  it("passes a state attribute attached to the control's own class", () => {
    const css = ".zui-fixture__part[data-selected]{border-color:blue}";
    expect(() => assertNoAncestorReachesTheControl(css, control)).not.toThrow();
  });

  // A bare `[data-selected] .zui-fixture__part` matches ANY selected ancestor — a Menu row, a
  // Card — and would light every such part inside it with no pointer near it.
  it("fails a state attribute that sits on an ancestor", () => {
    const css = "[data-selected] .zui-fixture__part{border-color:blue}";
    expect(() => assertNoAncestorReachesTheControl(css, control)).toThrow();
  });

  it("fails a stylesheet that never mentions the control, rather than passing vacuously", () => {
    const css = ".something-else{border-color:blue}";
    expect(() => assertNoAncestorReachesTheControl(css, control)).toThrow();
  });
});
