---
"@zevaui/components": minor
---

Add `Calendar`: a month of days, picked by clicking or by walking the grid with the arrow keys.

```tsx
<Calendar
  label="Event date"
  value="2026-09-21"
  isDateUnavailable={(date) => date.endsWith("-25")} // an ISO string, not a CalendarDate
  onChange={(iso) => setDate(iso)}
/>
```

**The first collection in this package that keeps react-aria's machinery on purpose.** `Breadcrumb`,
`Pagination` and `Table` each refused it — a row of links needs no keyboard delegate, and Tab
already walks links. A month is two-dimensional: arrow keys must move by day *and* by week, wrap
across month boundaries, skip disabled days and keep a roving tabindex. That is exactly what the
collection machinery implements, so here its weight buys something.

`isDateUnavailable` receives an **ISO string**, not a `CalendarDate`. A predicate typed over
react-aria's value would have put that type back in the public API through the back door, right
after the `value` prop closed the front one — and a consumer would have had to install the date
library just to write `date.dayOfWeek > 5`.

**Unavailable days are struck through in a contrast-checked colour, not dimmed.** React-aria keeps
them focusable so a keyboard user can tell a blocked day from one that is simply absent, and a
focusable control must still clear 4.5:1. The obvious implementation — grey them out — would have
failed that, so the state is carried by `text.danger` plus a line through the number, which also
survives for a user who cannot perceive the colour at all.

The recipe declares **no variants**, the second after `Tooltip` to be honest about that. A month
grid has one size: its cells are squares derived from the body type scale, so a size axis would
either desynchronise the grid from the text beside it or duplicate what the theme already says.

Three behaviours were measured against react-aria 1.20 rather than assumed, and two of them
corrected the tests as first written:

- The accessible name is **composed**, not taken verbatim: `"Event date, September 2026"`, so a
  screen reader user always hears which month they are in after paging.
- Day cells are named with the full localised date — `"Tuesday, September 15, 2026"` — not the
  bare number.
- A disabled calendar renders **no selected cell at all**, rather than a selected-but-dimmed one.

**Bundle: the barrel ceiling rises from 142,723 B to 157,034 B.** `Calendar` measures 39,076 B gzip
alone, but adds only **13,010 B** to the whole-library bundle — roughly a third of what `DateField`
cost, because the date machinery it needs is already paid for. Per-component budgets are unchanged.
