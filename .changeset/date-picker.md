---
"@zevaui/components": minor
---

Add `DatePicker`: a date typed into segments, or picked from a calendar in a popover. It joins the
two halves of the date set — `DateField` was the first alone, `Calendar` the second.

```tsx
<DatePicker
  label="Trip date"
  value="2026-09-21"
  minValue="2026-09-01"
  isDateUnavailable={(date) => date.endsWith("-25")} // an ISO string, not a CalendarDate
  onChange={(iso) => setDate(iso)} // "2026-09-15" | null
/>
```

**The panel is this package's own `Calendar`, not a second month grid written for a popover.** That
was measured before it was decided, because one thing could have made it impossible: `Calendar`
always passes `minValue`, `maxValue`, `onChange` and `isDateUnavailable` as props, spelling them
`undefined` when the consumer gives none — and react-aria carries a picker's state down to its
calendar through context. Had an explicit `undefined` been allowed to override that context, opening
the panel would have silently wiped the picker's bounds and broken selection outright. It does not:
`mergeProps` ignores `undefined` local values. The alternative was to re-render react-aria's
calendar primitives here with `calendarRecipe`'s class names, which would have duplicated the
month grid's markup — header, both paging arrows, grid body, chevrons — in a second file. This
package already has one story about what a paste of a near-identical implementation costs.

**The segment declarations moved to `internal/text-surface.ts`, shared by `DateField` and
`DatePicker` by identity.** They were written inside `date-field.recipe.ts` while there was one
consumer, which was right at the time. `Textarea` was written by copying `Input` and inherited a
real bug through the copy; a picker whose segments were a paste of a field's segments is that story
again with the same ending. Extracted on arrival, not in advance — and a test asserts both recipes
read the one object, so equality cannot drift into near-equality.

`textSurfaceBase` now also styles a react-aria `Group`, and that needed checking rather than
assuming. Read from react-aria-components 1.20's types:

| element     | attributes                                                                            |
| ----------- | ------------------------------------------------------------------------------------- |
| `Input`     | hovered, **focused**, focus-visible, disabled, invalid                                |
| `DateInput` | hovered, **focus-within**, focus-visible, disabled, invalid                           |
| `Group`     | hovered, **focus-within**, focus-visible, disabled, invalid                           |

`Group` and `DateInput` agree exactly, and the shared export keys on four of those five, so every
rule it carries lands correctly on the picker's box.

**No `placement` prop.** `Tooltip` and `Popover` expose one because the consumer attaches them to
arbitrary content. This panel belongs to the field directly above it: react-aria anchors it below
and flips it above when the viewport is short, which is the entire decision. The honest consequence
is that the recipe carries **two** placement animations instead of the eight `Popover` needs — so
that block is deliberately *not* extracted into a shared module, because the need here is a subset
rather than the same block a third time.

Three behaviours were measured against react-aria 1.20 rather than assumed, and one of them
corrected a test as first written:

- **The trigger already has a localised name.** `useDatePicker` stamps `aria-label="Calendar"` onto
  the button and composes it with the field's label. Any text we rendered there would be overridden
  by that attribute, and a hand-written English label would have been a regression in every other
  locale — so the glyph is pure decoration and `aria-hidden`.
- **The popover dismisses itself once a day is picked**, rather than leaving the user to find the
  way out of a panel whose job is done.
- **While the panel is open, the field and its own trigger are `aria-hidden`.** react-aria calls
  `ariaHideOutside` even for a non-modal popover, so "non-modal" means the page behind stays
  *clickable*, not that it stays readable to a screen reader. The test that asserts
  `aria-expanded="true"` therefore holds the button node from before the click; a role query cannot
  reach it.

**Bundle: 78,781 B gzip in isolation — the most expensive component in the package, ahead of
`Select`'s 58,843 B — and one of the cheapest to add: +1,791 B on the whole-library barrel.**
`DateField` and `Calendar` already paid for the date machinery, so what is left is the wiring. The
barrel ceiling is unchanged at 157,034 B, now with 12,485 B of room rather than 14,276 B: the next
component to join will need its own argument about that headroom rather than inheriting one.
