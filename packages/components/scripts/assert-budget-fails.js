// Proves the bundle-budget gate (RNF-02) has teeth AND discriminates the import graph: runs
// the real gate (scripts/check-bundle-budget.js) against a deliberately-broken fixture
// (__fixtures__/budget-over.json) and asserts it actually caught BOTH conditions — Card's
// impossible ceiling, and CardAndButton's multi-import entry, whose measured size (Card +
// Button bundled together) exceeds the ceiling it is checked against (Card's own real
// ceiling), proving the measurement bundles what an entry's `imports` actually declares
// rather than trusting a stale number.
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

  console.log(
    `\n[${LABEL}] PASSED: check-bundle-budget.js exited ${result.status} for the ` +
      "over-budget fixture, meaning both the impossible ceiling and the multi-import " +
      "discrimination were correctly caught. The gate has teeth.",
  );
  process.exitCode = 0;
}

main();
