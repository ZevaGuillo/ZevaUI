// Proves the bundle-budget gate (RNF-02) has teeth AND discriminates the import graph: runs
// the real gate (scripts/check-bundle-budget.js) against a deliberately-broken fixture
// (__fixtures__/budget-over.json) and asserts it actually caught BOTH conditions — Card's
// impossible ceiling, and CardAndButton's multi-import entry, whose measured size (Card +
// Button bundled together) exceeds the ceiling it is checked against (Card's own real
// ceiling), proving the measurement bundles what an entry's `imports` actually declares
// rather than trusting a stale number.
//
// A NONZERO EXIT IS NOT EVIDENCE ON ITS OWN, and reading it as such would repeat the defect
// this gate is meant to catch. `budgetEntries` throws — exiting 1, indistinguishable from a
// caught overrun by exit code alone — when the fixture has no entry for a registered
// component. That branch proves nothing about ceilings: it means the fixture went stale, not
// that the gate works. `isCrash` cannot see it either, since a thrown Error is a normal exit.
// So the assertion below reads WHICH failure came back, by requiring the verdict line to name
// both planted entries.
//
// That is also why the fixture carries a filler entry per registered client component, with a
// ceiling nothing can reach and a zero ledger: entries are DERIVED from componentRegistry, so
// every component must appear, and the two planted defects must be the only rows OVER. Adding a
// component means adding its filler line here — and forgetting to is now a loud FAIL below
// rather than a green gate that measured nothing.
//
// The exit-code reading, the child-process runner and the crash branch live in
// @zevaui/config/gate-harness, shared with the storybook accessibility and visual gates.
// What stays here is what only this gate can say: which fixture is planted, and what a
// failure to catch it would mean.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCrash, reportCrash, runNode } from "@zevaui/config/gate-harness";

const LABEL = "bundle-budget-gate";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const checkScriptPath = path.join(scriptDir, "check-bundle-budget.js");
const fixturePath = path.join(packageRoot, "__fixtures__", "budget-over.json");
const VERDICT_MARKER = "[bundle-budget] OVER budget:";
/** The two defects planted in the fixture. Both must appear in the gate's own verdict line. */
const PLANTED_ENTRIES = ["Card", "CardAndButton"];

function main() {
  const result = runNode({
    args: [checkScriptPath, "--budget", fixturePath],
    cwd: packageRoot,
  });

  if (isCrash(result)) return reportCrash(LABEL, result);

  if (result.status === 0) {
    console.error(
      `\n[${LABEL}] FAILED: the deliberately over-budget fixture ` +
        "(__fixtures__/budget-over.json) reported everything OK. The gate is not " +
        "catching real budget overruns.",
    );
    process.exitCode = 1;
    return;
  }

  const verdictLine = (result.stderr ?? "")
    .split("\n")
    .find((line) => line.includes(VERDICT_MARKER));

  if (verdictLine === undefined) {
    console.error(
      `\n[${LABEL}] FAILED: check-bundle-budget.js exited ${result.status} but never printed ` +
        `its "${VERDICT_MARKER}" verdict, so it failed for some reason other than the planted ` +
        "overruns — a stale fixture missing an entry for a registered component is the likely " +
        "one. Nonzero alone is not proof the ceilings were compared at all.",
    );
    process.exitCode = 1;
    return;
  }

  const unnamed = PLANTED_ENTRIES.filter((name) => !verdictLine.includes(name));
  if (unnamed.length > 0) {
    console.error(
      `\n[${LABEL}] FAILED: the verdict named ${verdictLine.trim()} but did not flag ` +
        `${unnamed.join(", ")}. Each planted entry proves a different property — Card the ` +
        "ceiling comparison, CardAndButton the multi-import measurement — so catching only " +
        "one of them leaves the other unproven.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n[${LABEL}] PASSED: check-bundle-budget.js exited ${result.status} for the ` +
      `over-budget fixture and flagged ${PLANTED_ENTRIES.join(" and ")}, meaning both the ` +
      "impossible ceiling and the multi-import discrimination were correctly caught. " +
      "The gate has teeth.",
  );
  process.exitCode = 0;
}

main();
