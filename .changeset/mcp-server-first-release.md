---
"@zevaui/mcp": minor
---

First real release of the Zevaui MCP server. Exposes the three resolved
themes as resources (`zevaui://tokens/{light,dark,high-contrast}`) and a
`validate_theme` tool that checks a theme's colors against the contrast
contract (4.5:1 for light/dark, 7.0:1 for high-contrast), either
self-checking the shipped palette or pre-flighting a candidate one. Ships a
`zevaui-mcp` bin that speaks stdio.

Only `validate_theme` from ADR-0001's D8 tool list is implemented in this
release; component tools are deferred until `components.manifest.json`
exists.
