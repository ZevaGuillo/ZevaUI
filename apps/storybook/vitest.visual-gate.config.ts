import { createStorybookVitestConfig } from "./vitest.shared.js";

// The visual gate run only: exactly the `visual-negative` fixtures, run in
// isolation. See scripts/assert-visual-gate-fails.js for how the exit code
// is interpreted. `VISUAL_GATE_LABEL` lets the same BrokenVisual story
// render two different labels across separate invocations of this config,
// instead of needing two near-duplicate stories.
export default createStorybookVitestConfig(
  { include: ["visual-negative"] },
  {
    define: {
      __VISUAL_GATE_LABEL__: JSON.stringify(process.env.VISUAL_GATE_LABEL ?? "Publish"),
    },
  },
);
