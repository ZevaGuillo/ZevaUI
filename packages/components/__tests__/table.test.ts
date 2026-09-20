// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Table } from "../src/table/Table.js";
import { tableRecipe } from "../src/table/table.recipe.js";
import type { TableColumn, TableProps } from "../src/table/table.types.js";
import {
  declarationBodies,
  emittedStylesheet,
  styledClassPredicate,
} from "./support/emitted-css.js";

const css = emittedStylesheet();

// This file's own root, for the built-declaration gate at the bottom. Kept local rather than added
// to `support/emitted-css.ts`: that module owns reading the STYLESHEET, and one gate reading
// `.d.ts` files is not yet a second caller worth extracting for.
const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

type Issue = { id: string; title: string; comments: number };

const ISSUES: readonly Issue[] = [
  { id: "a", title: "Fix the login redirect", comments: 12 },
  { id: "b", title: "Dark theme contrast", comments: 3 },
];

const COLUMNS: readonly TableColumn<Issue>[] = [
  { id: "title", header: "Title", cell: (issue) => issue.title, isRowHeader: true, sortable: true },
  { id: "comments", header: "Comments", cell: (issue) => issue.comments, align: "end" },
];

const sortHref = (columnId: string, direction: string) =>
  `/issues?sort=${columnId}&dir=${direction}`;

afterEach(() => {
  cleanup();
});

function renderTable(props: Partial<TableProps<Issue>> = {}) {
  return render(
    createElement(Table<Issue>, {
      caption: "Open issues",
      columns: COLUMNS,
      rows: ISSUES,
      rowId: (issue) => issue.id,
      ...props,
    }),
  );
}

describe("Table", () => {
  it("renders a real table named by its caption", () => {
    renderTable();
    const table = screen.getByRole("table", { name: "Open issues" });
    expect(table.tagName).toBe("TABLE");
    expect(within(table).getByText("Open issues").tagName).toBe("CAPTION");
  });

  it("renders one column header per column, scoped to its column", () => {
    renderTable();
    const headers = screen.getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["Title", "Comments"]);
    for (const header of headers) expect(header.getAttribute("scope")).toBe("col");
  });

  it("renders one row per row, with a cell per column", () => {
    renderTable();
    // The header row plus two data rows.
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("Fix the login redirect")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
  });

  it("keys its rows by identity rather than by position", () => {
    // Not observable in the DOM, so asserted where it IS observable: re-rendering with the rows
    // reversed must move the text, and the component must not throw on duplicate keys. The prop is
    // required precisely so a re-sort cannot reuse the wrong DOM node.
    const { rerender } = renderTable();
    rerender(
      createElement(Table<Issue>, {
        caption: "Open issues",
        columns: COLUMNS,
        rows: [...ISSUES].reverse(),
        rowId: (issue) => issue.id,
      }),
    );
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("Dark theme contrast")).toBeTruthy();
  });
});

/**
 * THE ROW HEADER IS WHAT MAKES EVERY OTHER CELL MEAN SOMETHING.
 *
 * `<th scope="row">` on the column that identifies the record is what lets a screen reader announce
 * a value WITH its subject — "Comments, 12, Fix the login redirect" — instead of stranding a number
 * with nothing attached. It is the single highest-value markup decision in a data table and the one
 * most often skipped, because nothing looks wrong without it.
 */
describe("Table row headers", () => {
  it("renders the identifying column as a row header", () => {
    renderTable();
    const rowHeaders = screen.getAllByRole("rowheader");
    expect(rowHeaders.map((cell) => cell.textContent)).toEqual([
      "Fix the login redirect",
      "Dark theme contrast",
    ]);
    for (const cell of rowHeaders) expect(cell.getAttribute("scope")).toBe("row");
  });

  it("renders ordinary cells for every other column", () => {
    renderTable();
    expect(screen.getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["12", "3"]);
  });

  // A row with two headers announces both before every value, which is worse than none. The first
  // column that asks wins and the rest fall back, rather than the component throwing on data it
  // can still render.
  it("honours only the first column that asks to be the row header", () => {
    renderTable({
      columns: [
        { id: "title", header: "Title", cell: (i) => i.title, isRowHeader: true },
        { id: "comments", header: "Comments", cell: (i) => i.comments, isRowHeader: true },
      ],
    });
    expect(screen.getAllByRole("rowheader")).toHaveLength(2); // one per row, not two per row
    expect(screen.getAllByRole("cell")).toHaveLength(2);
  });

  it("renders every column as an ordinary cell when none asks", () => {
    renderTable({
      columns: [{ id: "title", header: "Title", cell: (i) => i.title }],
    });
    expect(screen.queryAllByRole("rowheader")).toHaveLength(0);
    expect(screen.getAllByRole("cell")).toHaveLength(2);
  });
});

/**
 * SORTING IS A LINK, for the reason `Pagination` gives: a sorted table is a view with an address.
 * `?sort=title&dir=asc` can be bookmarked, shared and reached with the back button; a click handler
 * is none of those.
 */
describe("Table sorting", () => {
  it("renders a sortable heading as a link to the sorted view", () => {
    renderTable({ sortHref });
    expect(screen.getByRole("link", { name: "Title" }).getAttribute("href")).toBe(
      "/issues?sort=title&dir=ascending",
    );
  });

  it("leaves a column that did not ask for it as plain text", () => {
    renderTable({ sortHref });
    expect(screen.queryByRole("link", { name: "Comments" })).toBeNull();
  });

  // A sort control with no destination is the callback API this component exists not to be, so it
  // degrades to a plain heading rather than rendering a link to nowhere.
  it("renders a plain heading when there is nowhere to point", () => {
    renderTable();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getAllByRole("columnheader")[0].textContent).toBe("Title");
  });

  /**
   * THE DIRECTION IT LINKS TO IS THE NEXT ONE. Clicking the column you are already sorted by
   * ascending has to give you descending, or the control does nothing the second time.
   */
  it("offers the opposite direction for the column already sorted ascending", () => {
    renderTable({ sortHref, sort: { columnId: "title", direction: "ascending" } });
    expect(screen.getByRole("link", { name: "Title" }).getAttribute("href")).toBe(
      "/issues?sort=title&dir=descending",
    );
  });

  it("offers ascending again from descending", () => {
    renderTable({ sortHref, sort: { columnId: "title", direction: "descending" } });
    expect(screen.getByRole("link", { name: "Title" }).getAttribute("href")).toBe(
      "/issues?sort=title&dir=ascending",
    );
  });
});

/**
 * `aria-sort` IS WHAT TELLS A SCREEN READER A COLUMN CAN BE SORTED AT ALL, which is why the
 * unsorted sortable column carries `none` rather than nothing — omitting it there would announce
 * one sortable column and hide the rest. And why a column that cannot be sorted carries no
 * `aria-sort` at all: `none` on every heading would announce a whole table of controls that do not
 * exist.
 */
describe("Table announces which column is sorted", () => {
  it("marks the sorted column with its direction and the rest with none", () => {
    renderTable({
      sortHref,
      sort: { columnId: "title", direction: "descending" },
      columns: [
        { id: "title", header: "Title", cell: (i) => i.title, sortable: true },
        { id: "comments", header: "Comments", cell: (i) => i.comments, sortable: true },
      ],
    });
    const [title, comments] = screen.getAllByRole("columnheader");
    expect(title.getAttribute("aria-sort")).toBe("descending");
    expect(comments.getAttribute("aria-sort")).toBe("none");
  });

  it("gives a column that cannot be sorted no aria-sort at all", () => {
    renderTable({ sortHref });
    const [, comments] = screen.getAllByRole("columnheader");
    expect(comments.hasAttribute("aria-sort")).toBe(false);
  });

  it("gives every heading none when nothing is sorted yet", () => {
    renderTable({ sortHref });
    expect(screen.getAllByRole("columnheader")[0].getAttribute("aria-sort")).toBe("none");
  });
});

describe("Table with no rows", () => {
  it("says so inside the table rather than beside it", () => {
    renderTable({ rows: [] });
    const cell = screen.getByRole("cell", { name: "No results" });
    expect(cell.getAttribute("colspan")).toBe(String(COLUMNS.length));
  });

  it("lets the message be written for the case at hand", () => {
    renderTable({ rows: [], emptyMessage: "No issues match these filters" });
    expect(screen.getByText("No issues match these filters")).toBeTruthy();
  });

  // Still a named table with its headers intact: an empty result set is a table with nothing in it,
  // not the absence of a table.
  it("keeps its caption and its column headers", () => {
    renderTable({ rows: [] });
    expect(screen.getByRole("table", { name: "Open issues" })).toBeTruthy();
    expect(screen.getAllByRole("columnheader")).toHaveLength(2);
  });
});

/**
 * A TABLE IS THE ONE THING IN A LAYOUT WHOSE WIDTH COMES FROM ITS CONTENT, so a wide one has to
 * scroll inside its own box. A region that scrolls but cannot be focused is unreachable by keyboard
 * — WCAG 2.1.1 — and anything focusable needs a name and a role for that name to attach to, which
 * is 4.1.2. The caption supplies the name, so nothing has to be invented.
 */
describe("Table's scroll region", () => {
  it("is focusable and named by the caption", () => {
    renderTable();
    const region = screen.getByRole("region", { name: "Open issues" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(within(region).getByRole("table")).toBeTruthy();
  });
});

describe("Table class contract", () => {
  it("stamps each slot's class, and no variant class, because the recipe declares none", () => {
    const { container } = renderTable();
    const slots = slotRecipeClassNames(tableRecipe, {});

    expect(screen.getByRole("region").className).toBe(slots.scroller);
    expect(screen.getByRole("table").className).toBe(slots.table);
    expect(container.querySelector("caption")?.className).toBe(slots.caption);
    expect(container.querySelector("thead")?.className).toBe(slots.head);
  });

  // Alignment is per COLUMN, so it cannot be a recipe variant — a variant applies to the whole
  // component. It is an attribute, the same shape `button.recipe.ts` uses for its icon boxes.
  it("marks an end-aligned column on its header and its cells", () => {
    const { container } = renderTable();
    expect(container.querySelectorAll("[data-zui-align='end']")).toHaveLength(3); // header + 2 cells
    expect(screen.getAllByRole("columnheader")[0].hasAttribute("data-zui-align")).toBe(false);
  });
});

function tableElement(props: TableProps<Issue>) {
  return createElement(Table<Issue>, props);
}

describe("Table public API surface (type-level)", () => {
  const base = {
    caption: "Open issues",
    columns: COLUMNS,
    rows: ISSUES,
    rowId: (issue: Issue) => issue.id,
  };

  it("rejects className and style at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      tableElement({ ...base, className: "x" }),
      // @ts-expect-error style is not part of the public API
      tableElement({ ...base, style: {} }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  it("requires a caption and a row identity", () => {
    const constructed = [
      // @ts-expect-error caption is required — a table with no name announces only its dimensions
      tableElement({ columns: COLUMNS, rows: ISSUES, rowId: (i: Issue) => i.id }),
      // @ts-expect-error rowId is required — the index default reuses the wrong node on a re-sort
      tableElement({ caption: "x", columns: COLUMNS, rows: ISSUES }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  /**
   * The type parameter is what makes a column's `cell` function receive a real row rather than
   * `unknown`. Inferred from `rows`, so no call site writes it down — and a column reaching for a
   * field the row does not have is a compile error rather than `undefined` in a cell.
   */
  it("types a column's cell function against the row", () => {
    const constructed = [
      tableElement({
        ...base,
        // @ts-expect-error `Issue` has no `author` field
        columns: [{ id: "author", header: "Author", cell: (issue: Issue) => issue.author }],
      }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // The boundary this component documents rather than leaves to be discovered: it is a table you
  // read and sort, not a grid you select in. There is no prop to reach for.
  it("offers no selection API", () => {
    const constructed = [
      // @ts-expect-error selection is what react-aria's Table is for; see table.types.ts
      tableElement({ ...base, selectionMode: "multiple" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

describe("the emitted CSS Table owes", () => {
  const hasRule = styledClassPredicate(css);

  // `body` is deliberately absent: its base style object is empty, so Panda emits no rule for it
  // and `emittedSlotClassNames` reports it as unstyled. The class is still rendered — a slot with
  // no styles today is a structural hook that can gain them without changing a consumer's DOM.
  it("emits a rule for every slot it actually styles", () => {
    for (const slot of tableRecipe.slots) {
      if (slot === "body") continue;
      expect({ [slot]: hasRule(`zui-table__${slot}`) }).toEqual({ [slot]: true });
    }
  });

  it("emits no variant class for a recipe that declares no variants", () => {
    expect(css.match(/\.zui-table__[a-z]+--[a-z]+_/i)).toBeNull();
  });

  it("scrolls horizontally rather than letting a wide table push the page sideways", () => {
    const bodies = declarationBodies(css, (selector) => selector.includes(".zui-table__scroller"));
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies.join(";")).toMatch(/overflow-x:\s*auto/);
  });

  /**
   * `border-collapse: collapse` is what makes the per-row rules meet instead of doubling between
   * adjacent rows. Without it every boundary is two lines thick and the table reads as a grid it
   * was deliberately not given.
   */
  it("collapses its borders", () => {
    const bodies = declarationBodies(css, (selector) => selector.includes(".zui-table__table"));
    expect(bodies.join(";")).toMatch(/border-collapse:\s*collapse/);
  });
});

/**
 * THE GATE THAT MAKES THE ENGINE AN IMPLEMENTATION DETAIL RATHER THAN A PROMISE.
 *
 * `Table` is built on `@tanstack/react-table`, and the decision that came with it was that the
 * consumer never sees it: the public API is this package's own `TableColumn<Row>`, and TanStack's
 * `ColumnDef`, `tableFeatures` and `createColumnHelper` stop inside `Table.tsx`. That is the rule
 * every `.types.ts` here states — "hand-picked, never a re-export of another library's prop types"
 * — and it is the reason react-aria's types never reached `Menu` or `Select` either.
 *
 * A rule like that decays silently. One `export type { ColumnDef }` added for convenience, or one
 * prop typed as `SortingState` because it was easier, and TanStack is in the contract forever —
 * with its generics, its escape hatches and its release cadence. Nothing would look wrong; the
 * package would simply have a dependency in its public types that it had promised not to have.
 *
 * ASSERTED AGAINST THE BUILT `.d.ts` FILES, NOT THE SOURCE, for the reason every other gate here
 * reads `dist`: the source is the input and the declarations are what a consumer's compiler
 * actually resolves. A type can reach the public surface by inference without anyone writing an
 * import for it, and only the emitted declarations show that.
 */
describe("the shipped type surface keeps TanStack inside", () => {
  const declarations = readdirSync(join(packageRoot, "dist"), {
    recursive: true,
    encoding: "utf8",
  }).filter((entry) => entry.endsWith(".d.ts"));

  it("ships declarations to check in the first place", () => {
    expect(declarations.length).toBeGreaterThan(0);
  });

  it("names @tanstack in none of them", () => {
    const leaking = declarations.filter((entry) =>
      readFileSync(join(packageRoot, "dist", entry), "utf8").includes("@tanstack"),
    );
    expect(leaking).toEqual([]);
  });

  // The counterpart, so the test above cannot pass by the engine having quietly been removed: the
  // built module really is using it.
  it("while the built module really does import it", () => {
    const built = readFileSync(join(packageRoot, "dist", "table", "Table.js"), "utf8");
    expect(built).toContain("@tanstack/react-table");
  });
});
