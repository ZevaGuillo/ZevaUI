---
"@zevaui/components": minor
---

Add `Avatar`, the first component of the data set.

```tsx
<Avatar name="Ana Beltrán" />
<Avatar name="Ana Beltrán" src="/people/ana.jpg" size="lg" />
<Avatar name="Acme Inc" shape="rounded" />
```

Two axes, `size` (`sm` | `md` | `lg`) and `shape` (`circle` | `rounded`). It renders plain elements
and is server-renderable — no `"use client"`, no react-aria-components, **1,027 B gzipped**.

## `name` is one prop doing three jobs

It is the accessible name, carried on the root as `aria-label`. It is the source of the initials
drawn when there is no photograph. And being required is what makes an unnamed avatar impossible to
construct — a `role="img"` with no name announces nothing, which is exactly what the blocking axe
gate exists to catch.

The conventional `alt` + `fallback` pair lets all three drift: `alt="Profile photo"` with
`fallback="AB"` is perfectly typeable, announces the wrong thing, and draws initials belonging to
nobody.

## Staying server-renderable took the design through one refutation

Every other design system handles a broken avatar with state — an `onError` handler that swaps the
image for initials — which makes the component client-only. An avatar appears in server-rendered
lists of people more than almost anything else in this package, so that is a `"use client"`
boundary per row.

So the fallback is **always** in the DOM, with the photograph layered over it. The first
implementation layered an `<img alt="">`, on the reasoning that a source which fails to load paints
nothing. A story was written to hold that claim in real Chromium, and **the first baseline it
produced refuted it**: Chromium draws its broken-image glyph in the top-left of the circle, on top
of the monogram. `alt=""` suppresses the alt *text*, not the indicator.

The photograph is now a `background-image` on a `<span>`. That has no failure rendering at all —
and not as an engine behaviour that might change, but because there is no replaced element for a
user agent to draw a placeholder *for*. It is a stronger guarantee than the one the `<img>` version
was claiming. A test asserts no `<img>` is rendered, so the refuted shape cannot come back quietly.

What it costs, stated plainly: no `srcset`, no `sizes`, no `loading="lazy"` and no `decoding` hint,
because none of those exist for a background. For a box between 28 and 49 CSS pixels that is an
acceptable trade; for a hero image it would not be.

## The `src` is the only caller text in this package that reaches a stylesheet

So it gets its own escaper, `internal/css-url.ts`, with its own unit tests. It **strips** the four
characters that could close the quoted `url("…")` — `"`, `\`, CR, LF — rather than escaping them,
because none of them are valid in a URL to begin with: a real one carries them percent-encoded and
passes through untouched. `encodeURI` was the obvious alternative and is wrong here, because it
re-encodes `%` itself and would break every avatar URL behind a CDN or a signing proxy.

Those tests are units rather than rendered assertions, and that split is load-bearing: jsdom's CSSOM
refuses to parse a hostile value and leaves the style attribute `null`, so a DOM-level test would
pass identically for an implementation that escaped correctly and one that emitted nothing at all.

## The initials

Up to two letters, the first of the first word and the first of the last. Two decisions in it are
forced rather than preferred, both by server rendering:

- **Iterated by code point, never by index.** A name beginning outside the Basic Multilingual Plane
  is two UTF-16 units, so `name[0]` would hand back half a surrogate pair and the browser would draw
  a replacement glyph. `Intl.Segmenter` would be more correct still and is deliberately not used: it
  would put an ICU-dependent result into server-rendered markup, and an engine whose data differs
  from the browser's produces a hydration mismatch on a component that appears dozens of times per
  page. A slightly wrong monogram is a far cheaper failure.
- **`toUpperCase()`, not `toLocaleUpperCase()`.** The locale-aware form reads the *host's* locale,
  which differs between the server that renders and the browser that hydrates — Turkish `i`
  uppercases to `İ` in one and `I` in the other, and React reports the difference as an error.

## Contrast

The initials are `text.default` on `bg.muted`, a pair `@zevaui/constraints` deliberately does not
gate — `contract.test.ts` asserts by name that no text pair references `color-bg-muted`, because
widening it would constrain tokens ADR-0020 depends on being free. So this is covered the way
`Menu`'s hovered row and `Badge`'s `neutral` tone already are: by axe's `color-contrast` rule over
real stories in real Chromium, in all three themes. Every story that draws initials is load-bearing
for that reason.

## What this unblocks, and what it does not

`skeleton.recipe.ts` refused a `circle` shape when it shipped, on two grounds: a circle's inline
size would contradict its `width` axis, and there was no `Avatar` yet, so a diameter scale would
have to be invented there and matched here — with a page-jump the moment the two drifted.

The second ground is now closed: `internal/avatar-diameter.ts` owns the one scale, `Avatar` reads it
rather than restating it, and a test asserts any future `circle` must read the same constant.

The first still stands, and `skeleton.recipe.ts` now records the analysis and the shape of the
answer instead of a stale promise. It is left undone deliberately: it restructures the variant axes
and the public `SkeletonProps` of a component that has already shipped, which is its own change with
its own changeset rather than a footnote to a new component's.

The same file's claim that G11 is "a package-wide law, not a rule with exemptions" is also corrected
there — it stopped being true when `Link` and `Separator` shipped, and someone would otherwise cite
it.

## Bundle cost, measured

`Avatar` is 1,027 B gzipped on its own, against a ceiling of 1,224 B. The barrel moved from
85,798 B to **86,400 B** (+602 B) and stays under its 88,004 B ceiling, now with **1,604 B of
headroom** — down from 2,206 B.
