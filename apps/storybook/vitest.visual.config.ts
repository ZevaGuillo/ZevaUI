import { createStorybookVitestConfig } from "./vitest.shared.js";

// The visual run: only stories carrying the `visual` tag (see RF-QVB09).
// Live since the first baseline dispatch: ci.yml runs it as the final step
// of the `ci` job against the 38 committed `-chromium-linux` baselines.
export default createStorybookVitestConfig({ include: ["visual"] });
