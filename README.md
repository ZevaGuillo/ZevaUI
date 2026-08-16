# Zevaui Design System

A governed design system that guarantees no change breaks existing consumers.

## Packages

| Package | Published | Description |
|---|---|---|
| `@zevaui/tokens` | yes | Design tokens (Style Dictionary → CSS vars + types + manifest) |
| `@zevaui/components` | yes | React components (React Aria + PandaCSS) |
| `@zevaui/constraints` | yes | Theme validation contract |
| `@zevaui/mcp` | yes | MCP server over build manifests |
| `@zevaui/audit` | yes | Usage reporter for the reusable audit workflow |
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

- [CONSTITUCION.md](./CONSTITUCION.md)
- [ADRs](./docs/adrs/)
