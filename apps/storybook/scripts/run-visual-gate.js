// The storybook-side wiring shared by both visual gate scripts.
//
// @zevaui/config/gate-harness owns the MECHANICS every gate in the repository
// shares — the four-step choreography, the exit-code reading, the crash
// branch. This module owns the layer between that and a gate script: the
// facts that are true of every visual gate IN THIS PACKAGE and nowhere else.
//
// Those facts were previously spelled out at each call site, which meant the
// pinned frame, the env var and the screenshot path convention each had two
// homes. Changing the viewport in vitest.shared.ts and updating only one of
// them would leave the other gate asserting against a frame it no longer
// produces — and a gate that fails for the wrong reason teaches nobody
// anything.
//
// Deliberately NOT owned here, and deliberately left at each call site: which
// fixture a gate plants, the values it renders, and its PASS/FAIL prose. That
// is the part that makes a red gate actionable at 3am, and collapsing the two
// scripts into one flag-parameterised runner would destroy it. This module
// removes the wiring, not the argument.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVitestBin, runScreenshotGate } from "@zevaui/config/gate-harness";

// This module sits in <packageRoot>/scripts/, so one level up is the package
// root. Resolved from THIS file rather than passed in by each caller: every
// visual gate script is a sibling, so they all derive the identical value.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The frame the capture box produces, measured in PR4: 1200 is the story
// iframe's own internal width, reached by preview.ts's #vitest-tester
// override, and 720 is vitest.shared.ts's pinned viewport height. One home,
// because a drift between the two gates would be invisible until one of them
// failed for a reason that had nothing to do with its fixture.
const EXPECTED_FRAME = { width: 1200, height: 720 };

// The Vite `define` both fixtures read, so one story can render two different
// values across separate vitest invocations. See vitest.shared.ts.
const LABEL_ENV_VAR = "VISUAL_GATE_LABEL";

// Where the storybook vitest runner writes a story's baselines, relative to
// the package root. The trailing segment is the story FILE name.
const SCREENSHOTS_ROOT = ["stories", "__gate__", "__screenshots__"];

/**
 * Runs one visual gate: `configFile` is the isolated vitest config naming the
 * gate's own tag, `storyFile` the fixture whose baselines it seeds, and
 * `seedValue` / `mismatchValue` the two values the fixture renders across the
 * seed and mismatch runs. `messages` stays the caller's.
 *
 * `import.meta.resolve` is taken here rather than passed in because this
 * module lives in the storybook package — the one whose dependency graph is
 * meant to reach vitest. Anchoring it in @zevaui/config would resolve from a
 * package that does not declare vitest at all.
 */
export function runVisualGate({
  label,
  configFile,
  storyFile,
  seedValue,
  mismatchValue,
  messages,
}) {
  runScreenshotGate({
    label,
    packageRoot,
    vitestBin: resolveVitestBin(import.meta.resolve),
    configPath: path.join(packageRoot, configFile),
    screenshotsDir: path.join(packageRoot, ...SCREENSHOTS_ROOT, storyFile),
    envVar: LABEL_ENV_VAR,
    seedValue,
    mismatchValue,
    expectedFrame: EXPECTED_FRAME,
    messages,
  });
}
