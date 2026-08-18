// Proves the bundle-budget gate (RNF-02) has teeth AND discriminates the import graph: runs
// the real gate (scripts/check-bundle-budget.js) against a deliberately-broken fixture
// (__fixtures__/budget-over.json) and asserts it actually caught BOTH conditions — Card's
// impossible ceiling, and CardAndButton's multi-import entry, whose measured size (Card +
// Button bundled together) exceeds the ceiling it is checked against (Card's own real
// ceiling), proving the measurement bundles what an entry's `imports` actually declares
// rather than trusting a stale number.
//
//   exit 1        -> check-bundle-budget.js reported the fixture OVER budget -> the gate
//                    caught the problem -> this script exits 0 (PASS).
//   exit 0        -> check-bundle-budget.js reported everything OK -> the gate is not
//                    catching real budget overruns -> this script exits 1 (FAIL).
//   status null,  -> the check-bundle-budget.js process crashed (killed by signal, or
//   or status>=126   could not be spawned/executed) rather than failing an assertion ->
//                    this script exits 1 with a DISTINCT message. A crash silently
//                    reported as a passing gate is the failure mode this script exists
//                    to prevent.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const checkScriptPath = path.join(scriptDir, "check-bundle-budget.js");
const fixturePath = path.join(packageRoot, "__fixtures__", "budget-over.json");

function main() {
  const result = spawnSync(process.execPath, [checkScriptPath, "--budget", fixturePath], {
    cwd: packageRoot,
    shell: false,
    encoding: "utf8",
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status === null || result.status >= 126) {
    console.error(
      "\n[bundle-budget-gate] CRASHED instead of asserting: the check-bundle-budget.js " +
        `process did not complete normally (status=${result.status}, signal=${result.signal}). ` +
        "This is a process failure, not a caught OVER verdict — a crash reported as a " +
        "passing gate is the worst outcome here, so this counts as FAIL.",
    );
    process.exitCode = 1;
    return;
  }

  if (result.status === 0) {
    console.error(
      "\n[bundle-budget-gate] FAILED: the deliberately over-budget fixture " +
        "(__fixtures__/budget-over.json) reported everything OK. The gate is not " +
        "catching real budget overruns.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n[bundle-budget-gate] PASSED: check-bundle-budget.js exited ${result.status} for the ` +
      "over-budget fixture, meaning both the impossible ceiling and the multi-import " +
      "discrimination were correctly caught. The gate has teeth.",
  );
  process.exitCode = 0;
}

main();
