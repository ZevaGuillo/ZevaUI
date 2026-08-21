import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCrash, runNode } from "@zevaui/config/gate-harness";
import { afterEach, describe, expect, it } from "vitest";

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

  it("(b) exits 1 with a containment error when working-directory resolves outside GITHUB_WORKSPACE", () => {
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

  it("(e) reports a corrupt consumer package.json through fail(), not as a raw crash", () => {
    const workspaceRoot = makeWorkspace();
    writeFileSync(path.join(workspaceRoot, "package.json"), '{ "dependencies": ');

    const result = runEntry(workspaceRoot, { AUDIT_APP: "web" });

    expect(isCrash(result)).toBe(false);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("[audit-usage] FAIL:");
    // A raw stack trace means the deliberate failure path was bypassed.
    expect(result.stderr).not.toMatch(/^\s+at /m);
  });
});

describe("step summary rendering", () => {
  // dsVersion comes from the CONSUMER's package.json and app from a workflow
  // input: both are arbitrary text this repo does not control. Unescaped,
  // a `|` or newline in either corrupts the table and can fabricate a row.
  it("escapes pipes and newlines so a hostile dsVersion cannot forge a table row", () => {
    const workspaceRoot = makeWorkspace();
    mkdirSync(path.join(workspaceRoot, "src"), { recursive: true });
    writeFileSync(
      path.join(workspaceRoot, "package.json"),
      JSON.stringify({
        dependencies: { "@zevaui/components": "1.0.0 | INJECTED |\n| fake | row |" },
      }),
    );
    writeFileSync(
      path.join(workspaceRoot, "src", "a.tsx"),
      'import { Button } from "@zevaui/components";\n',
    );
    const summaryPath = path.join(workspaceRoot, "summary.md");
    writeFileSync(summaryPath, "");

    const result = runEntry(workspaceRoot, {
      AUDIT_APP: "web",
      GITHUB_STEP_SUMMARY: summaryPath,
    });
    expect(result.status).toBe(0);

    const summary = readFileSync(summaryPath, "utf8");
    const rows = summary.split("\n").filter((line) => line.startsWith("|"));
    // Header, separator, and exactly five data rows — no forged sixth.
    expect(rows).toHaveLength(7);
    expect(summary).not.toContain("| fake | row |");
  });

  // A lone CR is a line terminator too — old-Mac line endings, and what a
  // CRLF value degrades to once only the LF is stripped. Escaping \r\n and \n
  // but not \r leaves the one form that still renders as a break.
  it("neutralizes a lone carriage return, not just LF and CRLF", () => {
    const workspaceRoot = makeWorkspace();
    mkdirSync(path.join(workspaceRoot, "src"), { recursive: true });
    writeFileSync(
      path.join(workspaceRoot, "package.json"),
      JSON.stringify({
        dependencies: { "@zevaui/components": "1.0.0\r| fake | row |" },
      }),
    );
    writeFileSync(
      path.join(workspaceRoot, "src", "a.tsx"),
      'import { Button } from "@zevaui/components";\n',
    );
    const summaryPath = path.join(workspaceRoot, "summary.md");
    writeFileSync(summaryPath, "");

    const result = runEntry(workspaceRoot, {
      AUDIT_APP: "web",
      GITHUB_STEP_SUMMARY: summaryPath,
    });
    expect(result.status).toBe(0);

    const summary = readFileSync(summaryPath, "utf8");
    expect(summary).not.toContain("\r");
    expect(summary.split(/\r\n|\r|\n/).filter((line) => line.startsWith("|"))).toHaveLength(7);
  });
});
