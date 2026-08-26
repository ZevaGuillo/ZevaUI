import { createThemedStorybookVitestConfig } from "./vitest.shared.js";

// The normal `pnpm test` run: only stories carrying the (implicit) `test`
// tag, each run once per theme (light, dark, high-contrast). BrokenA11y is
// tagged `!test`, so it never runs here.
export default createThemedStorybookVitestConfig({ include: ["test"] });
