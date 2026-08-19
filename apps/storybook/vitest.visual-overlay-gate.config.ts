import { createStorybookVitestConfig } from "./vitest.shared.js";

// The overlay visual-gate run only: exactly the `visual-negative-overlay`
// fixture, isolated from vitest.visual-gate.config.ts's own
// `visual-negative` one. The isolation is load-bearing, not tidiness:
// scripts/assert-visual-overlay-fails.js proves its point from a NONZERO
// exit, so a run that also carried the non-portalled BrokenVisual fixture
// could exit nonzero for that story's reason and report a portal proof
// that never actually happened.
export default createStorybookVitestConfig({ include: ["visual-negative-overlay"] });
