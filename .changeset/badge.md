---
"@zevaui/components": minor
---

`Badge`: a short label with a background, and the first component of the feedback set.

```tsx
<Badge>Draft</Badge>
<Badge tone="danger">Overdue</Badge>
```

One axis, `tone`, with five values — `neutral` (the default), `accent`, `danger`, `success`,
`warning`. It renders a plain `<span>` and is server-renderable: no `"use client"`, no
react-aria-components, 522 B gzipped on its own.

**The tone is a background, never a text colour.** The conventional look — `{tone}.default` text
on `{tone}.subtle` — was measured against the light theme's real values when `Alert` shipped and
fails the 4.5:1 AA floor in every tone (danger 3.90, success 2.93, warning 1.93). Badge paints the
same backgrounds, so it keeps `text.default` in all five tones and a test pins that no tone rule
declares a text colour at all.

`@zevaui/constraints` is deliberately **not** extended to cover the two backgrounds Alert never
used. Its contract gates `color-text-default` over the three tone-`subtle` tokens, and adding
`color-accent-subtle` / `color-bg-subtle` alongside them would constrain tokens that ADR-0020
depends on being free — that is what lets a proposed theme carry a brand colour into `accent`
intact. `neutral` and `accent` are therefore covered the way `Menu`'s hovered row already is: by
axe's `color-contrast` rule over real stories in real Chromium, in all three themes. Every tone
ships a story for that reason.

**`tone` is optional here and required on `Alert`**, which is not an inconsistency: an alert
without a tone would have its meaning invented for it, while `neutral` asserts nothing.

**There is no `size` axis, and dimensions are derived rather than tokenised.** Padding, gap and
type are multiples of `fontSizes.body`, the same trade `Checkbox` documented: with `className`
typed as `never`, a consumer cannot retune a badge's geometry independently of their body font
size. The corner is `radius.input` rather than a hardcoded pill, so a theme that rounds its
controls rounds its badges with them.

A badge has no ARIA role and announces nothing on its own. Whatever the colour means has to be in
the text too — `<Badge tone="danger">Overdue</Badge>`, never a bare coloured dot.
