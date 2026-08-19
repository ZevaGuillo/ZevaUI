// Proves the a11y gate has teeth: runs the deliberately broken story
// (see stories/__gate__/BrokenA11y.stories.tsx) through Vitest, scoped to
// the `a11y-negative` tag, and asserts axe actually caught it.
//
// The exit-code reading, the child-process runner and the crash branch live
// in @zevaui/config/gate-harness, shared with the visual and bundle-budget
// gates. What stays here is what only this gate can say: which fixture is
// planted, and what a failure to catch it would mean.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCrash, reportCrash, resolveVitestBin, runNode } from "@zevaui/config/gate-harness";

const LABEL = "a11y-gate";
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const configPath = path.join(packageRoot, "vitest.a11y-gate.config.ts");

function main() {
  // `import.meta.resolve` is passed from here, not taken inside the harness:
  // this package is the one whose dependency graph is meant to reach vitest.
  const result = runNode({
    args: [resolveVitestBin(import.meta.resolve), "run", "--config", configPath],
    cwd: packageRoot,
  });

  if (isCrash(result)) return reportCrash(LABEL, result);

  if (result.status === 0) {
    console.error(
      `\n[${LABEL}] FAILED: the deliberately broken story ` +
        "(BrokenA11y/IconOnlyWithoutAccessibleName) passed its accessibility test. " +
        "The gate is not catching real violations.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n[${LABEL}] PASSED: vitest exited ${result.status} for the broken story, ` +
      "meaning its axe violation was correctly caught and failed the test. The gate has teeth.",
  );
  process.exitCode = 0;
}

main();
