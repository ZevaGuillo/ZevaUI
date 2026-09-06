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
