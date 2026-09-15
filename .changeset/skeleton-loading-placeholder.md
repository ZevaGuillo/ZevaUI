---
"@zevaui/components": minor
---

`Skeleton`: a shaped, pulsing placeholder for content that has not arrived yet.

```tsx
<div aria-busy="true">
  <Skeleton shape="heading" width="half" />
  <Skeleton />
  <Skeleton />
  <Skeleton width="wide" />
</div>
```

Two axes. `shape` — `text` (the default), `heading`, `block` — decides the block extent and the
corner. `width` — `full` (the default), `wide`, `half`, `narrow` — decides the inline extent as a
fraction of the container. It renders a plain `<span>` and is server-renderable: no
`"use client"`, no react-aria-components, 639 B gzipped on its own.

**The two axes exist because `className` is `never` here.** Every other skeleton library sizes
itself with a utility class or an arbitrary `width`/`height` prop, and this package exposes
neither. Fractions rather than lengths, because the consumer owns the container and the design
system does not: a placeholder pinned at `12rem` is wrong in every column that is not 12rem wide,
while `half` is right in all of them. The `block` shape goes further and reserves nothing of its
own — it fills the box the consumer already sized, and its `min-block-size` only decides what
happens when no box reserved a height at all.

**There is no `circle` shape, and no `Skeleton` height scale.** A circle is `aspect-ratio: 1` with
an auto inline size, which is the one property the `width` axis exists to set, so the two axes
would contradict each other on the same declaration. And `Avatar` does not exist yet: a diameter
invented here would have to be matched there, and any drift between the two would make the page
jump at the exact moment the real avatar arrived.

**It is hidden from assistive technology — `aria-hidden="true"`, always, not overridable.** A
skeleton is a shape, not a message: it has nothing to read, and it arrives in crowds, so a
per-element announcement turns one loading state into two dozen. `Progress` already owns
`role="progressbar"` for work in progress, indeterminate case included. The loading state
therefore stays the REGION's job — `aria-busy="true"` on the container that is waiting, announced
once — which every story demonstrates rather than merely documenting.

**Reduced motion is handled in the recipe, not bolted on.** Under
`prefers-reduced-motion: reduce` the pulse is cancelled and the box parks at the BRIGHT end, not
at the dim frame: a permanently faded placeholder reads as disabled content rather than as content
still arriving. Tests brace-match the media query, so an `animation-name: none` that drifted out
of it fails rather than passing on a substring. That branch is also what keeps the visual
baselines deterministic, since the Playwright context pins `reducedMotion: "reduce"`.

No new design tokens. `bg.muted` is the fill, `radii.input` and `radii.card` are the two corners,
and every derived dimension is a multiple of the body type metrics — the same derivation `Badge`
and `Progress` already use. The plan's prediction that a `radius.skeleton` token would be needed
was checked against the theme files and is false, exactly as the equivalent prediction for the
markable controls turned out to be.
