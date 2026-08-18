import { createStorybookVitestConfig } from "./vitest.shared.js";

// The visual gate run only: exactly the `visual-negative` fixtures, run in
// isolation. See scripts/assert-visual-gate-fails.js for how the exit code
// is interpreted, and vitest.shared.ts for VISUAL_GATE_LABEL — the same
// BrokenVisual story renders two different labels across separate
// invocations of this config.
export default createStorybookVitestConfig({ include: ["visual-negative"] });
