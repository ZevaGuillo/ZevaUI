import { createThemedStorybookVitestConfig } from "./vitest.shared.js";

// The gate run only: exactly the `a11y-negative` story, run in isolation
// under each of the three themes. See scripts/assert-gate-fails.js for how
// the exit code is interpreted.
export default createThemedStorybookVitestConfig({ include: ["a11y-negative"] });
