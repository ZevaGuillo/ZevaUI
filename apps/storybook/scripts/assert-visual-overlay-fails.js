// Proves the visual gate has teeth ON THE PORTALLED PATH — the one property
// assert-visual-gate-fails.js cannot establish, because its fixture
// (BrokenVisual/SimpleLabel, a plain Button) renders inside the story root
// and would keep passing even if the capture frame excluded every portal.
//
// The choreography is the shared one in @zevaui/config/gate-harness. What
// makes this gate different is the fixture, and what its failure means:
//
// BrokenVisualOverlay renders a Dialog with no trigger, so `canvasElement` is
// effectively empty and the only text that varies between the two runs is the
// dialog TITLE, which react-aria portals out of the story root.
//
//   The mismatch run FAILS  -> the two frames genuinely differ -> the
//                    portalled title IS inside the captured frame -> PASS.
//   The mismatch run PASSES -> both frames were identical -> the frame is
//                    empty or clipped short of the portal, and the 14 real
//                    overlay baselines would assert NOTHING while passing
//                    forever -> this script exits 1.
//
// Scoped to the `visual-negative-overlay` tag and to that tag ALONE. The
// argument runs off a nonzero exit code, so a run that also carried the
// non-portalled fixture could exit nonzero for THAT story's reason and let
// this script report a portal proof that never happened.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveVitestBin, runScreenshotGate } from "@zevaui/config/gate-harness";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, "..");

// WIDTH is the load-bearing dimension here: the ADR-0005 scrim spans the
// frame horizontally, so a capture that silently narrows is precisely how
// overlay coverage would rot back into a false pass with nothing turning red.
runScreenshotGate({
  label: "visual-overlay-gate",
  packageRoot,
  vitestBin: resolveVitestBin(import.meta.resolve),
  configPath: path.join(packageRoot, "vitest.visual-overlay-gate.config.ts"),
  screenshotsDir: path.join(
    packageRoot,
    "stories",
    "__gate__",
    "__screenshots__",
    "BrokenVisualOverlay.stories.tsx",
  ),
  envVar: "VISUAL_GATE_LABEL",
  seedValue: "Delete project",
  mismatchValue: "Delete projecc",
  expectedFrame: { width: 1200, height: 720 },
  messages: {
    notCaught:
      "the deliberately broken story (BrokenVisualOverlay/PortalledTitle) passed its " +
      "screenshot comparison after its dialog TITLE changed. That title is rendered " +
      "inside the react-aria portal, so an identical frame means the capture box does " +
      "not contain the portalled overlay — the 14 real Dialog/Menu baselines would pass " +
      "forever while asserting nothing.",
    passed:
      "changing a title that only exists inside the react-aria portal correctly failed " +
      "the comparison. The captured frame genuinely contains the portalled overlay.",
  },
});
