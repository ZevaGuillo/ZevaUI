# Zevaui Design System

A governed design system that guarantees no change breaks existing consumers.

## Packages

| Package | Published | Description |
|---|---|---|
| `@zevaui/tokens` | yes | Design tokens (Style Dictionary → CSS vars + types + manifest) |
| `@zevaui/components` | yes | React components (React Aria + PandaCSS) |
| `@zevaui/constraints` | yes | Theme validation contract |
| `@zevaui/mcp` | yes | MCP server (theme token resources + `validate_theme` tool) |
| `@zevaui/audit` | no (private) | Usage reporter for the reusable audit workflow |
| `@zevaui/config` | no (private) | Shared internal presets |
| `@zevaui/dashboard` | no (app) | Registry + adoption panel (Next.js) |
| `@zevaui/storybook` | no (app) | Living documentation |

## Development

```sh
pnpm install
pnpm lint
pnpm typecheck
```

## Governance

- [CONSTITUTION.md](./CONSTITUTION.md) — English translation ([Spanish original](./CONSTITUCION.md) is canonical)
- [ADR index (English)](./docs/adrs/README.md) — every decision summarized; ADRs 0001–0020 are in Spanish, new ADRs are written in English
