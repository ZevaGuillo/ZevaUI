---
"@zevaui/components": minor
---

Add `Breadcrumb`, closing the navigation set.

```tsx
<Breadcrumb
  items={[
    { id: "home", label: "Home", href: "/" },
    { id: "projects", label: "Projects", href: "/projects" },
  ]}
  current="Alpha release"
/>
```

## The ancestors and the current page are two separate props

This is the one design decision worth reading about, because it is not how anyone else models it.

The conventional shape is a single `items` array whose last entry is implicitly the current page —
which is how react-aria-components does it, marking that entry `[data-current]`. It also means the
type permits two states that are always wrong: an ancestor with no `href` (a crumb that goes
nowhere), and a current page **with** one — a link to the page you are already on, which a screen
reader announces as a link and a sighted user clicks to no effect. That second one is the single
most common defect in hand-rolled trails.

Splitting them makes both unrepresentable. `items` are ancestors and every one requires an `href`;
`current` is a **string**, because where you are is text, not a link. There is no `href` to give it.
The position rule disappears along with them: nothing here depends on "the last one is special", so
nothing can get that wrong. Tests assert the split reaches the DOM rather than stopping at the type.

`items` may be empty — a top-level page has a trail of exactly one crumb, itself.

## It does not use `Breadcrumbs` from react-aria-components

Every other collection in this package (`Menu`, `Select`, `Tabs`) does, so the departure needs an
argument. Measured against the installed 1.20 types, `Breadcrumbs` gives four things: an `<ol>`, a
collection render pipeline, `onAction(key)`, and an `isCurrent` flag on the last item.

The first is one line of JSX. The third is what `href` already does, better — a real link is
middle-clickable, copyable, and previewable in the status bar, and `onAction` is none of those. The
fourth is `index === length - 1`, which the prop split above encodes in the *type* instead; a rule
the compiler enforces beats the same rule carried by a data attribute nobody can see.

Which leaves the collection, and that is the part worth paying for elsewhere and not here. `Menu`
and `Tabs` need it because they need a keyboard delegate — arrow keys that walk the rows, skip
disabled ones and wrap. A breadcrumb has no such behaviour: it is a list of links, and Tab already
walks links.

**The price is measured, not asserted.** `Tabs` costs 31,730 B gzipped, most of it that machinery.
`Breadcrumb` costs **12,669 B**, of which 12,141 B is `Link` — so the component itself is 528 B.
The barrel had 2,206 B of headroom when this landed. Taking the collection would not have fit.

## The rest

**It renders the `<nav>` landmark itself**, which `Breadcrumbs` does not — that one emits only the
list, leaving the landmark to the caller, and it is the job most callers skip. A landmark is how
someone navigating by structure jumps to the trail. `label` names it and defaults to "Breadcrumb";
override it to localise, or to tell two trails on one page apart.

**The crumbs are this package's own `Link` with `tone="neutral"` and `underline="hover"`** — the
exact pair `link.recipe.ts` documented as correct in a navigation structure and as a WCAG 1.4.1
failure inside prose, and the reason that axis exists at all. A trail where every crumb is blue and
underlined makes the colour carry no information, because nothing in it is *not* a link.

**The separator is a real element, not a `::before`.** Generated content is the conventional
implementation and it is wrong twice: some screen readers announce CSS `content`, and a
pseudo-element has no node for `aria-hidden` to sit on. This one does, so the trail reads "Home,
Projects, Alpha release" and never "Home slash Projects slash". It is deliberately left
**selectable**, which is the opposite of the usual reflex — `user-select: none` makes a copied trail
read "HomeProjectsAlpha", and the slashes are what make it legible as a path when pasted.

**The list wraps.** A deep trail in a narrow column has to wrap rather than push the page sideways;
without it a breadcrumb is the thing that gives a layout a horizontal scrollbar at exactly one
viewport width, which is a regression a default-width screenshot never catches. There is a baseline
for it.

**No variants**, for the reason `Tooltip` established: every axis this package ships answers a
question a caller genuinely has, and a breadcrumb raises none of them — no hit target to size, no
container to span, no intent to tone. An axis invented to look like the others is API that can never
be taken back.

Collapsing a long trail behind an ellipsis is deliberately not here. It needs a menu of the hidden
crumbs to stay reachable, which is a composition decision — and `flex-wrap` handles the case that
actually breaks layouts today.

## Bundle cost, measured

`Breadcrumb` is 12,669 B gzipped on its own, against a ceiling of 13,936 B. The barrel moved from
85,556 B to **85,798 B** (+242 B — `Link` was already in it) and stays under its 88,004 B ceiling,
now with **2,206 B of headroom**.
