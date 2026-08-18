import { createStorybookVitestConfig } from "./vitest.shared.js";

// The visual gate run only: exactly the `visual-negative` fixtures, run in
// isolation. See scripts/assert-visual-gate-fails.js (PR4) for how the exit
// code is interpreted.
export default createStorybookVitestConfig({ include: ["visual-negative"] });
