---
"@zevaui/components": minor
---

Add `Tooltip` and `Popover`, completing the two anchored overlays of the navigation set.

```tsx
<Tooltip content="Moves the project out of your active list">
  <Button>Archive</Button>
</Tooltip>

<Popover label="Filters" title="Filter by status">
  Only issues that are still open are shown in this view.
</Popover>
```

## `Tooltip`

**A tooltip describes; it never names.** react-aria points the trigger's `aria-describedby` at the
bubble and never its `aria-labelledby`, and that is correct wiring rather than a limitation to work
around. The consequence is a contract on you, and it is the single most important thing about this
component:

> An icon-only button still needs its own `aria-label`. The tooltip is not its name.

Two independent reasons, both measurable. A description is announced *after* the name and many
screen-reader configurations suppress descriptions entirely, so a control whose only name came from
a tooltip announces as "button" and nothing else. And **a tooltip does not exist on touch** — there
is no hover, and a tap activates the control instead of revealing the bubble. On a phone,
information that lives only in a tooltip is information that does not exist. A tooltip may repeat
or expand on what the interface already says; it may never be the only place something is said.
`Tooltip.stories.tsx > IconOnlyTrigger` asserts the pair, so this is a gate rather than advice.

**`children` here is the trigger, not the content,** which inverts what every other component in
this package does. RF-07 exists so a consumer can never reach the markup, and `Menu` renders its
own trigger for exactly that reason. A tooltip cannot work that way: it *explains an existing
control*, so one that rendered its own trigger would be a tooltip you can never attach to the icon
button that needed one. The concession is narrow — you control one element, handed to react-aria's
`TooltipTrigger`; nothing about the bubble is reachable.

The type is honest about what it cannot enforce. `children` is `ReactElement`, not
`ReactElement<ButtonProps>`: JSX produces `ReactElement<any>`, which is assignable to any narrower
element type, so the tighter annotation would reject nothing while reading as though it did. It
must be a `Button` or a `Link` — react-aria wires itself through focus and hover context a plain
`<button>` does not consume.

`content` is a plain string. A tooltip that holds markup holds something you may want to select,
click or read at your own pace, none of which it supports — it disappears the instant the pointer
leaves.

**It inverts, and the inversion is the one the contract already validates.** `bg.inverse` with
`text.inverse` is both the conventional tooltip look and the only inverse text pair
`@zevaui/constraints` gates, measured in all three themes. The alternative — reusing the surface
tokens — would produce something visually indistinguishable from a `Menu` you cannot click.

**No arrow.** `OverlayArrow` would work, and what it costs is a seam: the bubble is separated from
the page by `shadow.dropdown`, and a shadow follows the bubble's box, not the box plus a triangle
glued to one edge. Every arrowed tooltip therefore drops the shadow or draws a rotated square that
must be clipped and re-shadowed per placement — four extra rules for a decoration saying nothing
the bubble's proximity does not. `Menu`'s popover has no arrow either.

**No variants at all** — the first recipe in this package with none, and the honest outcome rather
than a gap. Every axis this package ships answers a question a caller has: how big, how wide, which
tone. A tooltip has none of those. Its size is its text, its placement is a *behaviour* react-aria
may override at paint time, and it carries no intent. Inventing an axis to look like the others
would be inventing API. A test asserts the base rule still lands with an empty `staticCss` variant
map, because a Panda that stopped emitting it would ship this component unstyled with nothing else
noticing.

`delay` is left at react-aria's own 1500ms warmup, which is deliberately long: a tooltip that fires
instantly turns a sweep across a toolbar into a sequence of flashes. Keyboard focus is unaffected —
a focused trigger shows its tooltip immediately, because someone tabbing to a control has already
committed to it.

## `Popover`

One axis, `size` (`sm` | `md` | `lg`), plus `placement`. It owns its trigger the way `Menu` does,
and holds a `role="dialog"` the way `Dialog` does.

**It is non-modal, and that is the whole reason it is not a `Dialog`.** `Dialog` goes through
`ModalOverlay`, which takes the page out of the accessibility tree and traps focus until it closes.
This goes through `Popover`, which does neither: the page stays readable and clickable, Escape and
an outside click dismiss it, and focus returns to the trigger. Use `Dialog` when the answer is
required before anything else can happen; use this when it is not. A test asserts the panel never
claims `aria-modal`.

**It sits at dropdown depth, not modal depth, and the shadow is the only thing saying so.**
`shadow.modal` means "the page behind this is unavailable" — true of a modal, false here. With no
borders on any overlay in this package (ADR-0005 D2), depth is the entire vocabulary available for
that distinction, which is why a test guards it by name.

**`label` and `title` are two different strings, and both are required.** This is where it diverges
from `Menu`: react-aria names a `role="menu"` from its trigger, but a `role="dialog"` is named by
its own heading. So the trigger says what pressing it does ("Filters") and the title says what the
panel is ("Filter by status"). The title is *drawn* rather than visually hidden, because a hidden
name is one only assistive technology can check and this package has no way to tell you yours went
stale.

There is no scrim and therefore no `overlay` slot: a popover that dimmed the page would be claiming
a modality it does not enforce.

## Bundle cost, measured

`Tooltip` is 14,181 B gzipped on its own (ceiling 15,600 B); `Popover` is 32,557 B (ceiling
35,813 B), which puts it between `Dialog` at 27,836 B and `Menu` at 53,235 B — it pulls in
react-aria's overlay positioning and dialog machinery but no collection.

The barrel moved from 83,357 B to **85,556 B** (+2,199 B) against its existing 88,004 B ceiling.
That leaves **2,448 B of headroom**, the tightest this package has run: the next component that is
not tree-shaken out of the barrel will need that ceiling raised deliberately rather than by
accident. If you import neither of these, both tree-shake out.
