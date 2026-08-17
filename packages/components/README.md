# @zevaui/components

Accessible, tokenized React components. Behavior comes from React Aria
(`react-aria-components`); visuals come from a compiled PandaCSS layer that
resolves entirely against `@zevaui/tokens`'s `--zui-*` custom properties. You
receive compiled CSS, compiled JS, and types — never Panda itself.

## Quick path

1. Install both packages: `@zevaui/tokens` and `@zevaui/components`.
2. Import both stylesheets once, at your app's root, **in this order**:

   ```ts
   import "@zevaui/tokens/styles.css";
   import "@zevaui/components/styles.css";
   ```

   The order matters. `@zevaui/components/styles.css` is a chain of
   `var(--zui-*)` pointers — see [Theming](#theming) — and those variables
   only exist once the token layer has loaded.
3. Use the component:

   ```tsx
   import { Button } from "@zevaui/components";

   <Button visual="solid" size="md" onPress={() => save()}>
     Save
   </Button>;
   ```

## `Button`

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | — (required) |
| `visual` | `"solid" \| "subtle" \| "danger"` | `"solid"` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` |
| `isDisabled` | `boolean` | `false` |
| `type` | `"button" \| "submit" \| "reset"` | — |
| `onPress` | `() => void` | — |
| `aria-label` | `string` | — |

`size` is not six independent tokens per axis — `sm`/`lg` are `md`'s two
spacing tokens scaled by fixed ratios (`0.75`/`1.5`) in the recipe itself.
The proportional relationship between sizes is a design-system decision, not
an implementation detail: it is not possible for a future token change to
make `sm` render larger than `lg`.

## Theming: override `--zui-*`, never fork

Every visual value a component renders resolves through a `--zui-*` custom
property defined by `@zevaui/tokens`. To theme, override those variables
(scoped to a selector, a theme class, whatever your app needs) — never fork
`Button`'s source or reach past its API to restyle it.

```css
.my-app-dark-section {
  --zui-color-accent-default: oklch(0.7 0.15 250);
}
```

This works because `@zevaui/components`'s own CSS never contains a literal
color, size, or radius — only `var(--zui-*)` references, enforced by a build
gate (`G1` in `__tests__/css-gates.test.ts`) that fails the build if any
declaration in the component layer isn't a zero-literal-payload pointer.

## No `className`, no `style` — by design

`Button` does not accept `className` or `style`. Both are typed `never`.
This is not an oversight: it is what makes it structurally impossible to
bypass the token-only styling contract. A consumer cannot ship an arbitrary
class or inline style that outlives a design refresh, because there is no
prop to attach one to. If you need a visual variant this component doesn't
offer, that is a request for a new `visual`/`size` value in the recipe — not
a `className` escape hatch.

Widening this API later (for example, an opt-in `className` prop in a v2) is
a minor, backwards-compatible change. Removing it once granted would be
breaking. Not exposing it now is the reversible choice.

## Testing this package requires a local Playwright browser

This package's own unit tests (`vitest run` in `packages/components`) run in
jsdom and need nothing extra. But if you're running the full workspace
(`pnpm test` at the repo root), `apps/storybook`'s accessibility gate runs
`Button` through `@storybook/addon-vitest` in **real Chromium via
Playwright**, not jsdom — axe-core's `color-contrast` rule cannot execute
without a real layout/paint engine, and jsdom doesn't have one. Install the
browser once per machine:

```sh
pnpm exec playwright install chromium
```

See `docs/adrs/0004-storybook-y-la-puerta-de-accesibilidad.md` (D7) for why
this trade-off was made deliberately, not incidentally.

## Checklist

- [ ] You import `@zevaui/tokens/styles.css` before
      `@zevaui/components/styles.css`, once, at your app root.
- [ ] You theme by overriding `--zui-*` custom properties, not by forking
      component source or reaching for `className`/`style` (there isn't
      one).
- [ ] If running the full workspace test suite, you have a local Playwright
      Chromium install.

## Next step

See `docs/adrs/0001-stack-y-modelo-de-consumo.md` for the stack decisions
this package builds on, and
`docs/adrs/0004-storybook-y-la-puerta-de-accesibilidad.md` for the PandaCSS
eject posture and the accessibility gate's design.
