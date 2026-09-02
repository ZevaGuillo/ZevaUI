---
"@zevaui/mcp": patch
---

Report the real package version in the MCP handshake. `serverInfo.version` was hardcoded to `0.0.0` in the published 0.2.0 artifact; the server now derives it from `package.json` at runtime (resolved relative to the module, so it works from both `src/` and the compiled `dist/`), and hosts finally see the actual version they installed.
