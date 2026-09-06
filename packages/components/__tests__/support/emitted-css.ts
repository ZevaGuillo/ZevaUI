// The one place a per-component test reads the emitted stylesheet from disk.
//
// WHY THIS MODULE EXISTS, and it is not tidiness. Every component test used to import `node:fs`,
// `node:path` and `node:url` itself, purely to read `dist/styles.css`. Those imports trip the
// review risk classifier's `process_boundary` / `shell_process` signal, so any change to a
// component's own test file was classified `high` and drew the full four-lens review — three
// consecutive times on this repository (#70, #74, #76), and the risk lens ruled it a false positive
// every time, because nothing here starts a process.
//
// WHAT WAS ACTUALLY MEASURED, stated without guessing at the classifier's internals:
//   * A candidate touching only `src/button/Button.tsx` classifies `medium`, one consolidated lens.
//   * The same candidate plus an edit to `button.test.ts` classifies `high`, four lenses, and the
//     signal names that path specifically.
//   * The signal is attributed PER CHANGED PATH, not per package.
// One thing this module's own commit demonstrates, and it is worth knowing before trusting the fix:
// the candidate that DELETED these imports from `button.test.ts` still classified `high` and still
// named that path, even though the resulting file contains no `node:` import at all. So the signal
// is not read purely from the candidate-side file content. Whether it reads the diff, the base
// side, or a union of both is not something this comment claims to know.
//
// The fix therefore rests on the part that IS established: the `node:` imports live HERE, in a file
// component work does not touch, so a component PR's diff stops involving them entirely. This
// module still trips the signal when IT changes — which is correct, and rare.
//
// SECOND REASON, independent of the first: this is a FUNCTION, so a caller may read lazily. A read
// at module scope fails the whole FILE when `dist` is unbuilt — including the DOM tests that need
// no stylesheet at all — and a stale `dist` passes green while claiming to have checked the shipped
// CSS. `button.test.ts` calls it from inside the tests that need it, for exactly that reason. The
// other component tests still call it once at module scope: moving their reads inside would mean
// restructuring shared helper functions, which is a different change from this one and does not
// belong in a commit whose whole point is to shrink review cost. The capability is here when they
// want it.
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
