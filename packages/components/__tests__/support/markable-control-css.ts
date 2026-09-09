import { expect, it } from "vitest";
import {
  ancestorStateSelectors,
  emittedStylesheet,
  hoverSelectorsFor,
  hoverSelectorsNotExcludingInvalid,
  selectorsMentioning,
} from "./emitted-css.js";

/**
 * The two structural properties every markable control's CSS has to prove.
 *
 * `Checkbox` and `Switch` each owed both, and the assertions had been copied between them —
 * comments and vacuity guards included — with `RadioGroup` about to make three. `emitted-css.ts`
 * already shares the DETECTORS; what stayed duplicated was the pair of assertions hanging off
 * them, which is the half that actually decides whether a component ships broken.
 *
 * The assertions are exported separately from the `it` wrapper on purpose: both guards fail by
 * producing an EMPTY offender list, which reads as a pass, so `markable-control-css.test.ts`
 * exercises each one against a violating stylesheet. A shared guard that stopped biting would
 * disarm every markable control at once.
 */
export type MarkableControl = {
  /** How the control reads in a test name, e.g. `"checkbox"`. */
  readonly name: string;
  /** The class every one of its rules is scoped by, e.g. `"zui-checkbox"`. */
  readonly classPrefix: string;
  /** The class of the part whose border carries the invalid signal. */
  readonly statefulPart: string;
};

/**
 * The hover tint must never outrank the invalid border.
 *
 * Found by review rather than by an author, and it was real: `[data-hovered]:not([data-disabled])`
 * scores (0,3,0) against `[data-invalid]`'s (0,2,0), because a `:not()` argument carries its own
 * weight. An invalid control lost its red border the moment the pointer touched it — the one
 * moment the user is looking straight at it. `aria-invalid` never changed, so a screen reader was
 * unaffected and only sighted users lost the signal, which is why nothing else caught it.
 *
 * Vacuity is guarded FIRST, and specifically on hover rules: an empty offender list reads as a
 * pass, so proving only that the class is mentioned somewhere proves nothing — base rules for it
 * always exist. Review caught that exact hole.
 */
export const assertHoverDoesNotOutrankInvalid = (css: string, control: MarkableControl): void => {
  expect(hoverSelectorsFor(css, control.statefulPart).length).toBeGreaterThan(0);
  expect(hoverSelectorsNotExcludingInvalid(css, control.statefulPart)).toEqual([]);
};

/**
 * Every state attribute must be attached to one of the control's own classes.
 *
 * A bare `[data-selected] .zui-x__part` matches ANY selected ancestor — a Menu row, a Card — and
 * would light every such part inside it with nothing near it. Vacuity is guarded first here too.
 */
export const assertNoAncestorReachesTheControl = (css: string, control: MarkableControl): void => {
  expect(selectorsMentioning(css, control.classPrefix).length).toBeGreaterThan(0);
  expect(ancestorStateSelectors(css, control.classPrefix)).toEqual([]);
};

/** Both cascade guards, as tests, against the real emitted stylesheet. */
export const itGuardsTheCascade = (control: MarkableControl): void => {
  it("never lets the hover tint outrank the invalid border", () => {
    assertHoverDoesNotOutrankInvalid(emittedStylesheet(), control);
  });

  it(`emits no rule that could reach a ${control.name} from an ancestor's state`, () => {
    assertNoAncestorReachesTheControl(emittedStylesheet(), control);
  });
};
