// Proves the visual gate has teeth: runs the deliberately broken story
// (see stories/__gate__/BrokenVisual.stories.tsx) through Vitest, scoped to
// the `visual-negative` tag. Seeds a baseline under one label, checks the
// PNG's dimensions structurally, re-runs under a different label and asserts
// the comparison catches the mismatch, then deletes the reference and
// asserts a missing baseline also fails without writing anything back.
//
// The four-step choreography, the exit-code reading and the crash branch
// live in @zevaui/config/gate-harness, shared with the overlay gate and —
// for the mechanics — with the accessibility and bundle-budget gates. What
// stays here is what only this gate can say.
//
// SCOPE, and why the overlay gate exists next to this one: BrokenVisual
// renders a plain Button INSIDE the story root. This gate would therefore
// keep passing even if the capture frame excluded every portal, which is the
// property assert-visual-overlay-fails.js was written to prove.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVitestBin, runScreenshotGate } from "@zevaui/config/gate-harness";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

// The frame the capture box produces, measured (PR4): 1200 is the story
// iframe's own internal width, reached by preview.ts's #vitest-tester
// override, and 720 is vitest.shared.ts's pinned viewport height.
runScreenshotGate({
  label: "visual-gate",
  packageRoot,
  vitestBin: resolveVitestBin(import.meta.resolve),
  configPath: path.join(packageRoot, "vitest.visual-gate.config.ts"),
  screenshotsDir: path.join(
    packageRoot,
    "stories",
    "__gate__",
    "__screenshots__",
    "BrokenVisual.stories.tsx",
  ),
  envVar: "VISUAL_GATE_LABEL",
  seedValue: "Publish",
  mismatchValue: "Publisc",
  expectedFrame: { width: 1200, height: 720 },
  messages: {
    notCaught:
      "the deliberately broken story (BrokenVisual/SimpleLabel) passed its screenshot " +
      "comparison after its label changed by one letter. The gate is not catching real " +
      "visual regressions.",
    passed:
      "the seeded baseline is the full frame, a one-letter label change correctly failed " +
      "the comparison, and a missing reference correctly fails without writing a new one. " +
      "The gate has teeth.",
  },
});
