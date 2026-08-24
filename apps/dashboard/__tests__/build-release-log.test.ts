import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildReleaseLog } from "../scripts/build-release-log.js";

let outDir = "";
afterEach(() => rmSync(outDir, { recursive: true, force: true }));

const MARKDOWN = "# @zevaui/example\n\n## 1.0.0\n\n### Minor Changes\n\n- Initial release.\n";

describe("buildReleaseLog (D5: release log build step, task 4.7/4.8)", () => {
  it("writes .generated/release-log.json aggregating every package's parsed changelog", async () => {
    outDir = mkdtempSync(path.join(tmpdir(), "zevaui-dashboard-release-log-"));
    const outFile = path.join(outDir, "release-log.json");
    const releaseLog = buildReleaseLog({
      outFile,
      listChangelogs: () => [{ packageName: "@zevaui/example", markdown: MARKDOWN }],
    });

    expect(releaseLog.packages).toEqual([
      {
        package: "@zevaui/example",
        releases: [{ version: "1.0.0", changes: [{ type: "minor", text: "Initial release." }] }],
      },
    ]);
    const written = JSON.parse(readFileSync(outFile, "utf8"));
    expect(written.packages).toEqual(releaseLog.packages);
    expect(typeof written.generated).toBe("string");
  });

  it("skips a packages/* directory with no CHANGELOG.md, without throwing", async () => {
    outDir = mkdtempSync(path.join(tmpdir(), "zevaui-dashboard-release-log-"));
    const outFile = path.join(outDir, "release-log.json");
    const releaseLog = buildReleaseLog({ outFile, listChangelogs: () => [] });
    expect(releaseLog.packages).toEqual([]);
  });
});
