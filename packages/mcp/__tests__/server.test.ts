import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { themeFor } from "../src/themes.js";

async function connectedClient() {
  const mcpServer = createServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), mcpServer.server.connect(serverTransport)]);
  return client;
}

describe("createServer / tools", () => {
  it("registers exactly one tool named validate_theme", async () => {
    const client = await connectedClient();
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.name).toBe("validate_theme");
  });
});

describe("createServer / resources", () => {
  it("registers exactly three token resources", async () => {
    const client = await connectedClient();
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri).sort();
    expect(uris).toEqual([
      "zevaui://tokens/dark",
      "zevaui://tokens/high-contrast",
      "zevaui://tokens/light",
    ]);
  });

  it("reads the high-contrast resource as JSON with 44 matching keys", async () => {
    const client = await connectedClient();
    const { contents } = await client.readResource({ uri: "zevaui://tokens/high-contrast" });
    expect(contents[0]?.mimeType).toBe("application/json");
    const parsed = JSON.parse(contents[0]?.text as string);
    expect(Object.keys(parsed)).toHaveLength(44);
    expect(parsed).toEqual(themeFor("high-contrast").colors);
  });
});

describe("createServer / validate_theme tool", () => {
  it("passes for a self-check on high-contrast", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "validate_theme",
      arguments: { theme: "high-contrast" },
    });

    expect(result.structuredContent).toMatchObject({ pass: true });
    expect(JSON.parse((result.content as { text: string }[])[0]?.text ?? "")).toEqual(
      result.structuredContent,
    );
  });

  it("fails the light palette against the high-contrast threshold", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "validate_theme",
      arguments: { theme: "high-contrast", colors: themeFor("light").colors },
    });

    const structured = result.structuredContent as {
      pass: boolean;
      violations: { expected: string }[];
    };
    expect(structured.pass).toBe(false);
    expect(structured.violations.some((v) => v.expected === "7.0")).toBe(true);
  });

  it("returns an error for an unknown theme id", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "validate_theme",
      arguments: { theme: "solarized" },
    });

    expect(result.isError).toBe(true);
    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text).toMatch(/validation error/i);
  });

  it("round-trips the dark resource back through the tool", async () => {
    const client = await connectedClient();
    const { contents } = await client.readResource({ uri: "zevaui://tokens/dark" });
    const colors = JSON.parse(contents[0]?.text as string);

    const result = await client.callTool({
      name: "validate_theme",
      arguments: { theme: "dark", colors },
    });

    expect(result.structuredContent).toMatchObject({ pass: true });
  });
});
