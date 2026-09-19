---
"@zevaui/components": minor
---

Add `Link` and `Separator`, the two smallest pieces of the navigation set.

```tsx
<p>
  The full list lives in <Link href="/docs/tokens">the token reference</Link>.
</p>

<Separator />
<Separator orientation="vertical" />
```

## `Link`

Two axes: `tone` (`accent` by default, or `neutral`) and `underline` (`always` by default, or
`hover`). It renders a real `<a>` through react-aria-components, 12,141 B gzipped on its own
against a ceiling of 13,356 B.

**`href` is required, unlike upstream.** react-aria-components will render a link with no
destination — an `<a role="link">` driven by `onPress` alone — and that shape is a button wearing a
link's clothes: no middle-click, no "open in new tab", no status-bar preview, nothing to copy.
Client-side routing does not need the prop relaxed; react-aria's `RouterProvider` intercepts the
navigation and hands the `href` to your router, so the markup stays a real link. If there is no URL
behind the interaction, use `Button`.

**The default pair is the only one that is unconditionally safe inside a paragraph, and the others
are not weaker versions of it.** A link distinguished from surrounding text by colour alone fails
WCAG 1.4.1, which is why `underline: "always"` is the default rather than the opt-in. `tone:
"neutral"` with `underline: "hover"` is deliberately available and deliberately called out: at rest
it is indistinguishable from the text around it, which is a 1.4.1 failure inside prose and the
correct treatment in a nav bar or a breadcrumb trail, where position already says what each item
is. No gate can read which of the two a call site is, so it is documented rather than silently
allowed.

**The colour does not move on hover, and that is a contract decision.** `@zevaui/constraints` gates
`color-text-link` and `color-text-default` against both `color-bg-canvas` and `color-bg-surface` in
all three themes, so every colour this component can paint is validated at the AA floor — 7.0:1 in
high-contrast. The conventional hover treatment, darkening to `accent.strong`, would paint a text
colour the contract does **not** cover, on every link in every paragraph. So the hover affordance is
the underline instead: it thickens from 1px to 2px when `underline="always"`, and appears when
`underline="hover"` — on focus as well as on hover, so the affordance is not mouse-only. A test
pins that no hover rule declares a text colour at all.

**Disabled uses `text.muted`, not `Button`'s `opacity: 0.5`.** Dimming with opacity composites the
text against whatever is behind it and drops a colour measured at 4.5:1 to roughly half that —
acceptable on a button, whose meaning is also carried by its box, and not acceptable on something
that is nothing but text. `text.muted` is the one dimmed text colour the contract already validates
against both backgrounds.

One upstream detail, measured rather than assumed, because the obvious guess is wrong: a disabled
link is not an `<a>` with its `href` removed. react-aria-components 1.20 renders a
`<span role="link" aria-disabled="true">` with no `tabindex`, so it leaves the tab order and has
nothing to navigate to while still announcing itself as a link. If you select links with `a[href]`
in a stylesheet or a test, a disabled one will not match.

**It sets no font properties at all** — no family, no size, no weight, no line-height. This is the
one line that separates its recipe from `Button`'s. A button is a box that sits beside text; a link
is text that sits inside other text, so fixing its type would make a link in an `<h2>` shrink to
body size. A test asserts the emitted CSS declares none of them.

**`target="_blank"` gets `rel="noopener noreferrer"` applied, not documented.** `noopener` is
already implied by modern browsers; `noreferrer` is the half that is not, and without it the
destination receives the full URL of the page that linked to it — on an authenticated page, a path
and a query string handed to a third party. Passing your own `rel` replaces it entirely, because
`rel="me"` and `rel="license"` on a `_blank` link are both legitimate. `target` itself is narrowed
to the four browsing-context keywords rather than the `string` the DOM allows.

## `Separator`

One axis, `orientation` (`horizontal` by default, or `vertical`), plus a `decorative` flag. It is
server-renderable — no `"use client"`, no react-aria-components — and at **438 B gzipped** it is
now the smallest component in this package.

**That `clientOnly: false` was won rather than inherited.** react-aria-components ships a
`Separator`, and using it would have made a 1px line unusable inside a React Server Component: its
1.20 export does `import 'client-only'`, which is a build-time error there. A plain `<hr>` already
carries the implicit `role="separator"`, so the upstream component buys a divider nothing it needs
— and a divider is the single most likely thing to appear in a server-rendered page.

**It announces itself by default.** A separator's purpose is to say "these two things are
separate", and `role="separator"` is how that reaches someone navigating by structure instead of by
sight, for whom the drawn line does not exist at all. `decorative` strips the role, for the case
where the division is already announced by something else — between two `<section>` elements that
each carry their own heading, where a second announcement is just noise.

**`vertical` requires a flex or grid parent**, and this is stated rather than papered over. CSS has
no cross-axis equivalent of `width: 100%` that works in normal flow: a block element takes its
width from its container and its height from its content, and a separator has no content. So the
vertical value uses `align-self: stretch`, which resolves against a flex or grid parent and nothing
else — outside one it renders with no height and is invisible. The alternative, a hardcoded
`height`, would be wrong for every row it did not happen to match. A vertical divider lives in a
toolbar, a breadcrumb trail or a button group, and all three are flex rows already.

It uses `border.default` rather than the 3:1-gated `border.strong`. WCAG 1.4.11 measures the
boundary that *identifies* a user-interface component, and a separator identifies nothing — it has
no state and nothing to operate, and it divides content that stays legible without it. Reaching for
`border.strong` would paint a divider heavier than the borders of the real controls around it.

There is no `children` and no `size` axis. `<hr>` is void content, so a divider with a label in the
middle of it ("or", "Today") is a different component — it needs a background matching the surface
behind it to punch through the line, and which surface it sits on is a thing this one cannot know.
A thicker divider is a section boundary, and a section boundary wants a background change.

## Bundle cost, measured

`Link` is 12,141 B gzipped on its own, `Separator` 438 B. The barrel moved from 82,629 B to
83,357 B (+728 B) and stays under its existing 88,004 B ceiling. If you import neither, both
tree-shake out.
