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
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

/**
 * The four-step choreography every screenshot gate runs. Both visual gates
 * plant the same kind of defect — render one value, then re-render a
 * different one and require the comparison to notice — so the sequence is
 * identical and only the fixture and the meaning of a failure differ:
 *
 *   1. SEED       `--update` with CI cleared. Actions sets CI=true on every
 *                 step and a missing reference fails-and-writes-nothing under
 *                 CI, so seeding must be unambiguously outside that mode.
 *   2. STRUCTURAL The written PNG must exist and be the full expected frame.
 *                 A collapsed or narrowed capture box is caught dimensionally
 *                 here, before step 3 has to infer it from behaviour.
 *   3. MISMATCH   Re-run under CI with a different value. This MUST fail; a
 *                 pass means the comparison never ran or matched falsely.
 *                 This is the step each gate exists for, so its message is
 *                 the caller's.
 *   4. MISSING    Delete the references and re-run under CI. Must fail, and
 *                 must not quietly write a new baseline back.
 *
 * `messages.notCaught` and `messages.passed` are the caller's: they name the
 * specific fixture and what its failure would mean. The rest are mechanical
 * and stay here.
 */
export function runScreenshotGate({
  label,
  packageRoot,
  vitestBin,
  configPath,
  screenshotsDir,
  envVar,
  seedValue,
  mismatchValue,
  expectedFrame,
  messages,
}) {
  const run = ({ value, update, ci }) => {
    const args = [vitestBin, "run", "--config", configPath];
    if (update) args.push("--update");

    const env = { ...process.env, [envVar]: value };
    if (ci) {
      env.CI = "true";
    } else {
      // Explicitly unset, in case the ambient shell already has it — the seed
      // step must be unambiguous evidence of the seeding path, independent of
      // whatever environment this script happens to run in.
      delete env.CI;
    }

    return runNode({ args, cwd: packageRoot, env });
  };

  const listPngs = () =>
    existsSync(screenshotsDir)
      ? readdirSync(screenshotsDir)
          .filter((name) => name.endsWith(".png"))
          .map((name) => path.join(screenshotsDir, name))
      : [];

  const seed = run({ value: seedValue, update: true, ci: false });
  if (isCrash(seed)) return reportCrash(label, seed, "seed");

  const seeded = listPngs();
  if (seeded.length === 0) {
    console.error(
      `\n[${label}] FAILED: the seed run wrote no screenshot at ${screenshotsDir}. ` +
        "No screenshot assertion ran at all, so the gate cannot have teeth.",
    );
    process.exitCode = 1;
    return;
  }

  for (const pngPath of seeded) {
    const { width, height } = readPngSize(pngPath);
    if (width !== expectedFrame.width || height !== expectedFrame.height) {
      console.error(
        `\n[${label}] FAILED: ${path.basename(pngPath)} is ${width}x${height}, expected ` +
          `${expectedFrame.width}x${expectedFrame.height}. The capture box did not take ` +
          "effect, so content may be clipped out of the frame.",
      );
      process.exitCode = 1;
      return;
    }
  }

  const mismatch = run({ value: mismatchValue, update: false, ci: true });
  if (isCrash(mismatch)) return reportCrash(label, mismatch, "mismatch");

  if (mismatch.status === 0) {
    console.error(`\n[${label}] FAILED: ${messages.notCaught}`);
    process.exitCode = 1;
    return;
  }

  for (const pngPath of seeded) rmSync(pngPath);

  const missing = run({ value: seedValue, update: false, ci: true });
  if (isCrash(missing)) return reportCrash(label, missing, "missing-reference");

  if (missing.status === 0) {
    console.error(
      `\n[${label}] FAILED: the screenshot comparison passed with no reference present. ` +
        "A missing baseline must fail, not silently succeed.",
    );
    process.exitCode = 1;
    return;
  }

  if (listPngs().length > 0) {
    console.error(
      `\n[${label}] FAILED: a CI run with a missing reference wrote a new screenshot ` +
        "instead of failing cleanly. That would let a missing baseline slip through.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n[${label}] PASSED: ${messages.passed}`);
  process.exitCode = 0;
}
