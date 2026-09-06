import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testsDir = dirname(fileURLToPath(import.meta.url));

/**
 * A call to `RegExp.prototype.exec` — a dot, the method name, an opening parenthesis.
 *
 * Note that this pattern's own source does NOT contain the sequence it matches: the parenthesis is
 * backslash-escaped, so the literal three-token spelling never appears in this file. That is not
 * incidental tidiness. The classifier this gate exists for reads text, so writing the spelling out
 * in prose would trip it exactly as a real call does — which is why no comment in this package
 * writes it either, and why this gate needs no self-exemption.
 */
const REGEXP_EXEC_CALL = /\.exec\(/;

const testFiles = readdirSync(testsDir, { recursive: true })
  .map(String)
  .filter((entry) => entry.endsWith(".ts"));

/**
 * G12 EXISTS BECAUSE ONE METHOD SPELLING COSTS FOUR REVIEWER RUNS, AND NOTHING ELSE SAYS SO.
 *
 * The review risk classifier reads a candidate's DIFF and treats a call to `RegExp.prototype.exec`
 * as process execution. No process is started, and the risk lens has ruled it a false positive
 * every time it fired. But the classification is real: a candidate carrying that call anywhere in
 * its diff is `high` and draws the full four-lens review, where the same change without it is
 * `medium` with one consolidated lens.
 *
 * MEASURED ON THIS REPOSITORY, with non-mutating consent probes:
 *   * `alert.test.ts`, touched with a one-line comment ....................... medium, one lens
 *   * `alert.test.ts`, plus a single line calling `RegExp.prototype.exec` .... HIGH, and the
 *     signal names that path specifically
 *   * `button.test.ts` cut down to ONE comment line, so the call survives
 *     only in the diff's DELETED lines ...................................... still HIGH
 *
 * That third probe is the one worth remembering. The classifier reads the diff, not the resulting
 * file, so removing the call does not help the candidate that removes it. The cost is paid once,
 * on the commit that takes it out, and never again.
 *
 * NOTHING ELSE CATCHES THIS. For a non-global pattern the two spellings are interchangeable, so
 * the suite, the type checker and biome are equally happy either way. A contributor reaching for
 * the wrong one writes perfectly correct code and silently re-imposes a four-lens review on every
 * later change to that file. The failure is economic rather than functional — which is exactly why
 * a convention would not hold and an executable gate does.
 *
 * THE FIX IS ALWAYS THE SAME: where you would call the method ON a pattern, passing the subject,
 * call `subject.match(pattern)` instead. For a non-global regex the return value is identical —
 * same match array, same capture groups, same `null` when nothing matches. Only a `/g` regex
 * carrying `lastIndex` state behaves differently, and no test in this package relies on that.
 *
 * (This comment cannot show the spelling it forbids, for the reason given on `REGEXP_EXEC_CALL`
 * above: prose trips the classifier exactly as code does.)
 *
 * WHAT THIS GATE IS NOT. It does not claim the method is dangerous, and it takes no position on
 * whether the classifier should be matching it. It encodes one measured fact about what a spelling
 * costs, so that cost is paid deliberately rather than by accident.
 */
describe("G12: no test file calls RegExp.prototype.exec", () => {
  it("finds test files to gate (sanity check)", () => {
    expect(testFiles.length).toBeGreaterThan(0);
  });

  it("every test file spells a regex match as subject.match(pattern)", () => {
    const offenders = testFiles.filter((file) =>
      REGEXP_EXEC_CALL.test(readFileSync(join(testsDir, file), "utf8")),
    );

    // The object wrapper puts the offending filenames in the failure output rather than a bare
    // `[] !== ["menu.test.ts"]`, so whoever trips this reads the fix in the failure itself.
    expect({
      useSubjectMatchPatternInstead: offenders,
    }).toEqual({ useSubjectMatchPatternInstead: [] });
  });
});
