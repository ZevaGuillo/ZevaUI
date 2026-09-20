import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TableProps } from "@zevaui/components";
import { Badge, Table } from "@zevaui/components";
import type { FunctionComponent } from "react";
import { expect, within } from "storybook/test";

type Issue = {
  id: string;
  title: string;
  status: "open" | "merged" | "stale";
  comments: number;
};

const ISSUES: readonly Issue[] = [
  { id: "1", title: "Fix the login redirect loop", status: "open", comments: 12 },
  { id: "2", title: "Dark theme contrast on muted text", status: "merged", comments: 3 },
  { id: "3", title: "Breadcrumb wraps on narrow viewports", status: "open", comments: 7 },
  { id: "4", title: "Upgrade the release workflow", status: "stale", comments: 41 },
];

const TONE = { open: "accent", merged: "success", stale: "warning" } as const;

// The columns every story starts from. `title` identifies the row, so it is the `<th scope="row">`
// that lets a screen reader announce every other cell WITH its subject — "Comments, 12, Fix the
// login redirect loop" rather than a number with nothing attached.
const COLUMNS = [
  {
    id: "title",
    header: "Title",
    cell: (issue: Issue) => issue.title,
    isRowHeader: true,
    sortable: true,
  },
  {
    id: "status",
    header: "Status",
    cell: (issue: Issue) => <Badge tone={TONE[issue.status]}>{issue.status}</Badge>,
  },
  {
    id: "comments",
    header: "Comments",
    cell: (issue: Issue) => issue.comments,
    align: "end" as const,
    sortable: true,
  },
];

/**
 * TYPED BY ITS ARGS RATHER THAN BY `typeof meta`, WHICH IS FORCED BY `Table` BEING GENERIC.
 *
 * `StoryObj<typeof meta>` infers the args from the component's declared props, and a generic
 * component has none until it is instantiated — so the row type collapses to `unknown` and every
 * story's `columns` and `rows` stop type-checking against each other. Naming `TableProps<Issue>`
 * on both `Meta` and `StoryObj` instantiates it once, which is Storybook's documented shape for
 * generic components and is why `component` needs the cast: the value is generic, the annotation
 * is not.
 */
const meta: Meta<TableProps<Issue>> = {
  title: "Table",
  component: Table as FunctionComponent<TableProps<Issue>>,
  tags: ["visual"],
  args: {
    caption: "Open issues",
    columns: COLUMNS,
    rows: ISSUES,
    rowId: (issue: Issue) => issue.id,
  },
};

export default meta;

type Story = StoryObj<TableProps<Issue>>;

const sortHref = (columnId: string, direction: string) =>
  `/issues?sort=${columnId}&dir=${direction}`;

// A table with no sorting: every heading is plain text, because a sort control with no destination
// is the callback API this component exists not to be.
export const Default: Story = {};

export const Sortable: Story = {
  args: { sortHref },
};

export const SortedDescending: Story = {
  args: { sortHref, sort: { columnId: "comments", direction: "descending" } },
};

// An empty result set is a table with nothing in it, not the absence of a table: the caption and
// the headers stay, and the message goes INSIDE, spanning the columns, so the row count stays
// honest.
export const NoRows: Story = {
  args: { rows: [], emptyMessage: "No issues match these filters" },
};

/**
 * THE BASELINE FOR THE ONE PIECE OF LAYOUT A TABLE CANNOT AVOID.
 *
 * A table is the only thing in a layout whose width comes from its content rather than its
 * container, so a wide one has to scroll inside its own box instead of pushing the page sideways.
 * This story puts a table wider than its column and is where that scrolling is actually exercised.
 */
export const ScrollsInANarrowColumn: Story = {
  args: {
    columns: [
      ...COLUMNS,
      { id: "author", header: "Reported by", cell: () => "ana.beltran@example.com" },
      { id: "updated", header: "Last updated", cell: () => "2026-09-14 11:42" },
      { id: "branch", header: "Branch", cell: () => "fix/login-redirect-loop" },
    ],
  },
  // The render callback is typed explicitly: Storybook's `StoryObj<typeof meta>` erases the
  // component's type parameter, so `args` arrives as `TableProps<unknown>` and the spread stops
  // type-checking. Naming the row type back is narrower than casting and keeps the story honest
  // about what it renders.
  render: (args) => (
    <div style={{ inlineSize: "26rem" }}>
      <Table<Issue> {...args} />
    </div>
  ),
};

/**
 * THE GATE. It covers the three markup decisions that separate this from a `<div>` grid, none of
 * which look wrong when they are missing — which is exactly why they are asserted rather than
 * illustrated.
 */
export const SemanticsAreTheWholePoint: Story = {
  tags: ["!visual"],
  args: { sortHref, sort: { columnId: "title", direction: "ascending" } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // A real table, named by its caption — not "table, 3 columns, 4 rows" and nothing else.
    const table = canvas.getByRole("table", { name: "Open issues" });
    await expect(table.tagName).toBe("TABLE");

    // The identifying column is a row header, so every other cell is announced with its subject.
    const rowHeaders = canvas.getAllByRole("rowheader");
    await expect(rowHeaders).toHaveLength(ISSUES.length);
    await expect(rowHeaders[0]).toHaveAttribute("scope", "row");

    // `aria-sort` on every SORTABLE column and on no other: the attribute is what says a column can
    // be sorted, so `none` on the unsorted ones and nothing at all on `Status`.
    const [title, status, comments] = canvas.getAllByRole("columnheader");
    await expect(title).toHaveAttribute("aria-sort", "ascending");
    await expect(comments).toHaveAttribute("aria-sort", "none");
    await expect(status).not.toHaveAttribute("aria-sort");

    // Sorting is a link, and the one you are already sorted by points at the OTHER direction —
    // otherwise the control does nothing the second time you use it.
    await expect(canvas.getByRole("link", { name: "Title" })).toHaveAttribute(
      "href",
      "/issues?sort=title&dir=descending",
    );

    // The scroll region is focusable and borrows the caption for its name: a region that scrolls
    // but cannot be focused is unreachable by keyboard (WCAG 2.1.1).
    const region = canvas.getByRole("region", { name: "Open issues" });
    await expect(region).toHaveAttribute("tabindex", "0");
  },
};
