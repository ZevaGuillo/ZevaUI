import type { ReactNode } from "react";

/** Which edge a column's contents sit against. `end` is what numbers want. */
export type TableAlign = "start" | "end";

export type TableSortDirection = "ascending" | "descending";

/**
 * One column, described as data rather than composed as markup — the rule `MenuItemDescriptor` and
 * `BreadcrumbDescriptor` already follow, and the one `<table>` enforces hardest: a `<tr>` accepts
 * only `<td>` and `<th>`, and children composition would hand the consumer those elements, which
 * are structure rather than content.
 *
 * GENERIC OVER THE ROW, which is the one place this package reaches for a type parameter. Every
 * other descriptor here holds strings; a column holds a FUNCTION from your data to a cell, and
 * without the parameter that function's argument is `unknown` and every call site starts with a
 * cast. TypeScript infers it from `rows`, so no call site writes it down.
 */
export type TableColumn<Row> = {
  /** Stable identity of the column. Used as the cell key, and as what `sortHref` is asked about. */
  readonly id: string;
  /** The column's visible heading, and its accessible name. A plain string: see `TableProps`. */
  readonly header: string;
  /** What this column shows for a given row. */
  readonly cell: (row: Row) => ReactNode;
  readonly align?: TableAlign;
  /**
   * Whether this column IDENTIFIES its row — the title in a list of issues, the name in a list of
   * people. Such a column is rendered as `<th scope="row">` rather than `<td>`, which is what lets
   * a screen reader announce every other cell WITH the row it belongs to ("Comments, 12, Fix the
   * login redirect") instead of stranding a number with no subject.
   *
   * At most one column should set it; the first that does wins and the rest are treated as ordinary
   * cells, because a row with two headers announces both before every value.
   */
  readonly isRowHeader?: boolean;
  /**
   * Whether this column can be sorted. Needs `TableProps.sortHref` to have anything to point at —
   * without it the heading renders as plain text, because a sort control with no destination is
   * the callback API this component exists not to be.
   */
  readonly sortable?: boolean;
};

/** Which column the rows are currently ordered by, and which way. */
export type TableSort = {
  readonly columnId: string;
  readonly direction: TableSortDirection;
};

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types — this component imports
 * none of them, which is the decision `Table.tsx` opens by justifying.
 *
 * WHAT THIS IS NOT: a grid. There is no row selection, no cell-level keyboard navigation and no
 * column resizing, and those absences are a boundary rather than a backlog. They are what
 * react-aria's `Table` is for, and taking them means `role="grid"` — which changes how a screen
 * reader reads the thing, from its table mode into its grid mode. For a table you READ, native
 * `<table>` semantics are not merely cheaper, they are better. A selectable grid is a different
 * component with a different contract, and it can be added beside this one; it cannot be bolted
 * onto it without changing what every existing caller ships.
 */
export type TableProps<Row extends object> = {
  /**
   * What this table is a table OF, rendered as its `<caption>`.
   *
   * REQUIRED, and drawn rather than visually hidden. A table with no name is announced as "table,
   * 4 columns, 12 rows" and nothing else, which is the blocking-axe-gate failure `Dialog.title` and
   * `PopoverProps.title` both exist to prevent. Drawn for the reason `PopoverProps.title` gives: a
   * hidden name is one only assistive technology can check, and this package has no way to tell a
   * caller theirs went stale.
   *
   * It also names the scroll region — see `Table.tsx`.
   */
  readonly caption: string;
  /** The columns, in the order they are rendered. */
  readonly columns: readonly TableColumn<Row>[];
  /** The rows, in the order they are rendered. Sorting them is the caller's job — see `sortHref`. */
  readonly rows: readonly Row[];
  /**
   * Stable identity of a row, used as its React key.
   *
   * Required rather than defaulted to the array index, because a table is the component where that
   * default costs the most: re-sort the rows and every index changes, so React reuses the wrong DOM
   * nodes and any state inside a cell — a focused input, an open menu — lands on the wrong record.
   */
  readonly rowId: (row: Row) => string;
  /**
   * Which column the rows you passed are already ordered by. This component does NOT sort: it draws
   * the arrangement you hand it and says which one that is, because the rows on a page usually come
   * from a query that did the ordering.
   */
  readonly sort?: TableSort;
  /**
   * Where a sorted view lives, as a function of the column and the direction.
   *
   * A URL rather than a callback, the same argument `Pagination` makes: a sorted table is a view
   * with an address. `?sort=name&dir=asc` can be bookmarked, shared and reached with the back
   * button, and a click handler is none of those.
   */
  readonly sortHref?: (columnId: string, direction: TableSortDirection) => string;
  /** What to say when there are no rows. Defaults to "No results". */
  readonly emptyMessage?: string;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
