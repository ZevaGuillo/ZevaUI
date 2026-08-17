---
"@zevaui/components": minor
---

Adds the first two overlays to `@zevaui/components`. `Dialog` (`size`: `sm` |
`md` | `lg`, `placement`: `center` | `top`, defaults `md`/`center`) is a modal
built on React Aria's `ModalOverlay`/`Modal`, with a required `title` and typed
`description`/`footer`/`children` content slots. `Menu` (`size`: `sm` | `md` |
`lg`, `width`: `auto` | `trigger`, defaults `md`/`auto`) is a dropdown that owns
its own trigger and takes its rows as `items: readonly MenuItemDescriptor[]`
(`id`, `label`, optional `description`, optional `isDisabled`) rather than as
children — `role="menu"` only accepts `menuitem` children, and react-aria
derives the menu's accessible name from the trigger, so both stay inside the
component.

Neither overlay has a tone or intent axis. Both variant axes on both components
are purely geometric, because a colored boundary would need
`color-border-strong`, which measurably fails WCAG 1.4.11 non-text contrast
(2.49:1 light, 2.66:1 dark, against a 3.0:1 floor). Surfaces are separated by
`shadow-modal` / `shadow-dropdown` over an opaque `color-bg-surface` instead.

Same theming model as `Button`, unchanged: no `className`/`style` escape hatch
(both are typed `never`) — theme by overriding `--zui-*` custom properties,
never by forking. The dialog scrim carries its translucency in the color
channel (`color-mix` over `color-bg-inverse`), never in `opacity`, so nothing
can fade the dialog inside it.

See `packages/components/README.md` for the prop tables and the theming model,
and `docs/adrs/0005-overlays-dialog-y-menu.md` for the scrim, surface
separation, radius and composition decisions behind them.
