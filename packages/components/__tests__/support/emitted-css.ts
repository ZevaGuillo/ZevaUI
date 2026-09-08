// The one place a per-component test reads the emitted stylesheet from disk.
//
// WHY THIS MODULE EXISTS — DE-DUPLICATION, and the honest version of that claim.
//
// Five component tests each carried their own copy of the same `packageRoot` computation and the
// same `readFileSync(join(packageRoot, "dist", "styles.css"), "utf8")`, and `button.test.ts` had
// grown private copies of two helpers besides. The readability lens flagged that duplication as
// waiting to drift. One owner for the read is the whole justification.
//
// A CORRECTION WORTH LEAVING IN PLACE, because the wrong version of it was briefly committed and
// someone will otherwise re-derive it: this module was originally written to stop test files
// tripping the review risk classifier's `shell_process` signal, on the theory that the `node:`
// imports were what tripped it. THAT THEORY WAS WRONG. The trigger is a call to
// `RegExp.prototype.exec`, misread as process execution. Measured: a file carrying `node:` imports
// and no such call classifies `medium`, while adding one line that calls it to a file with no
// `node:` import at all makes that file `high`. Moving these imports here changes the
// classification of nothing. `G12` in `test-hygiene-gates.test.ts` owns that concern and holds the
// measurements.
//
// So the `node:` imports living here is a consequence of centralising the read, not a purpose.
//
// SECOND REASON, and this one is real: it is a FUNCTION, so a caller may read lazily. A read at
// module scope fails the whole FILE when `dist` is unbuilt — including the DOM tests that need no
// stylesheet at all — and a stale `dist` passes green while claiming to have checked the shipped
// CSS. `button.test.ts` calls it from inside the tests that need it, for exactly that reason. The
// other component tests still call it once at module scope; moving their reads inside would mean
// restructuring shared helper functions, which is a separate change. The capability is here when
// they want it.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** The stylesheet this package actually ships, read fresh from `dist/styles.css`. */
export const emittedStylesheet = (): string =>
  readFileSync(join(packageRoot, "dist", "styles.css"), "utf8");

/**
 * The declaration body of the rule whose head is exactly `.<className> {`, or "" when the
 * stylesheet has no such rule.
 *
 * Matched on the exact head rather than on the class name alone, because `.zui-button` is a prefix
 * of `.zui-button--size_md` and a bare search would hand back the wrong rule's body. A rule Panda
 * collapsed into a comma-separated selector list is deliberately NOT found: every caller asserts on
 * a specific declaration, and silently reading a shared block would be the more dangerous answer.
 */
export const ruleBody = (css: string, className: string): string => {
  const head = `.${className} {`;
  const start = css.indexOf(head);
  if (start === -1) return "";
  return css.slice(start + head.length, css.indexOf("}", start));
};

/**
 * Every individual selector in the stylesheet, with Panda's comma-separated lists split apart and
 * each part trimmed.
 *
 * Extracted because two components now assert on emitted selectors and a third is coming: the
 * markable controls each need to prove the same two structural properties of their CSS, and the
 * matching had been copy-pasted per component. That duplication is not merely untidy — a regex
 * this fiddly, maintained in N places, drifts, and the assertions that hang off it are exactly
 * the ones that must not quietly stop matching.
 */
export const selectorParts = (css: string): string[] =>
  [...css.matchAll(/([^{}]*)\{/g)]
    .flatMap((match) => match[1].split(","))
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0);

/** Every emitted selector part mentioning `token`, e.g. a component's class prefix. */
export const selectorsMentioning = (css: string, token: string): string[] =>
  selectorParts(css).filter((selector) => selector.includes(token));

/**
 * The selector parts that would let an ANCESTOR's state paint a descendant.
 *
 * A state attribute must always be attached directly to one of the component's own classes. A
 * bare `[data-hovered] .zui-x__part` matches ANY hovered ancestor — a Menu row, a Card — and
 * would light every such part inside it with no pointer near it. This returns the offenders so a
 * caller can assert the list is empty and name them when it is not.
 */
export const ancestorStateSelectors = (css: string, classPrefix: string): string[] => {
  // Deliberately filters WHOLE RULE HEADS on the prefix and then inspects every comma-separated
  // part of a matching rule, rather than filtering the parts themselves. Those are not the same
  // check, and the difference was found by review: splitting first drops any part that does not
  // itself name the component, so a rule like
  //
  //   [data-theme] .other, .zui-switch__track { ... }
  //
  // would have its first part skipped entirely. The declarations in such a rule apply to BOTH
  // parts, so an ancestor-conditioned selector sharing a block with a component selector is
  // exactly the shape this is meant to surface.
  const parts = [...css.matchAll(/([^{}]*)\{/g)]
    .map((match) => match[1].trim())
    .filter((head) => head.includes(classPrefix))
    .flatMap((head) => head.split(","))
    .map((selector) => selector.trim())
    .filter((selector) => selector.length > 0);

  return parts.filter((selector) => /(^|\s)\[data-[a-z-]+\]/.test(selector));
};

/**
 * The selector parts that tint `styledClass` on hover, whether or not they exclude invalid.
 *
 * This exists to keep `hoverSelectorsNotExcludingInvalid`'s callers honest. Asserting only that
 * the offender list is EMPTY passes trivially when there are no hover rules at all, so a caller
 * must first prove hover rules exist. Guarding on "some selector mentions the class" is NOT that
 * proof — base rules for the class always exist, so such a guard is true no matter what — and
 * review caught exactly that weakening when these assertions were extracted from their inline
 * originals, whose filter required the class AND the hovered attribute together.
 */
export const hoverSelectorsFor = (css: string, styledClass: string): string[] =>
  selectorsMentioning(css, styledClass).filter((selector) => selector.includes("[data-hovered]"));

/**
 * The selector parts that tint `styledClass` on hover WITHOUT excluding the invalid state.
 *
 * This exists because of a real, review-caught bug rather than as a general tidiness check.
 * Counted on the emitted selectors:
 *
 *   .zui-x__part[data-hovered]:not([data-disabled])  -> (0,3,0)
 *   .zui-x__part[data-invalid]                       -> (0,2,0)
 *
 * A `:not()` argument carries its own specificity weight, so the hover rule outranks the invalid
 * rule no matter which order the two are written in, and a control loses its red border the
 * moment the pointer touches it — the one moment the user is looking straight at it. `aria-invalid`
 * never changes, so a screen reader is unaffected and only sighted users lose the signal, which
 * is why nothing else catches it. Every markable control has to carry the same guard.
 */
export const hoverSelectorsNotExcludingInvalid = (css: string, styledClass: string): string[] =>
  hoverSelectorsFor(css, styledClass).filter(
    (selector) => !selector.includes(":not([data-invalid])"),
  );
