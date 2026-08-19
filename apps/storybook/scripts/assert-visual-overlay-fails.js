// Proves the visual gate has teeth ON THE PORTALLED PATH — the one property
// scripts/assert-visual-gate-fails.js cannot establish, because its fixture
// (BrokenVisual/SimpleLabel, a plain Button) renders inside the story root
// and would keep passing even if the capture frame excluded every portal.
//
// Runs stories/__gate__/BrokenVisualOverlay.stories.tsx through Vitest,
// scoped to the `visual-negative-overlay` tag and to that tag ALONE: this
// script argues from a nonzero exit code, so a run that also carried the
// non-portalled fixture could exit nonzero for that story's reason and let
// this script report a portal proof that never happened.
//
// The fixture renders a Dialog with no trigger, so `canvasElement` is
// effectively empty and the only text that varies between the two runs is
// the dialog TITLE, which react-aria portals out of the story root:
//
//   The mismatch run FAILS (nonzero, non-crash exit) -> the two frames
//                    genuinely differ -> the portalled title IS inside the
//                    captured frame -> this script exits 0 (PASS).
//   The mismatch run exits 0                         -> both frames were
//                    identical -> the frame is empty or clipped short of
//                    the portal, and the 14 real overlay baselines would
//                    assert NOTHING while passing forever -> exits 1.
//   status null,     -> a vitest invocation crashed (killed by signal, or
//   or status>=126      could not be spawned/executed) rather than failing
//                       an assertion -> this script exits 1 with a DISTINCT
//                       message. A crash silently reported as a passing
//                       gate is the failure mode this script exists to
//                       prevent.
//
// The three-branch exit handling and the vitest-bin resolution below are
// copied from assert-visual-gate-fails.js deliberately, following the same
// verbatim-copy convention assert-gate-fails.js already set twice in this
// repo. Factoring them out would leave a partial abstraction — two of the
// four gate scripts sharing a module and two not — which is harder to
// reason about than four independent, individually-readable gates.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");
const configPath = path.join(packageRoot, "vitest.visual-overlay-gate.config.ts");
const screenshotsDir = path.join(
  packageRoot,
  "stories",
  "__gate__",
  "__screenshots__",
  "BrokenVisualOverlay.stories.tsx",
);

// The frame the capture box actually produces, measured in PR4 (all 38 real
// baselines are exactly this): 1200 is the story iframe's own internal
// width, reached by preview.ts's #vitest-tester override, and 720 is
// vitest.shared.ts's pinned viewport height. WIDTH is the load-bearing one
// here — the ADR-0005 scrim spans the frame horizontally, so a capture that
// silently narrows is precisely how overlay coverage would rot back into a
// false pass without any test turning red.
const EXPECTED_FRAME_WIDTH = 1200;
const EXPECTED_FRAME_HEIGHT = 720;
const SEED_TITLE = "Delete project";
const MISMATCH_TITLE = "Delete projecc";

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

function runVitest({ title, update, ci }) {
  const vitestBin = resolveVitestBin();
  const args = [vitestBin, "run", "--config", configPath];
  if (update) args.push("--update");

  // The fixture reads its dialog title from __VISUAL_GATE_LABEL__, the same
  // unconditional define every config in this package carries.
  const env = { ...process.env, VISUAL_GATE_LABEL: title };
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
    `\n[visual-overlay-gate] CRASHED during "${step}" instead of asserting: the ` +
      `vitest process did not complete normally (status=${result.status}, ` +
      `signal=${result.signal}). This is a process failure, not a caught assertion — ` +
      "a crash reported as a passing gate is the worst outcome here, so this counts " +
      "as FAIL.",
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
function readPngSize(pngPath) {
  const buffer = readFileSync(pngPath);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function main() {
  // 1. Seed a baseline with the dialog titled "Delete project".
  const seed = runVitest({ title: SEED_TITLE, update: true, ci: false });
  if (isCrash(seed)) return reportCrash("seed", seed);

  // 2. Structural check: the seeded PNG must exist, and must be the full
  //    1200x720 frame. A collapsed or narrowed capture box is caught here
  //    dimensionally, before step 3 has to infer it from behaviour.
  const seededPngs = readSeededPngs();
  if (seededPngs.length === 0) {
    console.error(
      "\n[visual-overlay-gate] FAILED: the seed run wrote no screenshot at " +
        `${screenshotsDir}. No screenshot assertion ran for the overlay fixture, ` +
        "so the gate cannot have teeth on the portalled path.",
    );
    process.exitCode = 1;
    return;
  }
  for (const pngPath of seededPngs) {
    const { width, height } = readPngSize(pngPath);
    if (width !== EXPECTED_FRAME_WIDTH || height !== EXPECTED_FRAME_HEIGHT) {
      console.error(
        `\n[visual-overlay-gate] FAILED: ${path.basename(pngPath)} is ${width}x${height}, ` +
          `expected ${EXPECTED_FRAME_WIDTH}x${EXPECTED_FRAME_HEIGHT}. The capture box ` +
          "did not take effect, so the portalled overlay may be clipped out of the frame.",
      );
      process.exitCode = 1;
      return;
    }
  }

  // 3. THE PORTAL PROOF. Same story, a different dialog title, CI=true (the
  //    real gate environment). This MUST fail: the title only exists inside
  //    the portal, so a pass means the two frames were byte-identical and
  //    the portalled content was never captured at all.
  const mismatch = runVitest({ title: MISMATCH_TITLE, update: false, ci: true });
  if (isCrash(mismatch)) return reportCrash("mismatch", mismatch);

  if (mismatch.status === 0) {
    console.error(
      "\n[visual-overlay-gate] FAILED: the deliberately broken story " +
        "(BrokenVisualOverlay/PortalledTitle) passed its screenshot comparison after " +
        "its dialog TITLE changed. That title is rendered inside the react-aria " +
        "portal, so an identical frame means the capture box does not contain the " +
        "portalled overlay — the 14 real Dialog/Menu baselines would pass forever " +
        "while asserting nothing.",
    );
    process.exitCode = 1;
    return;
  }

  // 4. Missing reference: delete the seeded baseline(s) and re-run under
  //    CI=true. Must fail (not silently pass) and must write nothing back.
  for (const pngPath of seededPngs) rmSync(pngPath);

  const missing = runVitest({ title: SEED_TITLE, update: false, ci: true });
  if (isCrash(missing)) return reportCrash("missing-reference", missing);

  if (missing.status === 0) {
    console.error(
      "\n[visual-overlay-gate] FAILED: the screenshot comparison passed with no " +
        "reference present. A missing baseline must fail, not silently succeed.",
    );
    process.exitCode = 1;
    return;
  }

  if (readSeededPngs().length > 0) {
    console.error(
      "\n[visual-overlay-gate] FAILED: a CI run with a missing reference wrote a new " +
        "screenshot instead of failing cleanly. That would let a missing baseline " +
        "slip through unnoticed.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    "\n[visual-overlay-gate] PASSED: the seeded overlay baseline is the full " +
      `${EXPECTED_FRAME_WIDTH}x${EXPECTED_FRAME_HEIGHT} frame, changing a title that ` +
      "only exists inside the react-aria portal correctly failed the comparison, and " +
      "a missing reference correctly fails without writing a new one. The captured " +
      "frame genuinely contains the portalled overlay.",
  );
  process.exitCode = 0;
}

main();
