import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import pkg from "../package.json" with { type: "json" };

const packageRoot = dirname(fileURLToPath(new URL("..", import.meta.url)));
const binPath = resolve(packageRoot, "dist/bin.js");

describe("dist/bin.js / shape", () => {
  it("exists and starts with a node shebang", () => {
    expect(existsSync(binPath)).toBe(true);
    const firstLine = readFileSync(binPath, "utf8").split("\n")[0];
    expect(firstLine).toBe("#!/usr/bin/env node");
  });

  it("is declared as the zevaui-mcp bin entry", () => {
    expect(pkg.bin["zevaui-mcp"]).toBe("./dist/bin.js");
  });
});

describe("dist/bin.js / stdio smoke", () => {
  it(
    "answers a JSON-RPC initialize request over stdio without stderr output",
    async () => {
      const child = spawn(process.execPath, [binPath], { stdio: ["pipe", "pipe", "pipe"] });

      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "bin-smoke-test", version: "0.0.0" },
        },
      };
      child.stdin.write(`${JSON.stringify(request)}\n`);

      const firstLine = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timed out waiting for stdout")), 9000);
        const check = () => {
          const newlineIndex = stdout.indexOf("\n");
          if (newlineIndex !== -1) {
            clearTimeout(timer);
            resolve(stdout.slice(0, newlineIndex));
            return;
          }
          setTimeout(check, 25);
        };
        check();
      });

      child.kill();

      const response = JSON.parse(firstLine);
      expect(response.id).toBe(request.id);
      expect(response.result.serverInfo.name).toBeDefined();
      expect(response.result.capabilities.tools).toBeDefined();
      expect(response.result.capabilities.resources).toBeDefined();
      expect(stderr).toBe("");
    },
    10_000,
  );
});
