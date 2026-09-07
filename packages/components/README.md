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
3. **Paint the page.** This package styles components, never your page, so
   the canvas behind them is yours to set — and it is not optional:

   ```css
   body {
     background-color: var(--zui-color-bg-canvas);
     color: var(--zui-color-text-default);
   }
   ```

   See [The page is yours to paint](#the-page-is-yours-to-paint) for what
   breaks when you skip it.
4. Use the component:

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
| `width` | `"auto" \| "full"` | `"auto"` |
| `iconStart` | `ReactNode` | — |
| `iconEnd` | `ReactNode` | — |
| `isDisabled` | `boolean` | `false` |
| `type` | `"button" \| "submit" \| "reset"` | — |
| `onPress` | `() => void` | — |
| `aria-label` | `string` | — |

`width` is the supported way to stretch a button, and it exists because
there is no other one: the base is `inline-flex`, so a button shrink-wraps
its label, and `className`/`style` are `never` by design. Measured in a bare
consumer app, the only wrapper that stretched a 54px button to its 600px
container was `display: grid` — `display: block` and both flex spellings
left it untouched. A contract that depends on a consumer knowing that is not
a contract, so this is real API instead.

`iconStart` and `iconEnd` are slots, not something you put in `children`:

```tsx
<Button iconStart={<SaveIcon />} onPress={save}>Save</Button>
```

Passing the icon as a child would type-check in either order and leave both
the order and the spacing to you. As a slot, the system owns the box: it
spaces the icon from the label (a gap that scales with `size`), keeps it from
being squashed when `width="full"` meets a long label, and marks it
`aria-hidden`. That last one is the part worth knowing — **the icon never
contributes to the button's accessible name**, even if it carries its own
`<title>` or `aria-label`. The name comes from `children`, or from
`aria-label` when the visible label is not descriptive on its own. Icons here
are decoration; if the icon *is* the message, put that message in
`aria-label`.

The icon inherits the button's text colour, so an icon drawn with
`currentColor` needs nothing per `visual`.

A slot you leave out costs nothing: no wrapper element is rendered for
`undefined`, `null`, `false` or `""`, so `iconStart={isSaving && <Spinner />}`
adds no empty box and no stray spacing when `isSaving` is false.

**Two things changed for buttons that already exist**, and neither is visible
in the common case:

- The button now declares `gap`. A text-only button is a single flex item, so
  it is unaffected — but if you already pass *multiple element children*
  (`<Button><span>a</span><span>b</span></Button>`), you now get that gap
  between them where you had none.
- That `gap` is a declaration this component did not emit before, and it lands
  in `@layer recipes`. If you set `gap` on `.zui-button` yourself from an
  earlier layer (`reset`, `base`, `tokens`), your rule is now suppressed no
  matter its specificity. Unlayered CSS and the `utilities` layer still win.

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

## The page is yours to paint

Every component in this package owns the colours it draws on its own box.
What none of them own is the page **behind** them, and that split is
deliberate: a design system that painted your `body` would be a global
reset, which this package does not ship (`G3` fails the build on one).

The consequence is a real obligation, not a nicety. Components that render
text directly onto the page rather than onto a surface of their own — the
label and description of `Input`, most visibly — colour that text for
`color-bg-canvas`, because that is the background the design system assumes
is behind them. If your page never paints it, the browser's white shows
through instead, and in the dark theme that text is **1.05:1 against a
4.5:1 AA floor**: invisible. Measured in a bare consumer app.

The light and high-contrast themes appear to survive without the two
declarations. They do not survive by design — they survive because the
browser's white happens to sit near `color-bg-canvas` in those themes. That
is luck, and it evaporates the moment a user switches to dark.

```css
body {
  background-color: var(--zui-color-bg-canvas);
  color: var(--zui-color-text-default);
}
```

`color` belongs there with `background-color`. Components that paint their
own surface — `Card`, `Alert`, `Dialog`, `Menu` — also set their own text
colour and do not depend on this rule. Setting it anyway costs nothing and
covers your own copy sitting between them.

Anything scoping the theme class (`.theme-dark`, `.theme-high-contrast`)
below `<html>` also needs to paint the canvas at that same scope, for the
same reason.

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

**Scoped overrides work anywhere in the tree**, including a `theme-*` class on
a section rather than on `<html>`:

```html
<section class="theme-dark">
  <!-- components in here paint dark, on an otherwise light page -->
</section>
```

That is worth stating explicitly because it was broken until `0.2.3`. The
component layer bridges each `--zui-*` into an internal `--zuip-*`, and a CSS
custom property substitutes its `var()` at the element that *declares* it —
so a bridge declared once on `:root` resolved every value against the root and
inherited it already resolved, and no override further down the tree could
reach it. Overriding at `:root` worked; overriding on a wrapper silently did
nothing, and so did a nested `theme-*` class. The bridge is now declared on
every element, so each one re-resolves against the `--zui-*` it actually
inherits.

You never need to name `--zuip-*` yourself. It is internal, its names differ
from the public ones, and overriding it is not supported.

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
- [ ] Your page paints `--zui-color-bg-canvas` and `--zui-color-text-default`
      on `body`, and you checked the dark theme — that is the one where
      skipping it stops being invisible-in-theory and becomes
      invisible-on-screen.
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
