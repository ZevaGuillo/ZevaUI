// Closes `ADR-0022`'s named follow-up: the root `NOTICE` existed "in the git
// repository and nowhere else", because npm auto-includes `LICENSE` into a
// tarball but does NOT auto-include `NOTICE`, and every publishable package
// declares `"files": ["dist"]`. Apache-2.0 §4(d) obliges the NOTICE to travel
// with the distribution, and `@zevaui/constraints@1.0.0` shipped on
// 2026-10-15 without it — measured against the published tarball, not assumed.
//
// Two properties are asserted, and they fail for different reasons:
//
//   1. STRUCTURE — each publishable package carries byte-identical `LICENSE`
//      and `NOTICE` copies. Copies, not symlinks: npm follows neither into a
//      tarball, and `pnpm pack` would resolve them against the publisher's
//      filesystem rather than the package. Copies drift, which is exactly why
//      this half exists — the four `LICENSE` copies sat ungated until now.
//
//   2. PACKING — npm's OWN packer lists both files. This is the slow half and
//      it earns its cost: the gap being closed here was born from assuming
//      npm's packing behaviour ("it bundles LICENSE, surely it bundles
//      NOTICE"). A `files` array containing "NOTICE" is proxy evidence; asking
//      `npm pack` what would actually ship is the real answer, and it is the
//      only form that would also catch an `.npmignore` or a `files` entry that
//      npm resolves differently than a reader expects.
//
// Lives in packages/config next to the other repo-root gates because the
// property spans every workspace and belongs to none.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dirname, "..", "..", "..");
const packagesDir = path.join(repoRoot, "packages");

/**
 * The two files Apache-2.0 requires a recipient to receive: §4(a) for the
 * License itself, §4(d) for the NOTICE.
 */
const LEGAL_FILES = ["LICENSE", "NOTICE"] as const;

/**
 * `npm pack` spawns a real npm, and npm is not fast. Measured on this repo:
 * ~2.5 s per package run alone, and `cli-scripts-entrypoint.test.ts` already
 * recorded the sharper half of this lesson — under `turbo run test` every
 * other package's suite competes for the machine, so a budget sized against a
 * solo run dies as a flake rather than a failure. One budget for the file,
 * since every slow test here is slow for the same reason.
 */
vi.setConfig({ testTimeout: 60_000 });

/**
 * DERIVED from the workspace, never listed. ADR-0002 draws publishability as a
 * structural line — everything under `packages/` is publishable unless it
 * declares `private` — so a fifth publishable package is covered by this gate
 * on the day it is added, with no edit here. A hardcoded list would instead
 * let that package ship with no NOTICE and a green suite.
 */
function discoverPublishablePackages(): { dir: string; name: string }[] {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packagesDir, entry.name))
    .filter((dir) => existsSync(path.join(dir, "package.json")))
    .map((dir) => ({
      dir,
      manifest: JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
        name: string;
        private?: boolean;
      },
    }))
    .filter(({ manifest }) => manifest.private !== true)
    .map(({ dir, manifest }) => ({ dir, name: manifest.name }));
}

const publishablePackages = discoverPublishablePackages();

/** What `npm pack` would actually put in the tarball, by npm's own reckoning. */
function packedPaths(packageDir: string): string[] {
  // `shell: true` with a fixed literal command and no interpolation: on
  // Windows `npm` is `npm.cmd`, which Node refuses to spawn without a shell.
  // The varying part is `cwd`, which is an option rather than a substring, so
  // nothing user- or path-derived is ever parsed by the shell.
  const result = spawnSync("npm pack --dry-run --json --ignore-scripts", {
    cwd: packageDir,
    shell: true,
    encoding: "utf8",
  });

  // A crashed packer must never read as "the file is missing" (nor as a pass):
  // the two have different fixes, and conflating them is how a broken gate
  // gets reported as a working one.
  expect(result.status, `npm pack failed in ${packageDir}:\n${result.stderr ?? ""}`).toBe(0);

  const report = JSON.parse(result.stdout) as { files: { path: string }[] }[];
  return report[0].files.map((file) => file.path);
}

describe("LICENSE and NOTICE reach every published npm tarball", () => {
  // Fail-closed on the derivation itself. Without this, a glob or a layout
  // change that discovers zero packages makes every `it.each` below vanish and
  // the gate pass while asserting nothing — the failure mode ADR-0008 named
  // for the visual partitions and refused to allow there either.
  it("discovers the publishable packages from the workspace itself", () => {
    expect(publishablePackages.length).toBeGreaterThanOrEqual(4);
    expect(publishablePackages.map((pkg) => pkg.name).sort()).toEqual([
      "@zevaui/components",
      "@zevaui/constraints",
      "@zevaui/mcp",
      "@zevaui/tokens",
    ]);
  });

  describe.each(publishablePackages)("$name", ({ dir }) => {
    it.each(LEGAL_FILES)("carries a byte-identical %s copy", (legalFile) => {
      const rootBytes = readFileSync(path.join(repoRoot, legalFile));
      const packagePath = path.join(dir, legalFile);

      expect(existsSync(packagePath), `${packagePath} does not exist`).toBe(true);
      expect(readFileSync(packagePath).equals(rootBytes)).toBe(true);
    });

    it("packs both legal files, by npm's own reckoning", () => {
      expect(packedPaths(dir)).toEqual(expect.arrayContaining([...LEGAL_FILES]));
    });
  });
});
