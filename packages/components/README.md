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

## `Dialog`

A modal that takes over the page: it portals itself to `document.body`,
dims the content behind it, traps focus inside, closes on `Escape`, and
returns focus to whatever opened it. Use it when the user must deal with
something before continuing — a confirmation, a destructive action, a short
form. It is not a panel, a toast, or a tooltip.

Content goes in through typed props, not through markup you assemble. There
is no way to change the rendered structure, and that is the point: the
heading level, the `role="dialog"` wiring, the `aria-describedby` link and
the close control are the design system's responsibility, not yours.

```tsx
import { Button, Dialog } from "@zevaui/components";

<Dialog
  title="Delete project"
  description="Every task, file and comment in this project is removed as well."
  isOpen={isOpen}
  onOpenChange={setIsOpen}
  isDismissable
  footer={<Button visual="danger" onPress={() => remove()}>Delete</Button>}
>
  This action cannot be undone.
</Dialog>;
```

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | — (required) |
| `children` | `ReactNode` | — (required) |
| `description` | `ReactNode` | — |
| `footer` | `ReactNode` | — |
| `closeLabel` | `string` | `"Close"` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` |
| `placement` | `"center" \| "top"` | `"center"` |
| `isOpen` | `boolean` | — |
| `defaultOpen` | `boolean` | — |
| `onOpenChange` | `(isOpen: boolean) => void` | — |
| `isDismissable` | `boolean` | `false` |
| `isKeyboardDismissDisabled` | `boolean` | `false` |

`title` is a required `string`, not an optional `ReactNode`, because it is
the dialog's accessible name: a modal without a real name fails the blocking
accessibility gate. `description`, when given, is what the dialog's
`aria-describedby` points at. `closeLabel` is the **visible** text of the
close control — override it to localise.

`isDismissable` controls clicking the scrim only. `Escape` always closes
unless you set `isKeyboardDismissDisabled`.

Both variant axes are geometric. `size` caps the modal's width (`24rem` /
`32rem` / `48rem`); `placement` aligns it in the viewport. **There is no
tone or intent axis** — see [Why neither overlay has a tone
variant](#why-neither-overlay-has-a-tone-variant).

## `Menu`

A dropdown of actions hung off a trigger button: click or press `Enter` to
open, arrow keys to walk the rows (disabled rows are skipped, not just
greyed out), `Enter` to activate, `Escape` to close. Focus returns to the
trigger on close. Use it for a short list of *actions*; it is not a select,
a combobox, or a navigation menu.

The trigger is part of the component, not something you supply, and the
rows are **data**, not markup:

```tsx
import { Menu } from "@zevaui/components";

<Menu
  label="Project actions"
  items={[
    { id: "rename", label: "Rename project" },
    {
      id: "duplicate",
      label: "Duplicate project",
      description: "Copies every task, file and comment.",
    },
    { id: "delete", label: "Delete project", isDisabled: true },
  ]}
  onAction={(id) => run(id)}
/>;
```

| Prop | Type | Default |
|---|---|---|
| `label` | `string` | — (required) |
| `items` | `readonly MenuItemDescriptor[]` | — (required) |
| `onAction` | `(id: string) => void` | — |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` |
| `width` | `"auto" \| "trigger"` | `"auto"` |
| `isOpen` | `boolean` | — |
| `defaultOpen` | `boolean` | — |
| `onOpenChange` | `(isOpen: boolean) => void` | — |
| `isDisabled` | `boolean` | — |

`MenuItemDescriptor`:

| Field | Type | Default |
|---|---|---|
| `id` | `string` | — (required) |
| `label` | `string` | — (required) |
| `description` | `string` | — |
| `isDisabled` | `boolean` | — |

`label` is the trigger's visible text **and** the menu's accessible name —
React Aria derives one from the other, which is why the trigger is not
yours to pass in. `id` is the row's stable identity and is what `onAction`
reports back. A row's `label` is required for the same reason the dialog's
`title` is: a `menuitem` without a real name fails the blocking
accessibility gate.

`isDisabled` on a row does more than dim it — the row is announced as
disabled, arrow-key navigation steps over it, and `onAction` never fires
for it. `isDisabled` on `Menu` itself disables the trigger, so the menu
cannot be opened at all.

Both variant axes are geometric. `size` scales the rows' padding and text;
`width` is either `auto` (at least as wide as the trigger, capped at
`20rem`) or `trigger` (exactly the trigger's width). **There is no tone or
intent axis** — see the next section.

## Why neither overlay has a tone variant

You may expect a `tone="danger"` dialog or an intent-colored menu. Neither
exists, and the reason is measured rather than stylistic.

An overlay carrying a color of intent needs a colored boundary to read as
one. When ADR-0005 (D2) made this call, the only strong-enough neutral this
system publishes, `color-border-strong`, **failed WCAG 1.4.11 non-text
contrast** (2.49:1 light / 2.66:1 dark against a 3.0:1 floor), so shipping
the variant would have meant shipping it inaccessible. ADR-0010 has since
closed that contrast gap: the token now measures 4.63:1 / 4.16:1
(light / dark) against `color-bg-canvas` and 4.84:1 / 3.67:1 against
`color-bg-surface` (see `packages/constraints/README.md`).

Both overlays still separate themselves from the page with a shadow over an
opaque surface — `shadow-modal` for `Dialog`, `shadow-dropdown` for
`Menu` — and every variant axis they expose is geometric. The contrast gap
that motivated the call no longer exists, but the structural decision — no
`tone` axis on overlays — stands for the reasons ADR-0005 records.

`docs/adrs/0005-overlays-dialog-y-menu.md` (D2) records the original
constraint, including the honest part: at the time, this was a design
constraint the system worked *around*; the underlying token gap was later
closed by ADR-0010, the overlay design was not revisited.

## Theming: override `--zui-*`, never fork

Every visual value a component renders resolves through a `--zui-*` custom
property defined by `@zevaui/tokens`. To theme, override those variables
(scoped to a selector, a theme class, whatever your app needs) — never fork
a component's source or reach past its API to restyle it.

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

No component in this package accepts `className` or `style` — not `Button`,
not `Dialog`, not `Menu`. On all three, both props are typed `never`. This
is not an oversight: it is what makes it structurally impossible to bypass
the token-only styling contract. A consumer cannot ship an arbitrary class
or inline style that outlives a design refresh, because there is no prop to
attach one to. If you need a visual variant a component doesn't offer, that
is a request for a new variant value in its recipe — not a `className`
escape hatch.

The same rule is why `Dialog` and `Menu` take content through typed props
instead of `children` composition. Handing you the `MenuItem` element or
the dialog's header would be handing you the *structure*, and structure is
where the accessible name, the ARIA roles and the keyboard contract live.
You supply content; the design system owns the markup.

Widening this API later (for example, an opt-in `className` prop in a v2) is
a minor, backwards-compatible change. Removing it once granted would be
breaking. Not exposing it now is the reversible choice.

## Testing this package requires a local Playwright browser

This package's own unit tests (`vitest run` in `packages/components`) run in
jsdom and need nothing extra. But if you're running the full workspace
(`pnpm test` at the repo root), `apps/storybook`'s accessibility gate runs
every story of every component through `@storybook/addon-vitest` in **real
Chromium via Playwright**, not jsdom — axe-core's `color-contrast` rule
cannot execute without a real layout/paint engine, and jsdom doesn't have
one. Install the browser once per machine:

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
- [ ] You pass `Dialog`'s and `Menu`'s content through their typed props,
      not by wrapping or reaching into their markup — and you expected
      neither of them to have a tone variant.

## Next step

See `docs/adrs/0001-stack-y-modelo-de-consumo.md` for the stack decisions
this package builds on,
`docs/adrs/0004-storybook-y-la-puerta-de-accesibilidad.md` for the PandaCSS
eject posture and the accessibility gate's design, and
`docs/adrs/0005-overlays-dialog-y-menu.md` for the overlay decisions behind
`Dialog` and `Menu` — the scrim, the missing tone axis, and why composition
happens through typed props.
