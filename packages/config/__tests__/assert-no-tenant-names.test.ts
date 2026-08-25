// RF-AR08: `scripts/assert-no-tenant-names.js` is a repo-root gate, not a
// workspace package, so it has no test runner of its own. It is proven here
// instead, next to the shared `runNode`/`isCrash` mechanics every
// "prove the gate has teeth" gate in this repo already uses (the visual
// gates, packages/components' size gate, packages/audit's usage-report gate).
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isCrash, runNode } from "../src/gate-harness.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "assert-no-tenant-names.js");

// Assembled rather than a literal: this test file itself lives under
// packages/* (packages/config), so a literal denylisted string here would
// trip the gate against its OWN test suite. Assembling it keeps the
// substring absent from every committed source file while still planting the
// real value into the disposable fixture at runtime.
const DENYLISTED_NAME = ["zevaui", "consumer", "probe"].join("-");

// A disposable file under packages/*, planted and removed around each run —
// the same self-seeding pattern packages/audit's own gates use, so this test
// never depends on anything committed staying in sync with the denylist.
const plantedFilePath = path.join(
  repoRoot,
  "packages",
  "audit",
  "__fixtures__",
  "tmp-tenant-leak-gate-test.js",
);

function run() {
  return runNode({ args: [scriptPath], cwd: repoRoot });
}

describe("assert-no-tenant-names.js (RF-AR08)", () => {
  it("passes against the real packages/* tree with nothing planted", () => {
    const result = run();
    expect(isCrash(result)).toBe(false);
    expect(result.status).toBe(0);
  });

  it("fails when a denylisted tenant name is planted under packages/*", () => {
    writeFileSync(plantedFilePath, `export const leaked = "${DENYLISTED_NAME}";\n`);
    try {
      const result = run();
      expect(isCrash(result)).toBe(false);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(DENYLISTED_NAME);
      expect(result.stderr).toContain(path.join("packages", "audit", "__fixtures__"));
    } finally {
      rmSync(plantedFilePath, { force: true });
    }
  });
});
