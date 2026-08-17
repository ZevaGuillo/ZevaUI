import { createStorybookVitestConfig } from "./vitest.shared.js";

// The normal `pnpm test` run: only stories carrying the (implicit) `test`
// tag. BrokenA11y is tagged `!test`, so it never runs here.
export default createStorybookVitestConfig({ include: ["test"] });
