import { createStorybookVitestConfig } from "./vitest.shared.js";

// The visual run: only stories carrying the `visual` tag (inert until the
// gate mechanism from PR4 lands and tags the stories — see RF-QVB09).
export default createStorybookVitestConfig({ include: ["visual"] });
