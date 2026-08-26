import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// These are the only tests in the suite that spawn the real npm script
// entrypoints as a child process, the way `pnpm run <script>` does. Every
// other CLI-related test imports the script's exported function through
// Vitest's Vite resolver, which performs bundler-style extensionless module
// resolution and therefore proves nothing about whether the actual
// `node <flags> <file>` (or `tsx <file>`) invocation in package.json even
// starts. That gap is exactly how `export:registry` shipped broken: the
// script transitively imports `src/db/queries.ts`, which uses the
// extensionless convention the rest of `apps/dashboard` adopted for
// Turbopack -- a convention the CLI runner must resolve on its own, since
// no bundler sits between package.json's script and the file it runs.
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson: { scripts: Record<string, string> } = JSON.parse(
  readFileSync(path.join(appRoot, "package.json"), "utf8"),
);

/** Spawns a package.json script string exactly as pnpm/npm would invoke it. */
function spawnScript(command: string, env: NodeJS.ProcessEnv) {
  return spawnSync(command, {
    cwd: appRoot,
    shell: true,
    encoding: "utf8",
    env,
    timeout: 30_000,
  });
}

function envWithoutDatabaseUrl(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  return env;
}

describe("export:registry CLI entrypoint (real child process, no DATABASE_URL)", () => {
  it("fails on missing database configuration, not on module resolution", () => {
    const result = spawnScript(packageJson.scripts["export:registry"], envWithoutDatabaseUrl());
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    // This is the explicit regression gate: the CLI runner must resolve every
    // extensionless transitive import before it can even reach the
    // DATABASE_URL check. If module resolution breaks again, this is the
    // failure mode that reappears.
    expect(output).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(output).toContain("DATABASE_URL");
    expect(result.status).not.toBe(0);
  });
});

describe("build-release-log CLI entrypoint (real child process)", () => {
  const outFile = path.join(appRoot, ".generated", "release-log.json");

  it("runs and writes a non-empty .generated/release-log.json", () => {
    rmSync(outFile, { force: true });

    const buildScript = packageJson.scripts.build;
    const releaseLogCommand = buildScript.split("&&")[0]?.trim();
    if (!releaseLogCommand) {
      throw new Error("could not extract the release-log command from the build script");
    }

    const result = spawnScript(releaseLogCommand, envWithoutDatabaseUrl());
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    expect(output).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(result.status).toBe(0);

    expect(existsSync(outFile)).toBe(true);
    const written = readFileSync(outFile, "utf8");
    expect(written.length).toBeGreaterThan(0);
    const parsed: { packages: unknown[] } = JSON.parse(written);
    expect(Array.isArray(parsed.packages)).toBe(true);
  });
});

describe("db:migrate CLI entrypoint (real child process, no DATABASE_URL)", () => {
  it("fails on missing database configuration, not on module resolution", () => {
    const result = spawnScript(packageJson.scripts["db:migrate"], envWithoutDatabaseUrl());
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    // Same regression gate as export:registry -- migrate transitively imports
    // `src/lib/is-main-module.ts` extensionlessly, so the CLI runner has to
    // resolve it with no bundler in between.
    expect(output).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(output).toContain("DATABASE_URL");
    expect(result.status).not.toBe(0);
  });
});
