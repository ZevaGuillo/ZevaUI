import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportRegistry } from "../scripts/export-registry.js";

let outDir = "";
afterEach(() => rmSync(outDir, { recursive: true, force: true }));

const rowKnownNone = {
  repository: "acme/web",
  appLabel: "web",
  dsVersion: "1.4.0",
  dsVersionSource: "installed",
  components: ["Button"],
  deprecatedComponents: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
};
const rowUnknown = {
  ...rowKnownNone,
  repository: "acme/admin",
  appLabel: "admin",
  deprecatedComponents: null,
};

describe("exportRegistry (D2: repo-as-registry escape hatch)", () => {
  it("writes reports/{owner}/{repo}/{app}.json, matching the audit shape, honoring null-vs-[] -- no live DB", async () => {
    outDir = mkdtempSync(path.join(tmpdir(), "zevaui-dashboard-export-"));
    const written = await exportRegistry({
      outDir,
      listAllLatest: async () => [rowKnownNone, rowUnknown],
    });
    expect(written).toHaveLength(2);

    const web = JSON.parse(readFileSync(path.join(outDir, "acme", "web", "web.json"), "utf8"));
    const admin = JSON.parse(
      readFileSync(path.join(outDir, "acme", "admin", "admin.json"), "utf8"),
    );
    expect(Object.keys(web)).toEqual([
      "app",
      "dsVersion",
      "dsVersionSource",
      "components",
      "generatedAt",
      "deprecatedComponents",
    ]);
    expect(web.deprecatedComponents).toEqual([]);
    expect(admin).not.toHaveProperty("deprecatedComponents");
  });

  // The view keys latest-report identity on (repository_id, app_label), so two
  // repositories CAN both report an app called "web". Keyed on the app alone,
  // the second write silently destroyed the first.
  it("keeps both reports when two repositories share one app label", async () => {
    outDir = mkdtempSync(path.join(tmpdir(), "zevaui-dashboard-export-"));
    const written = await exportRegistry({
      outDir,
      listAllLatest: async () => [
        { ...rowKnownNone, repository: "acme/web", components: ["Button"] },
        { ...rowKnownNone, repository: "globex/web", components: ["Card"] },
      ],
    });

    expect(new Set(written).size).toBe(2);
    const acme = JSON.parse(readFileSync(path.join(outDir, "acme", "web", "web.json"), "utf8"));
    const globex = JSON.parse(readFileSync(path.join(outDir, "globex", "web", "web.json"), "utf8"));
    expect(acme.components).toEqual(["Button"]);
    expect(globex.components).toEqual(["Card"]);
  });

  // Both halves of the identity are consumer-supplied text. Nothing may escape
  // outDir once PR3 opens the write path.
  it.each([
    ["app label", { ...rowKnownNone, appLabel: "../../escaped" }],
    ["repository owner", { ...rowKnownNone, repository: "../../etc/web" }],
    ["repository shape", { ...rowKnownNone, repository: "no-slash" }],
  ])("refuses to write when the %s is unsafe", async (_case, row) => {
    outDir = mkdtempSync(path.join(tmpdir(), "zevaui-dashboard-export-"));
    await expect(exportRegistry({ outDir, listAllLatest: async () => [row] })).rejects.toThrow(
      /export:registry/,
    );
  });
});
