import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { isCrash, runNode } from "@zevaui/config/gate-harness";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const entryScriptPath = path.join(scriptDir, "..", "scripts", "audit-usage.js");

let tempDirs: string[] = [];

function makeWorkspace(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "zevaui-audit-usage-"));
  tempDirs.push(dir);
  return dir;
}

function runEntry(workspaceRoot: string, extraEnv: Record<string, string>) {
  return runNode({
    args: [entryScriptPath],
    cwd: workspaceRoot,
    env: { ...process.env, GITHUB_WORKSPACE: workspaceRoot, ...extraEnv },
  });
}

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

describe("audit-usage.js entry", () => {
  it("(a) exits 1 when @zevaui/components is not a dependency at all", () => {
    const workspaceRoot = makeWorkspace();
    writeFileSync(path.join(workspaceRoot, "package.json"), JSON.stringify({ dependencies: {} }));

    const result = runEntry(workspaceRoot, { AUDIT_APP: "web" });

    expect(isCrash(result)).toBe(false);
    expect(result.status).toBe(1);
  });

  it('(b) exits 1 with a containment error when working-directory resolves outside GITHUB_WORKSPACE', () => {
    const workspaceRoot = makeWorkspace();
    writeFileSync(
      path.join(workspaceRoot, "package.json"),
      JSON.stringify({ dependencies: { "@zevaui/components": "^1.0.0" } }),
    );

    const result = runEntry(workspaceRoot, {
      AUDIT_APP: "web",
      AUDIT_WORKING_DIRECTORY: "../..",
    });

    expect(isCrash(result)).toBe(false);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/outside/i);
  });

  it('(c) exits 1 (D3 fail-closed) when working-directory != "." and no app is given', () => {
    const workspaceRoot = makeWorkspace();
    mkdirSync(path.join(workspaceRoot, "app"), { recursive: true });
    writeFileSync(
      path.join(workspaceRoot, "app", "package.json"),
      JSON.stringify({ dependencies: { "@zevaui/components": "^1.0.0" } }),
    );

    const result = runEntry(workspaceRoot, { AUDIT_WORKING_DIRECTORY: "app" });

    expect(isCrash(result)).toBe(false);
    expect(result.status).toBe(1);
  });

  it("(d) two invocations with distinct app/working-directory produce distinct `app` values", () => {
    const workspaceRoot = makeWorkspace();
    for (const app of ["web", "admin"]) {
      const appDir = path.join(workspaceRoot, app);
      mkdirSync(appDir, { recursive: true });
      writeFileSync(
        path.join(appDir, "package.json"),
        JSON.stringify({ dependencies: { "@zevaui/components": "^1.0.0" } }),
      );
    }

    const webResult = runEntry(workspaceRoot, { AUDIT_APP: "web", AUDIT_WORKING_DIRECTORY: "web" });
    const adminResult = runEntry(workspaceRoot, {
      AUDIT_APP: "admin",
      AUDIT_WORKING_DIRECTORY: "admin",
    });

    expect(isCrash(webResult)).toBe(false);
    expect(isCrash(adminResult)).toBe(false);
    expect(webResult.status).toBe(0);
    expect(adminResult.status).toBe(0);

    const webReport = JSON.parse(webResult.stdout);
    const adminReport = JSON.parse(adminResult.stdout);
    expect(webReport.app).toBe("web");
    expect(adminReport.app).toBe("admin");
    expect(webReport.app).not.toBe(adminReport.app);
  });
});
