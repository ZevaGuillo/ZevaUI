---
"@zevaui/components": minor
---

Add `Table`, closing the data set — and with it `@tanstack/react-table` as this package's second
runtime dependency.

```tsx
<Table
  caption="Open issues"
  columns={[
    { id: "title", header: "Title", cell: (i) => i.title, isRowHeader: true, sortable: true },
    { id: "comments", header: "Comments", cell: (i) => i.comments, align: "end" },
  ]}
  rows={issues}
  rowId={(issue) => issue.id}
  sortHref={(column, direction) => `/issues?sort=${column}&dir=${direction}`}
/>
```

## Two engine decisions that point in opposite directions

**It does not use `Table` from react-aria-components.** Measured against the installed 1.20 types:
RAC's `Table` gives row selection, cell-level keyboard navigation, resizing and drag-and-drop — and
implements them as `role="grid"`. That role is the part worth stopping on, because the usual framing
("the accessible one costs more") is backwards here. A screen reader reads a native `<table>` in its
**table mode** and a `role="grid"` in its **grid mode**: grid mode is built for a thing you operate
cell by cell, table mode for a thing you read. For a table you read, native semantics are not the
cheaper compromise — they are the better answer.

So every piece of markup is hand-written and native: `<table>`, `<caption>`, `<th scope="col">`,
`<th scope="row">`, `aria-sort`.

**It does use TanStack Table, as an internal engine the consumer never sees.** v9 is headless — it
owns column definitions, row models and state and renders nothing — which is what makes the two
decisions compatible rather than contradictory.

**The public API is this package's own.** `TableColumn<Row>` is exported; `ColumnDef`,
`tableFeatures` and `createColumnHelper` stop inside `Table.tsx`. That is the rule every `.types.ts`
here states — *hand-picked, never a re-export of another library's prop types* — and the reason
react-aria's types never reached `Menu` or `Select` either. A test asserts the shipped `.d.ts` files
name `@tanstack` nowhere, and a second asserts the built module really does import it, so the first
cannot pass by the engine having quietly been removed.

**What it costs, measured rather than sold.** `tableFeatures({})` tree-shakes sorting, filtering,
pagination and grouping away, and the core still measures **10,808 B gzipped**. For the flat,
server-sorted table here that buys row identity, a row model and a header model — real machinery,
but not 10 KB of it. The honest justification is forward-looking: client-side filtering, pagination,
grouping, column visibility and row selection become configuration rather than a rewrite. If those
never arrive, this was a bad trade, and that sentence is in the source rather than in nobody's
memory.

Sorting is deliberately **not** registered: this component does not sort, it draws an order the
caller already produced and says which one it is. `rowSortingFeature` would add a measured 2,222 B
to ship a client-side sort nothing calls.

## The markup decisions that matter

**`isRowHeader` renders `<th scope="row">`** on the column that identifies the record, which is what
lets a screen reader announce a value *with* its subject — "Comments, 12, Fix the login redirect" —
instead of stranding a number with nothing attached. It is the single highest-value markup decision
in a data table and the one most often skipped, because nothing looks wrong without it.

**`caption` is required and drawn.** A table with no name announces as "table, 3 columns, 4 rows"
and nothing else. Drawn rather than hidden for the reason `PopoverProps.title` gives: a hidden name
is one only assistive technology can check.

**Sorting is a link**, the same argument `Pagination` makes — a sorted table is a view with an
address. The heading links to the **next** direction, so clicking the column you are already sorted
by does something the second time. `aria-sort` carries `none` on sortable-but-unsorted columns and
is absent entirely on columns that cannot be sorted: the attribute is what says a column is
sortable, so `none` everywhere would announce a table full of controls that do not exist.

**The table sits in a focusable, named scroll region.** A table is the one thing in a layout whose
width comes from its content, so a wide one must scroll inside its own box — and a region that
scrolls but cannot be focused is unreachable by keyboard (WCAG 2.1.1), while anything focusable
needs a name and a role for that name to attach to (4.1.2). `aria-labelledby` points at the caption.
The cost is honest: one extra tab stop per table, including ones narrow enough never to scroll.

**`rowId` is required** rather than defaulting to the array index, because a table is where that
default costs most: re-sort and every index changes, so React reuses the wrong DOM node and any
state inside a cell lands on the wrong record. It is also what the engine keys rows by.

An empty result set renders its message **inside** the table, spanning the columns, so the row count
stays honest — a `<tbody>` with no rows and a paragraph beside it announces "0 rows" and then says
nothing about why.

## What this is not

No row selection, no cell-level keyboard navigation, no column resizing. Those absences are a
boundary rather than a backlog, and they are documented in the public types rather than left to be
discovered. A selectable grid is a different component with a different contract; it can be added
beside this one, but it cannot be bolted on without changing what every existing caller ships.

No zebra striping and no `density` axis either. Striping needs a second surface colour that reads as
"still a row" rather than "selected", and the one this package has — `bg.subtle` — is already spent
on `Menu`'s hover. Density is a real axis that wants a measurement against real data.

## Bundle cost

`Table` is **23,741 B** gzipped on its own (ceiling 26,116 B): 12,141 B of `Link`, 10,808 B of
TanStack core, and the component itself.

The barrel moved from 86,914 B to **98,467 B** (+11,553 B). Its ceiling is raised deliberately in
this change, from 88,004 B to **108,314 B**, by the repo's own rule — `CEILING_MULTIPLIER.barrel`
is 1.1 in `scripts/check-bundle-budget.js`, the same multiplier that sets a ceiling when any entry
is first authored. That leaves 9,847 B of headroom, which is what still catches the failure this
gate exists for: an unintended import of `Link` is 12 KB and of a react-aria collection is 30 KB,
both comfortably over.
