---
"@zevaui/components": minor
---

First real release of `@zevaui/components`. Ships `Button` (`visual`:
`solid` | `subtle` | `danger`, `size`: `sm` | `md` | `lg`, defaults `solid`/
`md`), built on React Aria for accessible behavior and a PandaCSS-compiled,
`--zui-*`-only style layer for visuals. No `className`/`style` escape hatch
— theme by overriding `--zui-*` custom properties, never by forking.

Ships `dist/styles.css`, `dist/components.manifest.json`, and compiled
types. See `packages/components/README.md` for the theming model and
`docs/adrs/0004-storybook-y-la-puerta-de-accesibilidad.md` for the PandaCSS
posture behind the compiled output.
