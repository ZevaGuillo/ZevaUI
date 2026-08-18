// Proves the visual gate has teeth: runs the deliberately broken story
// (see stories/__gate__/BrokenVisual.stories.tsx) through Vitest, scoped to
// the `visual-negative` tag. Seeds a baseline for one label, checks its PNG
// dimensions structurally, re-runs against a different label and asserts
// the comparison actually catches the mismatch, then deletes the reference
// and asserts a missing baseline also fails (and writes nothing back).
//
//   The mismatch run FAILS (nonzero, non-crash exit) -> the gate caught the
//                    visual regression -> this script exits 0 (PASS).
//   The mismatch run exits 0                         -> the gate did NOT
//                    catch it (no screenshot assertion ran, or the compare
//                    was a false match) -> this script exits 1 (FAIL).
//   status null,     -> a vitest invocation crashed (killed by signal, or
//   or status>=126      could not be spawned/executed) rather than failing
//                       an assertion -> this script exits 1 with a DISTINCT
//                       message. A crash silently reported as a passing
//                       gate is the failure mode this script exists to
//                       prevent.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const configPath = path.join(packageRoot, "vitest.visual-gate.config.ts");
const screenshotsDir = path.join(
  packageRoot,
  "stories",
  "__gate__",
  "__screenshots__",
  "BrokenVisual.stories.tsx",
);

// Matches the pinned viewport in vitest.shared.ts's contextOptions.
const PINNED_VIEWPORT_HEIGHT = 720;
const SEED_LABEL = "Publish";
const MISMATCH_LABEL = "Publisc";

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

function runVitest({ label, update, ci }) {
  const vitestBin = resolveVitestBin();
  const args = [vitestBin, "run", "--config", configPath];
  if (update) args.push("--update");

  const env = { ...process.env, VISUAL_GATE_LABEL: label };
  if (ci) {
    env.CI = "true";
  } else {
    // Explicitly unset, in case the ambient shell already has it — the seed
    // step must be unambiguous evidence of the seeding path, independent of
    // whatever environment this script happens to run in.
    delete env.CI;
  }

  const result = spawnSync(process.execPath, args, {
    cwd: packageRoot,
    shell: false,
    encoding: "utf8",
    env,
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  return result;
}

function isCrash(result) {
  return result.status === null || result.status >= 126;
}

function reportCrash(step, result) {
  console.error(
    `\n[visual-gate] CRASHED during "${step}" instead of asserting: the vitest ` +
      `process did not complete normally (status=${result.status}, signal=${result.signal}). ` +
      "This is a process failure, not a caught assertion — a crash reported as a " +
      "passing gate is the worst outcome here, so this counts as FAIL.",
  );
  process.exitCode = 1;
}

function readSeededPngs() {
  if (!existsSync(screenshotsDir)) return [];
  return readdirSync(screenshotsDir)
    .filter((name) => name.endsWith(".png"))
    .map((name) => path.join(screenshotsDir, name));
}

// PNG IHDR chunk: 8-byte signature, then a 4-byte chunk length + 4-byte
// "IHDR" type, then width (4 bytes, offset 16) and height (4 bytes, offset
// 20), both big-endian. No PNG-parsing dependency needed for two integers.
function readPngHeight(pngPath) {
  const buffer = readFileSync(pngPath);
  return buffer.readUInt32BE(20);
}

function main() {
  // 1. Seed a baseline for the "Publish" label.
  const seed = runVitest({ label: SEED_LABEL, update: true, ci: false });
  if (isCrash(seed)) return reportCrash("seed", seed);

  // 2. Structural check: the seeded PNG must exist, and its height must
  //    match the pinned viewport (720px) — a collapsed capture box is
  //    caught here structurally, not only behaviourally by step 3.
  const seededPngs = readSeededPngs();
  if (seededPngs.length === 0) {
    console.error(
      "\n[visual-gate] FAILED: the seed run wrote no screenshot at " +
        `${screenshotsDir}. No screenshot assertion ran for the visual-negative ` +
        "fixture, so the gate cannot have teeth.",
    );
    process.exitCode = 1;
    return;
  }
  for (const pngPath of seededPngs) {
    const height = readPngHeight(pngPath);
    if (height !== PINNED_VIEWPORT_HEIGHT) {
      console.error(
        `\n[visual-gate] FAILED: ${path.basename(pngPath)} has height ${height}px, ` +
          `expected ${PINNED_VIEWPORT_HEIGHT}px (the pinned viewport). The capture box ` +
          "did not take effect.",
      );
      process.exitCode = 1;
      return;
    }
  }

  // 3. Mismatch: same story, a different label, CI=true (the real gate
  //    environment). This MUST fail — a pass here means the comparison
  //    never ran, or ran against a false match.
  const mismatch = runVitest({ label: MISMATCH_LABEL, update: false, ci: true });
  if (isCrash(mismatch)) return reportCrash("mismatch", mismatch);

  if (mismatch.status === 0) {
    console.error(
      "\n[visual-gate] FAILED: the deliberately broken story " +
        "(BrokenVisual/SimpleLabel) passed its screenshot comparison after its " +
        "label changed. The gate is not catching real visual regressions.",
    );
    process.exitCode = 1;
    return;
  }

  // 4. Missing reference: delete the seeded baseline(s) and re-run under
  //    CI=true. Must fail (not silently pass) and must write nothing back.
  for (const pngPath of seededPngs) rmSync(pngPath);

  const missing = runVitest({ label: SEED_LABEL, update: false, ci: true });
  if (isCrash(missing)) return reportCrash("missing-reference", missing);

  if (missing.status === 0) {
    console.error(
      "\n[visual-gate] FAILED: the screenshot comparison passed with no reference " +
        "present. A missing baseline must fail, not silently succeed.",
    );
    process.exitCode = 1;
    return;
  }

  if (readSeededPngs().length > 0) {
    console.error(
      "\n[visual-gate] FAILED: a CI run with a missing reference wrote a new " +
        "screenshot instead of failing cleanly. That would let a missing " +
        "baseline slip through unnoticed.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "\n[visual-gate] PASSED: the seeded baseline is viewport-height, the mismatch " +
      "run correctly failed on the relabeled story, and a missing reference " +
      "correctly fails without writing a new one. The gate has teeth.",
  );
  process.exitCode = 0;
}

main();
