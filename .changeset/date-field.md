---
"@zevaui/components": minor
---

Add `DateField`: a date entered by typing, one segment at a time.

```tsx
<DateField
  label="Start date"
  value="2026-09-21"
  onChange={(iso) => setDate(iso)} // "2026-09-22" | null
/>
```

**The public API speaks ISO strings, not `Date` and not `CalendarDate`.** Both exclusions are
deliberate:

- A `Date` is a timestamp. A date picked in Buenos Aires would read as the previous day in Berlin,
  because the value carries an instant nobody asked for. A calendar date has no instant.
- A `CalendarDate` is react-aria's type. Accepting it would force every consumer to install and
  import `@internationalized/date` just to pass a date in — putting a third-party type in the
  public API of a package whose whole argument is that it owns its own surface.

`@internationalized/date` is now a direct dependency of `@zevaui/components`, bundled and never
named in a public type. The measured cost of the translation is **24 bytes gzip**: react-aria
already bundles that package to implement `DateField`, and the tree-shaken import drops the eleven
non-Gregorian calendars (3,613 B for what is used, against 11,222 B for the whole module).

**What this gives up:** non-Gregorian calendars and timezones. Both are expressible in react-aria's
own API and neither is expressible in an ISO calendar date. A component that genuinely needs them
will have to make its own argument rather than widening this one.

An unparseable value degrades to an empty field instead of throwing — `parseDate` raises on
malformed input, and a design system that takes down the host application because a prop held
`"2026-9-1"` is a trap rather than a contract. `onChange` emits `null` when the field is cleared,
so a controlled form can tell "cleared" from "never set".

**Bundle budget: the barrel ceiling rises from 108,314 B to 142,723 B.** `DateField` measures
50,949 B gzip on its own and takes the whole-library bundle from 98,467 B to 129,748 B — the
largest single addition this package has made. Per-component budgets are unchanged, so a consumer
who imports no date component pays none of it; the barrel entry is what had to move.
