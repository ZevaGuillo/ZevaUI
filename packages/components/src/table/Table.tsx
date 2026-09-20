"use client";

import { type ColumnDef, tableFeatures, useTable } from "@tanstack/react-table";
import { useId, useMemo } from "react";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { Link } from "../link/Link.js";
import { tableRecipe } from "./table.recipe.js";
import type { TableColumn, TableProps, TableSort, TableSortDirection } from "./table.types.js";

/**
 * The two sort-related props, named once so the helpers at the bottom of this file do not have to
 * index into `TableProps` — which would drag its `Row extends object` constraint into functions
 * that never touch a row.
 */
type SortHref = (columnId: string, direction: TableSortDirection) => string;

/**
 * TWO ENGINE DECISIONS LIVE HERE, AND THEY POINT IN OPPOSITE DIRECTIONS.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * IT DOES NOT USE `Table` FROM REACT-ARIA-COMPONENTS.
 *
 * Measured against the installed 1.20 types rather than assumed: RAC's `Table` gives row
 * selection, cell-level keyboard navigation, column resizing and drag and drop — and it implements
 * them as `role="grid"`.
 *
 * That role is the part worth stopping on, because the usual framing ("the accessible one costs
 * more bytes") is backwards here. A screen reader reads a native `<table>` in its TABLE mode and a
 * `role="grid"` in its GRID mode, and those are different: grid mode is built for a thing you
 * operate cell by cell, table mode for a thing you read. For a table you READ, native semantics
 * are not the cheaper compromise — they are the better answer, and assistive technology has had
 * twenty years to get them right.
 *
 * So every piece of markup below is hand-written and native: `<table>`, `<caption>`,
 * `<th scope="col">`, `<th scope="row">`, `aria-sort`.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * IT DOES USE TANSTACK TABLE, AS AN INTERNAL ENGINE THE CONSUMER NEVER SEES.
 *
 * `@tanstack/react-table` v9 is headless — it owns column definitions, row models and state, and
 * renders nothing. That is what makes the two decisions compatible rather than contradictory: it
 * has no opinion about markup, so taking it costs none of the native semantics above.
 *
 * THE PUBLIC API IS THIS PACKAGE'S OWN, NOT TANSTACK'S. `table.types.ts` exposes `TableColumn<Row>`
 * and nothing else; `ColumnDef`, `tableFeatures` and `createColumnHelper` stop at this file. That
 * is the rule every `.types.ts` here states — "hand-picked, never a re-export of another library's
 * prop types" — and the reason is the same one that keeps react-aria's types out of `Menu` and
 * `Select`: a re-exported third-party type brings its own escape hatches, its own generics and its
 * own release cadence into a contract this package is supposed to own.
 *
 * WHAT IT COSTS TODAY, STATED PLAINLY RATHER THAN SOLD. v9 is opt-in by feature, so
 * `tableFeatures({})` tree-shakes sorting, filtering, pagination and grouping away — and the core
 * still measures 10,808 B gzipped on its own. For the flat, server-sorted table below that buys
 * row identity, a row model and a header model: real machinery, but not 10 KB of machinery. The
 * honest justification is forward-looking — client-side filtering, pagination, grouping, column
 * visibility and row selection become configuration rather than a rewrite. If those never arrive,
 * this was a bad trade, and that sentence belongs in the file rather than in nobody's memory.
 *
 * It is `clientOnly: true` twice over now: `useTable` is a hook, and a sortable heading is this
 * package's `Link`.
 */

/**
 * NO FEATURES, WHICH IS THE WHOLE POINT OF DECLARING THEM. v9 gates every feature behind this call
 * so the ones you do not name are never bundled. Sorting is deliberately absent: this component
 * does not sort, it DRAWS an order the caller already produced and says which one it is — see
 * `TableProps.sort`. Registering `rowSortingFeature` would add 2,222 B (measured) to ship a
 * client-side sort nothing calls.
 *
 * Module scope, not per render: `tableFeatures` builds an object, and a new one every render is a
 * new engine every render.
 */
const FEATURES = tableFeatures({});

export function Table<Row extends object>({
  caption,
  columns,
  rows,
  rowId,
  sort,
  sortHref,
  emptyMessage = "No results",
}: TableProps<Row>) {
  const slots = slotRecipeClassNames(tableRecipe, {});
  const captionId = useId();

  /**
   * This package's descriptors, translated into TanStack's shape. DISPLAY columns — no
   * `accessorKey`, no `accessorFn` — because `TableColumn.cell` already takes the whole row and
   * returns a node, so there is no value for the engine to extract and nothing it could sort or
   * filter on without one. That is the honest shape of the mapping rather than an oversight: an
   * accessor is what a future filtering or sorting feature would need, and it would come from a
   * new field on the public descriptor, not from guessing here.
   */
  const columnDefs = useMemo<Array<ColumnDef<typeof FEATURES, Row>>>(
    () =>
      columns.map((column) => ({
        id: column.id,
        header: column.header,
        cell: (info) => column.cell(info.row.original),
      })),
    [columns],
  );

  // TanStack mutates neither, but its options are typed as mutable arrays and `TableProps` is
  // `readonly` on purpose — the copy is the boundary between the two, not a defensive clone.
  const data = useMemo(() => [...rows], [rows]);

  const table = useTable({
    features: FEATURES,
    columns: columnDefs,
    data,
    // The one place `rowId` reaches the engine. Without it TanStack keys rows by index, which is
    // exactly the default `TableProps.rowId` exists to refuse: re-sort the rows and every index
    // changes, so React reuses the wrong DOM node.
    getRowId: (row) => rowId(row),
  });

  // Looked up by id rather than by position: the engine owns the order of its header model, and
  // reading this package's own per-column decisions out of an array index would couple the two.
  const byId = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);

  // At most one row header per row: two of them announce both before every value, which is worse
  // than none. The first column that asks for it wins, and the rest fall back to ordinary cells.
  const rowHeaderId = columns.find((column) => column.isRowHeader === true)?.id;

  return (
    /**
     * A FOCUSABLE, NAMED SCROLL REGION, WHICH IS A WCAG REQUIREMENT RATHER THAN A FLOURISH. A table
     * is the one thing in a layout whose width comes from its content, so a wide one must scroll
     * inside its own box. A region that scrolls but cannot be focused is unreachable by keyboard —
     * that is 2.1.1 (Keyboard) — so it takes `tabindex="0"`, and anything focusable needs a name
     * and a role for that name to attach to, which is 4.1.2. `aria-labelledby` points at the
     * caption, so the region is called whatever the table is called and nothing is invented.
     *
     * The cost is honest: one extra tab stop per table, including tables narrow enough never to
     * scroll. There is no way to know at render time whether it will overflow, and a tab stop that
     * is sometimes useless beats content that is sometimes unreachable.
     */
    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrollable region must be keyboard-reachable
    <div role="region" aria-labelledby={captionId} tabIndex={0} className={slots.scroller}>
      <table className={slots.table}>
        <caption id={captionId} className={slots.caption}>
          {caption}
        </caption>
        <thead className={slots.head}>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className={slots.row}>
              {headerGroup.headers.map((header) => {
                const column = byId.get(header.column.id);
                if (column === undefined) return null;

                return (
                  <th
                    key={header.id}
                    scope="col"
                    className={slots.headCell}
                    data-zui-align={column.align === "end" ? "end" : undefined}
                    // Only a SORTABLE column carries `aria-sort`, and an unsorted one carries
                    // "none" rather than nothing: the attribute is what tells a screen reader the
                    // column can be sorted at all, so omitting it on the others would announce one
                    // sortable column and hide the rest.
                    aria-sort={ariaSort(column, sortHref, sort)}
                  >
                    {headingOf(column, sortHref, sort)}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className={slots.body}>
          {data.length === 0 ? (
            <tr className={slots.row}>
              {/*
                One cell spanning the whole width. `colSpan` rather than a message outside the table
                is what keeps the row count honest — a `<tbody>` with no rows and a paragraph beside
                it announces "0 rows" and then says nothing about why.
              */}
              <td colSpan={columns.length} className={slots.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={slots.row}>
                {row.getAllCells().map((cell) => {
                  const column = byId.get(cell.column.id);
                  if (column === undefined) return null;

                  const align = column.align === "end" ? "end" : undefined;

                  // `<th scope="row">` for the column that identifies the record, so every other
                  // cell in the row is announced WITH it. See `TableColumn.isRowHeader`.
                  return column.id === rowHeaderId ? (
                    <th key={cell.id} scope="row" className={slots.cell} data-zui-align={align}>
                      <table.FlexRender cell={cell} />
                    </th>
                  ) : (
                    <td key={cell.id} className={slots.cell} data-zui-align={align}>
                      <table.FlexRender cell={cell} />
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Whether this column offers sorting at all: it has to ask for it AND have somewhere to point. */
const isSortable = <Row,>(column: TableColumn<Row>, sortHref: SortHref | undefined) =>
  column.sortable === true && sortHref !== undefined;

/**
 * The `aria-sort` value for a heading.
 *
 * `undefined` for a column that cannot be sorted — the attribute means "this is sortable", so
 * putting `none` on every heading would announce a whole table of sort controls that do not exist.
 */
function ariaSort<Row>(
  column: TableColumn<Row>,
  sortHref: SortHref | undefined,
  sort: TableSort | undefined,
): "ascending" | "descending" | "none" | undefined {
  if (!isSortable(column, sortHref)) return undefined;
  return sort?.columnId === column.id ? sort.direction : "none";
}

/**
 * A heading's contents: a link to the sorted view, or the plain label.
 *
 * THE DIRECTION IT LINKS TO IS THE NEXT ONE, NOT THE CURRENT ONE. Clicking the column you are
 * already sorted by ascending has to give you descending, or the control does nothing the second
 * time. Any other column starts ascending, which is the direction a reader assumes when they have
 * not said otherwise.
 *
 * The label stays a plain string in both branches, so the accessible name of a sorted column is
 * its heading and nothing else. The direction is already announced by `aria-sort`, and repeating
 * it in the link text ("Name, sorted ascending, ascending") is how that gets said twice.
 */
function headingOf<Row>(
  column: TableColumn<Row>,
  sortHref: SortHref | undefined,
  sort: TableSort | undefined,
) {
  if (!isSortable(column, sortHref) || sortHref === undefined) return column.header;

  const next: TableSortDirection =
    sort?.columnId === column.id && sort.direction === "ascending" ? "descending" : "ascending";

  return (
    <Link href={sortHref(column.id, next)} tone="neutral" underline="hover">
      {column.header}
    </Link>
  );
}
