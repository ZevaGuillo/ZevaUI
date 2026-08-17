import { createStorybookVitestConfig } from "./vitest.shared.js";

// The gate run only: exactly the `a11y-negative` story, run in isolation.
// See scripts/assert-gate-fails.js for how the exit code is interpreted.
export default createStorybookVitestConfig({ include: ["a11y-negative"] });
