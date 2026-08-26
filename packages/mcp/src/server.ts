import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ViolationRule } from "@zevaui/constraints";
import { z } from "zod";
import { type ThemeId, themeFor, themeIds } from "./themes.js";
import { validateThemeRequest } from "./validate.js";

const violationRules = [
  "missing-token",
  "invalid-color",
  "low-contrast",
] as const satisfies readonly ViolationRule[];

const violationSchema = {
  rule: z.enum(violationRules),
  tokens: z.array(z.string()),
  expected: z.string(),
  actual: z.string(),
  message: z.string(),
};

// Resolved relative to the module so it works both from src/ (tests) and from
// the compiled dist/ artifact — never hardcoded, so changesets bumps propagate.
const { version } = createRequire(import.meta.url)("../package.json") as {
  version: string;
};

const validateThemeInputSchema = {
  theme: z.enum(themeIds),
  colors: z.record(z.string(), z.string()).optional(),
};

const validateThemeOutputSchema = {
  pass: z.boolean(),
  violations: z.array(z.object(violationSchema)),
};

export function createServer(): McpServer {
  const server = new McpServer({ name: "@zevaui/mcp", version });

  registerTokenResources(server);
  registerValidateThemeTool(server);

  return server;
}

function registerTokenResources(server: McpServer): void {
  for (const id of themeIds) {
    server.registerResource(
      `tokens-${id}`,
      `zevaui://tokens/${id}`,
      {
        title: `${id} theme tokens`,
        description: `The full flat token set for the "${id}" theme.`,
        mimeType: "application/json",
      },
      (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(themeFor(id).colors, null, 2),
          },
        ],
      }),
    );
  }
}

function registerValidateThemeTool(server: McpServer): void {
  server.registerTool(
    "validate_theme",
    {
      title: "Validate theme",
      description:
        "Validates a set of theme tokens against the design system's contrast contract. " +
        `Valid theme ids: ${themeIds.join(", ")}. The "high-contrast" theme requires a ` +
        '7.0:1 minimum contrast ratio; "light" and "dark" require 4.5:1 for text. ' +
        "Non-text pairs (borders, and tone-default against their own tone-subtle fill) " +
        "are additionally checked against a flat 3.0:1 floor (WCAG 1.4.11), the same " +
        "across every theme including high-contrast. Omit `colors` to self-check the " +
        "built-in palette for `theme`.",
      inputSchema: validateThemeInputSchema,
      outputSchema: validateThemeOutputSchema,
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (input: { theme: ThemeId; colors?: Record<string, string> }) => {
      const result = validateThemeRequest(input);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    },
  );
}
