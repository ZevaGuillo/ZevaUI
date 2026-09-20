---
"@zevaui/components": minor
---

Add `Pagination`.

```tsx
<Pagination page={4} total={20} href={(page) => `/issues?page=${page}`} />
```

## It is built on links, not on a callback

The conventional API is `onPageChange(page)`, which makes every page number a button. **A page of
results has a URL; a button does not.** `?page=3` can be bookmarked, shared, opened in a new tab,
middle-clicked, previewed in the status bar and reached with the back button, and a click handler is
none of those. Same reading `Breadcrumb` applies to `onAction`, and the same reason `Link` requires
an `href`.

So `href` is a required function of the page number — a function rather than a template string,
because the shape of a URL belongs to the application: `/issues?page=3`, `/issues/page/3` and
`/issues#3` are all somebody's scheme, and a `{page}` placeholder would be a tiny templating
language nobody asked for. Wiring it to a client router costs nothing; react-aria's `RouterProvider`
intercepts the navigation and hands the `href` to your router.

The current page is **not** a link. It is plain text carrying `aria-current="page"` — the defect
`Breadcrumb` restructured its whole API to make unrepresentable.

## A gap never hides a single page

The window is the first page, the last page, and `siblings` pages either side of the current one.
The naive collapse rule — "a gap wherever consecutive kept pages are more than one apart" — produces
`1 … 3 4 5 … 20` on page 4, where the leading ellipsis stands in for page **2 alone**. That is
strictly worse than showing it: same cell width, costs a click, tells the reader less. A gap has to
hide at least two pages to be worth drawing, so page 4 renders `1 2 3 4 5 … 20`.

That rule and the clamping below live in `internal/pagination-window.ts` and are unit-tested
directly rather than through eleven rendered `<li>` elements — a lesson from the `Avatar` change,
where a DOM-level test of its CSS escaper turned out to prove nothing. The interesting behaviour
here is arithmetic over edge cases, and asserting it through markup would test the renderer far more
than the rule.

## `page` is clamped, not trusted

In every real call site it comes from a query string, so `?page=0` and `?page=9999` are *user input*
rather than caller bugs. A trail that rendered nothing, or one whose `aria-current` pointed at a page
not in the list, would be a worse answer than one showing the nearest real page. What the request
does with an out-of-range page is still yours to decide; this decides only what the control looks
like.

**A `total` of 1 or less renders nothing at all.** A pagination control for a single page tells the
reader something they can already see, and costs a landmark in the accessibility tree to say it.

## The edge controls, and the choice most libraries make differently

A disabled "Previous" on page 1 announces as *"Previous page, dimmed"* — a control offered and then
withdrawn, on every first page, to everyone using a keyboard or a screen reader. The fact it conveys
is "you are at the start", and `aria-current="page"` on the first number already says exactly that,
where the reader is already looking.

So at a boundary the cell is **reserved visually and left out of the accessibility tree**: the row
must not shift when you reach either end, but nothing announces a control you cannot use.

Both live controls are named with words — `previousLabel` / `nextLabel`, defaulting to "Previous
page" and "Next page" — and the chevron they draw is `aria-hidden`. A link whose only content is `‹`
computes its accessible name from that character, and "single left-pointing angle quotation mark" is
not what the control does.

## Every cell is the same width

Page numbers are one, two or three digits, so a row sized to its content reflows the moment you
paginate past 9 or 99 — and the control you are clicking moves out from under the pointer that just
clicked it. A `min-inline-size` floor derived from the body type keeps the row still, and there is a
baseline at three-digit page numbers because that regression is invisible at page 4.

The list wraps rather than pushing the page sideways, the same declaration `Breadcrumb` leans on.

No variants — the third recipe here with none. `siblings` changes *what* is rendered rather than how
it looks, so it is a prop rather than an axis.

## Bundle cost, measured

`Pagination` is 13,074 B gzipped on its own (ceiling 14,382 B), of which 12,141 B is `Link` — the
component itself is 933 B, because it uses no react-aria collection. A row of links needs no keyboard
delegate; Tab already walks links.

The barrel moved from 86,400 B to **86,914 B** (+514 B) and stays under its 88,004 B ceiling, now
with **1,090 B of headroom**. `Table` will not fit in that, and should raise the ceiling deliberately
rather than discover it.
