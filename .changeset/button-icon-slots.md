---
"@zevaui/components": minor
---

`Button` gains two icon slots: `iconStart` and `iconEnd`.

```tsx
<Button iconStart={<SaveIcon />} onPress={save}>Save</Button>
```

Slots rather than `children` plus a `gap`, because `children` lets the system guarantee neither order nor spacing — `<Button><Icon />Save</Button>` and `<Button>Save<Icon /></Button>` both type-check and mean different things — and a design system that never receives the icon as a value cannot reason about it. This is the rule `Dialog` and `Menu` already follow: the caller supplies content, the system supplies structure.

The icon is decoration, and that is enforced rather than documented: its wrapper is `aria-hidden`, so an icon carrying its own `<title>` or `aria-label` cannot append a second word to the button's accessible name. That name still comes from `children`, or from `aria-label`. If the icon *is* the message, put the message in `aria-label`.

A slot you leave out costs nothing. No wrapper is rendered for `undefined`, `null`, `false` or `""`, so the ordinary conditional spelling `iconStart={isSaving && <Spinner />}` adds no empty box and no stray spacing when the condition is false. `0` still renders a box, because React renders `0` as visible text.

The gap scales with `size` (`sm`/`md`/`lg` get `0.375`/`0.5`/`0.75` of `spacing.button.px`), derived in the recipe the same way `sm`/`lg` already derive their padding from `md`'s tokens. Worth naming the trade: no `space.button.gap` token exists, so with `className` typed as `never` a consumer cannot retune this gap. If it ever needs to be themeable, that is three tokens across three themes, not one.

**Two things change for buttons that already exist.** Neither is visible in the common case, and both are consequences of the button now declaring `gap`:

- A text-only button is a single flex item, so `gap` has no effect on it. But a call site already passing *multiple element children* — `<Button><span>a</span><span>b</span></Button>` — now gets that gap between them where it had none.
- `gap` is a declaration this component did not emit before, and it lands in `@layer recipes`. A consumer's own `gap` rule on `.zui-button` from an earlier layer (`reset`, `base`, `tokens`) is now suppressed regardless of its specificity. Unlayered CSS and the `utilities` layer still win. The emitted sheet declares `@layer reset, base, tokens, recipes, utilities`.

The rendered class string is otherwise untouched: it is byte-identical with and without icons, asserted by comparing the two rather than by re-deriving one.

Measured cost: `Button` +130 B gzip (13641 → 13771, ceiling 14973); the barrel +132 B.
