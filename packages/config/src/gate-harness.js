// The shared mechanics behind every "prove the gate has teeth" script in this
// repository: apps/storybook's accessibility and visual gates, and
// packages/components' bundle-budget gate.
//
// Each of those scripts runs a deliberately broken fixture through a real
// checker and asserts the checker FAILED. That inversion is why they cannot
// be ordinary turbo tasks, and it is why the exit-code reading below is the
// load-bearing part rather than an implementation detail:
//
//   nonzero (and < 126)  -> the checker caught the planted defect -> PASS
//   0                    -> the checker did NOT catch it -> FAIL
//   null, or >= 126      -> the process crashed rather than asserting
//                           anything -> FAIL, with a DISTINCT message
//
// That third branch is the whole point. A crash reported as a passing gate is
// the worst outcome available here — it is indistinguishable from "the gate
// works" while proving nothing at all — so it is classified separately and
// never allowed to fall into the PASS branch.
//
// Deliberately NOT shared: each gate's own PASS/FAIL prose. Those messages
// name the specific fixture and the specific property being proven, and that
// specificity is what makes a red gate actionable at 3am. Only the mechanics
// are common.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolves the installed vitest CLI entry point.
 *
 * `vitest/vitest.mjs` is not in vitest's `exports` map, so it cannot be
 * resolved directly. Resolve `vitest/package.json` (which IS exported)
 * instead, then read its own declared `bin` entry — this works under Node's
 * package-exports enforcement without a shell and without hardcoding a path
 * that could drift from the installed version.
 *
 * `resolve` is the CALLER's `import.meta.resolve`, passed in rather than
 * taken from this module. Under pnpm's isolated node_modules, resolution
 * depends on where you resolve FROM, and the caller's package is the one
 * whose dependency graph is supposed to reach vitest — this package's does
 * not. Anchoring it here instead would work only by walking up to the
 * workspace root, which is precisely the accident that let a broken
 * `pnpm exec playwright` sit unnoticed in CI.
 */
export function resolveVitestBin(resolve) {
  const packageJsonUrl = resolve("vitest/package.json");
  const packageJsonPath = fileURLToPath(packageJsonUrl);
  const packageDir = path.dirname(packageJsonPath);
  const vitestPackage = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return path.join(packageDir, vitestPackage.bin.vitest);
}

/**
 * Runs a Node script as a child process and streams its output through, so a
 * failing gate shows the underlying checker's own report in CI rather than
 * swallowing it.
 *
 * `shell: false` with an argument array, never a composed command string:
 * these scripts pass file paths and, in the visual gates, values that vary
 * per invocation.
 */
export function runNode({ args, cwd, env }) {
  const result = spawnSync(process.execPath, args, {
    cwd,
    shell: false,
    encoding: "utf8",
    ...(env ? { env } : {}),
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  return result;
}

/**
 * True when the child never completed normally — killed by a signal
 * (`status === null`), or unable to be spawned/executed (`>= 126`). Distinct
 * from "completed and reported success", which is a gate failure of a
 * completely different kind.
 */
export function isCrash(result) {
  return result.status === null || result.status >= 126;
}

/**
 * Reports the crash branch and marks the process failed. `label` is the gate's
 * own tag (`a11y-gate`, `visual-overlay-gate`, …) and `step` optionally names
 * which invocation crashed, for the multi-step visual gates.
 */
export function reportCrash(label, result, step) {
  const during = step ? ` during "${step}"` : "";
  console.error(
    `\n[${label}] CRASHED${during} instead of asserting: the child process did not ` +
      `complete normally (status=${result.status}, signal=${result.signal}). This is a ` +
      "process failure, not a caught assertion — a crash reported as a passing gate is " +
      "the worst outcome here, so this counts as FAIL.",
  );
  process.exitCode = 1;
}

/**
 * Reads a PNG's pixel dimensions from its IHDR chunk: 8-byte signature, then a
 * 4-byte chunk length + 4-byte "IHDR" type, then width (offset 16) and height
 * (offset 20), both big-endian. No PNG-parsing dependency needed for two
 * integers, matching this repo's no-new-tooling script convention.
 */
export function readPngSize(pngPath) {
  const buffer = readFileSync(pngPath);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}
