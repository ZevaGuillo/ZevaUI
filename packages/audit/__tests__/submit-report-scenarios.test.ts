// RF-AR06 scenarios 1 and 2, run against the REAL entrypoint as a spawned
// child process — this is the runtime harness that proves the fire-and-
// tolerate contract end to end, not just the retry/timeout state machine
// (already unit-tested in submit-report.test.ts). Split into its own file
// so it lands together with the workflow wiring it validates
// (.github/workflows/audit-ds-usage.yml).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const entryScriptPath = path.join(dirname, "..", "scripts", "submit-report.js");

describe("submit-report.js entrypoint (fire-and-tolerate, RF-AR06)", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("makes no submission and exits 0 when REGISTRY_URL is unset (scenario 1: disabled by default)", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "zevaui-submit-report-"));
    const reportPath = path.join(tempDir, "ds-usage-report.json");
    const reportBytes = '{"app":"web"}\n';
    writeFileSync(reportPath, reportBytes);

    const result = spawnSync(process.execPath, [entryScriptPath], {
      encoding: "utf8",
      env: { ...process.env, REGISTRY_URL: "", REGISTRY_REPORT_PATH: reportPath },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain("submitted");
    // The report the scan step already wrote is never touched by this step.
    expect(readFileSync(reportPath, "utf8")).toBe(reportBytes);
  });

  it("exits 0 when the registry is unreachable (scenario 2: registry down does not fail CI)", () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "zevaui-submit-report-"));
    const reportPath = path.join(tempDir, "ds-usage-report.json");
    writeFileSync(reportPath, '{"app":"web"}\n');

    const probe = createServer();
    probe.listen(0);
    const closedPort = (probe.address() as AddressInfo).port;
    probe.close();

    const result = spawnSync(process.execPath, [entryScriptPath], {
      encoding: "utf8",
      timeout: 15_000,
      env: {
        ...process.env,
        REGISTRY_URL: `https://127.0.0.1:${closedPort}`,
        REGISTRY_OIDC_TOKEN: "fake-token",
        REGISTRY_REPORT_PATH: reportPath,
      },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("::warning::");
  });
});
