# @zevaui/mcp

An MCP server that exposes Zevaui's resolved theme tokens and its contrast
validator to agents, over stdio.

## Quick path

1. Install `@zevaui/mcp` (it ships a `zevaui-mcp` bin, not a library import).
2. Point your MCP host at the bin over stdio. For example, in a Claude
   Desktop-style config:

   ```json
   {
     "mcpServers": {
       "zevaui": {
         "command": "npx",
         "args": ["-y", "@zevaui/mcp"]
       }
     }
   }
   ```

   The bin (`./dist/bin.js`) speaks JSON-RPC over stdio and answers
   `initialize` with `protocolVersion: "2025-06-18"` and
   `serverInfo.name: "@zevaui/mcp"`. It writes nothing to stderr on a clean
   run.
3. From the connected client, read a theme via `resources/read` or call
   `validate_theme`.

## Resources: the three resolved themes

| URI | Content |
|---|---|
| `zevaui://tokens/light` | Flat JSON object, 42 `token-name: value` pairs, the light theme fully resolved. |
| `zevaui://tokens/dark` | Same shape, dark theme. |
| `zevaui://tokens/high-contrast` | Same shape, high-contrast theme. |

Each resource's `mimeType` is `application/json`. There is no nesting and no
references left to resolve — what you read is what a component would render.

## Tool: `validate_theme`

Validates a set of theme tokens against the design system's contrast
contract. It runs in one of two modes depending on whether `colors` is
supplied.

```ts
{
  theme: "light" | "dark" | "high-contrast", // closed enum
  colors?: Record<string, string>            // optional
}
```

- **Omit `colors`** to self-check the shipped palette for `theme` — this is
  the "is our own theme still passing?" mode.
- **Pass `colors`** to pre-flight a candidate palette (e.g. one an agent is
  about to propose) against `theme`'s threshold, before it ever ships.

The result shape is the same either way:

```ts
{
  pass: boolean,
  violations: Array<{
    rule: "missing-token" | "invalid-color" | "low-contrast",
    tokens: string[],
    expected: string,
    actual: string,
    message: string,
  }>
}
```

`theme` selects the minimum contrast ratio the check enforces: **4.5:1 for
`light` and `dark`, 7.0:1 for `high-contrast`.** Because `theme` is a closed
enum in the tool's input schema, an unknown theme id is rejected at the
protocol level (a schema validation error) — it never silently falls back to
a default threshold.

## Scope: 1 of the 6 tools named in ADR-0001 D8

ADR-0001 (D8) names six tools: `list_components`, `get_component`,
`search_tokens`, `get_token`, `list_themes`, `validate_theme`. **Only
`validate_theme` is implemented.** The other five are not stubbed — see
`docs/adrs/0003-servidor-mcp-de-tokens-y-validacion.md` for why:

- `list_components` / `get_component` need `components.manifest.json`, which
  does not exist yet.
- `search_tokens` / `get_token` / `list_themes` are covered by the three
  static resources above (a resource list already answers "what themes/tokens
  exist").

Do not expect component discovery from this server yet.

## Known caveat: non-text contrast is not enforced

This server reuses `@zevaui/constraints`, which does **not** enforce WCAG
1.4.11 (Non-text Contrast) — only text/background pairs are checked. A
`validate_theme` pass is not a full WCAG 2.2 AA guarantee; see
`@zevaui/constraints`'s README for the specific token that currently fails
1.4.11.

## Checklist

- [ ] Your MCP host launches `zevaui-mcp` over stdio, not HTTP.
- [ ] You understand `validate_theme`'s `theme` selects the threshold, and
      is rejected outright if it isn't `light`, `dark`, or `high-contrast`.
- [ ] You are not relying on this server for component discovery yet.
- [ ] You are not treating a `validate_theme` pass as a full WCAG 2.2 AA
      guarantee (non-text contrast is out of scope).

## Next step

See `docs/adrs/0003-servidor-mcp-de-tokens-y-validacion.md` for the reasoning
behind what shipped and what was deliberately deferred.
