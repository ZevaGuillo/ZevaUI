import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isMainModule } from "../src/lib/is-main-module.js";

// Defect 4: the CLI-runner guard `import.meta.url === \`file://${process.argv[1]}\`` silently
// no-ops on Windows -- `process.argv[1]` keeps backslashes ("D:\\repo\\scripts\\build-release-log.ts")
// while `import.meta.url` is a forward-slash `file:///` URL, so the two never match. The failure
// mode is dangerous: exit 0, no output, no diagnostic -- indistinguishable from success. Both
// scripts.build-release-log.ts and scripts/export-registry.ts shared this bug (inherited from PR2).
describe("isMainModule (Windows CLI-runner guard fix)", () => {
  it("matches when argv[1] uses Windows backslash separators", () => {
    const argvPath = "D:\\repo\\apps\\dashboard\\scripts\\build-release-log.ts";
    const moduleUrl = pathToFileURL(argvPath).href;
    expect(isMainModule(moduleUrl, argvPath)).toBe(true);
  });

  it("proves the old naive file:// + argv concatenation comparison would have failed for the same input", () => {
    const argvPath = "D:\\repo\\apps\\dashboard\\scripts\\build-release-log.ts";
    const moduleUrl = pathToFileURL(argvPath).href;
    const oldNaiveComparison = moduleUrl === `file://${argvPath}`;
    expect(oldNaiveComparison).toBe(false);
  });

  it("still matches on POSIX-style argv[1] paths, preserving existing behavior", () => {
    const argvPath = "/repo/apps/dashboard/scripts/build-release-log.ts";
    const moduleUrl = pathToFileURL(argvPath).href;
    expect(isMainModule(moduleUrl, argvPath)).toBe(true);
  });

  it("returns false when the module URL does not correspond to argv[1]", () => {
    const argvPath = "/repo/apps/dashboard/scripts/build-release-log.ts";
    const otherModuleUrl = pathToFileURL("/repo/apps/dashboard/scripts/export-registry.ts").href;
    expect(isMainModule(otherModuleUrl, argvPath)).toBe(false);
  });
});
