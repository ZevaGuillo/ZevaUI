// Proves the visual gate has teeth: runs the deliberately broken story
// (see stories/__gate__/BrokenVisual.stories.tsx) through Vitest, scoped to
// the `visual-negative` tag. Seeds a baseline under one label, checks the
// PNG's dimensions structurally, re-runs under a different label and asserts
// the comparison catches the mismatch, then deletes the reference and
// asserts a missing baseline also fails without writing anything back.
//
// The four-step choreography and the exit-code reading live in
// @zevaui/config/gate-harness; the storybook wiring around it lives in
// ./run-visual-gate.js. What stays here is what only this gate can say.
//
// SCOPE, and why the overlay gate exists next to this one: BrokenVisual
// renders a plain Button INSIDE the story root. This gate would therefore
// keep passing even if the capture frame excluded every portal, which is the
// property assert-visual-overlay-fails.js was written to prove.
import { runVisualGate } from "./run-visual-gate.js";

runVisualGate({
  label: "visual-gate",
  configFile: "vitest.visual-gate.config.ts",
  storyFile: "BrokenVisual.stories.tsx",
  seedValue: "Publish",
  mismatchValue: "Publisc",
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
