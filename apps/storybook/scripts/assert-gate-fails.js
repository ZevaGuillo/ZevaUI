// Proves the a11y gate has teeth: runs the deliberately broken story
// (see stories/__gate__/BrokenA11y.stories.tsx) through Vitest, scoped to
// the `a11y-negative` tag, and asserts axe actually caught it.
//
//   exit 1        -> the broken story FAILED its axe check -> the gate
//                    caught the violation -> this script exits 0 (PASS).
//   exit 0        -> the broken story PASSED axe, meaning the gate is not
//                    working -> this script exits 1 (FAIL).
//   status null,  -> the vitest process crashed (killed by signal, or
//   or status>=126   could not be spawned/executed) rather than failing an
//                    assertion -> this script exits 1 with a DISTINCT
//                    message. A crash silently reported as a passing gate
//                    is the failure mode this script exists to prevent.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

function resolveVitestBin() {
  // `vitest/vitest.mjs` is not in vitest's `exports` map, so it cannot be
  // resolved directly. Resolve `vitest/package.json` (which IS exported)
  // instead, then read its own declared `bin` entry — this works under
  // Node's package-exports enforcement without a shell and without
  // hardcoding a path that could drift from the installed version.
  const packageJsonUrl = import.meta.resolve("vitest/package.json");
  const packageJsonPath = fileURLToPath(packageJsonUrl);
  const packageDir = path.dirname(packageJsonPath);
  const vitestPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return path.join(packageDir, vitestPackage.bin.vitest);
}

function main() {
  const vitestBin = resolveVitestBin();
  const configPath = path.join(packageRoot, "vitest.a11y-gate.config.ts");

  const result = spawnSync(process.execPath, [vitestBin, "run", "--config", configPath], {
    cwd: packageRoot,
    shell: false,
    encoding: "utf8",
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status === null || result.status >= 126) {
    console.error(
      "\n[a11y-gate] CRASHED instead of asserting: the vitest process " +
        `did not complete normally (status=${result.status}, signal=${result.signal}). ` +
        "This is a process failure, not a caught assertion — a crash reported as a " +
        "passing gate is the worst outcome here, so this counts as FAIL.",
    );
    process.exitCode = 1;
    return;
  }

  if (result.status === 0) {
    console.error(
      "\n[a11y-gate] FAILED: the deliberately broken story " +
        "(BrokenA11y/IconOnlyWithoutAccessibleName) passed its accessibility test. " +
        "The gate is not catching real violations.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n[a11y-gate] PASSED: vitest exited ${result.status} for the broken story, ` +
      "meaning its axe violation was correctly caught and failed the test. The gate has teeth.",
  );
  process.exitCode = 0;
}

main();
