---
"@zevaui/tokens": minor
---

Add the `gray.550` primitive and point light `color.text.muted` at it, per ADR-0022 D1.

`gray.550` is `oklch(0.538 0.0274 263.428)`, interpolated between `gray.500` and `gray.600` at
`t = 13/105`. Use that exact ratio, not the rounded `0.124`: the rounded value yields hue
`263.426`, not `263.428`.

**Why a new rung instead of nudging `gray.500`.** Light `text.muted` and `border.strong` both
resolved to `gray.500`. Measured, `text-muted × bg-subtle` sat at **4.39:1**, under the 4.5 text
floor — and darkening the shared rung far enough to fix it drags `border-strong × bg-subtle` below
its own 3.0 non-text floor. There is no single lightness that satisfies both:

| light `gray.500` → | `text-muted × bg-subtle` | `border-strong × bg-subtle` |
|---|---|---|
| L 0.551 (today) | 4.39 — fails 4.5 | 3.04 |
| L 0.545 | 4.51 — passes | 2.96 — fails 3.0 |
| L 0.538 | 4.64 — passes | 2.88 — fails 3.0 |

So the rung was split rather than moved. `text.muted` takes the new `gray.550`; **`border.strong`
deliberately stays on `gray.500`**, which keeps its three measured ratios exactly where they were
and leaves the dark Badge edge at 3.04. `tokens-contract.gate.test.ts` now fences all of them, so
a future change that "finishes the job" by moving `border.strong` too fails instead of shipping.

Measured after the repoint: light `text-muted` clears 4.5 on all three of its backgrounds —
**4.64** on `bg-subtle`, **4.89** on `bg-canvas`, **5.11** on `bg-surface`.

Dark and high-contrast `text.muted` are untouched; they resolve to `gray.400` and `gray.700` and
already cleared the floor.
