import type { Meta, StoryObj } from "@storybook/react-vite";
import { Pagination } from "@zevaui/components";
import { expect, within } from "storybook/test";

// Every story here ends up with a current page that is NOT a link, which is the rule this control
// shares with `Breadcrumb`: a link to the page you are already on is announced as a link and clicks
// to no effect. `CurrentPageIsNotALink` asserts it rather than showing it.
const meta = {
  title: "Pagination",
  component: Pagination,
  tags: ["visual"],
  args: {
    page: 4,
    total: 20,
    href: (page: number) => `/issues?page=${page}`,
  },
} satisfies Meta<typeof Pagination>;

export default meta;

type Story = StoryObj<typeof meta>;

// The familiar five-cell core, with a gap at one end only: on page 4 the leading gap would stand in
// for page 2 alone, so the page is drawn instead. See `paginationWindow`.
export const Default: Story = {};

// Both gaps, which is what the middle of a long trail looks like.
export const Middle: Story = {
  args: { page: 10 },
};

// The first page: no Previous to go to, and the cell where it would be is reserved but silent.
export const FirstPage: Story = {
  args: { page: 1 },
};

export const LastPage: Story = {
  args: { page: 20 },
};

// A trail short enough that the window covers every page — no gaps at all.
export const ShortTrail: Story = {
  args: { page: 3, total: 5 },
};

export const WiderWindow: Story = {
  args: { page: 10, siblings: 2 },
};

/**
 * THE BASELINE THAT WOULD CATCH A REFLOW NOBODY SEES AT PAGE 4.
 *
 * Page numbers are one, two or three digits, so a row sized to its content changes width the moment
 * you paginate past 9 or 99 — and the control you are clicking moves out from under the pointer
 * that just clicked it. Every cell has a `min-inline-size` floor for that reason, and this story is
 * where three-digit numbers actually appear.
 */
export const ThreeDigitPages: Story = {
  args: { page: 128, total: 999 },
};

// The other geometry that only breaks at one viewport width: a wide window in a narrow column has
// to wrap rather than push the page sideways.
export const WrapsInANarrowColumn: Story = {
  args: { page: 10, siblings: 4 },
  render: (args) => (
    <div style={{ inlineSize: "16rem" }}>
      <Pagination {...args} />
    </div>
  ),
};

export const LocalisedLabels: Story = {
  args: {
    label: "Paginación",
    previousLabel: "Página anterior",
    nextLabel: "Página siguiente",
  },
};

/**
 * THE GATE, and it covers the three decisions that separate this from a conventional pagination:
 * the current page is not a link, the edge controls are named with words rather than the glyph they
 * draw, and the ellipses never reach the accessibility tree.
 */
export const CurrentPageIsNotALink: Story = {
  tags: ["!visual"],
  args: { page: 10 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const current = canvas.getByText("10");
    await expect(current).toHaveAttribute("aria-current", "page");
    await expect(canvas.queryByRole("link", { name: "10" })).toBeNull();

    // Named by words. A link whose only content is `‹` computes its name from that character, and
    // "single left-pointing angle quotation mark" is not what the control does.
    await expect(canvas.getByRole("link", { name: "Previous page" })).toBeTruthy();
    await expect(canvas.getByRole("link", { name: "Next page" })).toBeTruthy();

    // The trail announces its pages and nothing else — never "1 ellipsis 9 11 ellipsis 20".
    const names = canvas
      .getAllByRole("link")
      .map((link) => link.getAttribute("aria-label") ?? link.textContent);
    await expect(names).toEqual(["Previous page", "1", "9", "11", "20", "Next page"]);

    /**
     * Every link in the trail paints the same colour, edge chevrons included.
     *
     * ADDED AFTER SQUINTING AT A BASELINE AND NOT BEING SURE. The chevrons are thin glyphs at body
     * size, and in the first screenshot they read as bluer than the digits beside them — which
     * would mean the `tone="neutral"` had not reached them and they were falling back to a link
     * colour. Asserted relatively rather than against a literal `rgb()`, so it holds in all three
     * themes and says the thing that actually matters: whatever `neutral` resolves to here, every
     * link resolves to the same one.
     */
    const colours = new Set(
      canvas.getAllByRole("link").map((link) => getComputedStyle(link).color),
    );
    await expect([...colours]).toHaveLength(1);
  },
};

// No baseline: the point is the absence. A pagination control for one page tells the reader
// something they can already see, and costs a landmark in the accessibility tree to say it.
export const SinglePageRendersNothing: Story = {
  tags: ["!visual"],
  args: { page: 1, total: 1 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("navigation")).toBeNull();
  },
};
