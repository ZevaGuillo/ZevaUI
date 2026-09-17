import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tabs } from "@zevaui/components";
import { expect, fn, userEvent, within } from "storybook/test";

// Every story here must pass the blocking axe gate configured in .storybook/preview.ts
// (`a11y: { test: "error" }`), run in real Chromium.
//
// Tabs render entirely in the story root — no portal, no overlay — so none of the
// `aria-hidden-focus` care Dialog and Menu need applies here. What DOES matter for the gate is
// that the tablist carries an accessible name: `label` is required in `tabs.types.ts` precisely
// so `aria-label` on the `role="tablist"` is never empty.
const meta = {
  title: "Tabs",
  component: Tabs,
  tags: ["visual"],
  args: {
    label: "Documentation sections",
    tabs: [
      { id: "overview", label: "Overview", content: "What this component does, in one screen." },
      { id: "usage", label: "Usage", content: "How to call it, with the common shapes." },
      { id: "api", label: "API", content: "Every prop, its type and its default." },
    ],
  },
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: "sm" },
};

// At `lg`, where the padding ratio is largest, so the gap between the tab strip and its rule is
// exaggerated the same way the other components' `lg` baselines exaggerate theirs.
export const Large: Story = {
  args: { size: "lg" },
};

// VERTICAL IS A DIFFERENT LAYOUT, NOT A DIFFERENT COLOUR. The strip moves beside the panel, the
// rule moves from the block-end edge to the inline-end one, and the selected tab's accent edge
// moves with it. If `Tabs.tsx` ever stopped stamping `data-orientation` onto each tab, the strip
// would still stack vertically — the root and list rules would see the attribute — while every
// tab kept its horizontal underline. That is the regression this baseline catches, and it is
// invisible in any assertion that only reads the list.
export const Vertical: Story = {
  args: { orientation: "vertical" },
};

// A disabled tab is dimmed rather than hidden: it stays in the strip so the set of sections reads
// the same, and it announces itself as unavailable.
export const WithDisabledTab: Story = {
  args: {
    tabs: [
      { id: "overview", label: "Overview", content: "What this component does." },
      { id: "usage", label: "Usage", content: "Not available yet.", isDisabled: true },
      { id: "api", label: "API", content: "Every prop, its type and its default." },
    ],
  },
};

// The selected tab is not the first one. Worth a baseline of its own because the accent edge and
// the `-1px` pull that merges it into the list's rule are easiest to get wrong away from the
// strip's starting edge.
export const SecondTabSelected: Story = {
  args: { defaultSelectedKey: "usage" },
};

// A strip long enough to exercise `whiteSpace: nowrap` on the tabs, which is what keeps a
// two-word label from wrapping into a taller tab than its neighbours.
export const ManyTabs: Story = {
  args: {
    label: "Release sections",
    tabs: [
      { id: "overview", label: "Overview", content: "One." },
      { id: "install", label: "Installation", content: "Two." },
      { id: "usage", label: "Usage", content: "Three." },
      { id: "theming", label: "Theming", content: "Four." },
      { id: "migration", label: "Migration guide", content: "Five." },
    ],
  },
};

// ARROW-KEY NAVIGATION IN A REAL BROWSER. `tabs.test.ts` covers this too, but only behind a
// hand-written `CSS.escape` shim: jsdom ships no global `CSS`, and react-aria calls
// `CSS.escape` when it resolves the focused collection item's DOM node — every arrow-key move
// goes through it. This story is the run with no shim at all, which is the only place the real
// focus path is exercised.
export const ArrowKeysMoveAndSelect: Story = {
  tags: ["!visual"],
  args: { onSelectionChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("tab", { name: "Overview" }).focus();

    await userEvent.keyboard("{ArrowRight}");

    // `keyboardActivation` defaults to automatic, so the arrow both moves focus AND selects.
    const usage = canvas.getByRole("tab", { name: "Usage" });
    await expect(usage).toHaveFocus();
    await expect(usage).toHaveAttribute("aria-selected", "true");
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("How to call it");
    await expect(args.onSelectionChange).toHaveBeenCalledWith("usage");
  },
};

// THE SKIP, IN A REAL BROWSER. A disabled tab that merely carried `aria-disabled` while the arrow
// keys still stopped on it would be announced as unavailable and yet sit in the keyboard path.
export const ArrowKeysSkipTheDisabledTab: Story = {
  tags: ["!visual"],
  args: {
    tabs: [
      { id: "overview", label: "Overview", content: "One." },
      { id: "usage", label: "Usage", content: "Two.", isDisabled: true },
      { id: "api", label: "API", content: "Three." },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("tab", { name: "Overview" }).focus();

    await userEvent.keyboard("{ArrowRight}");

    await expect(canvas.getByRole("tab", { name: "API" })).toHaveFocus();
    await expect(canvas.getByRole("tab", { name: "Usage" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  },
};

// VERTICAL SWAPS THE KEYS, and that is react-aria reading `aria-orientation` rather than anything
// this package does. Down moves along a vertical strip where Right moves along a horizontal one;
// asserting it here keeps the `orientation` prop from silently becoming a styling-only axis.
export const VerticalUsesTheVerticalArrows: Story = {
  tags: ["!visual"],
  args: { orientation: "vertical" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("tablist")).toHaveAttribute("aria-orientation", "vertical");

    canvas.getByRole("tab", { name: "Overview" }).focus();
    await userEvent.keyboard("{ArrowDown}");

    await expect(canvas.getByRole("tab", { name: "Usage" })).toHaveFocus();
  },
};

// THE PANEL IS REACHABLE FROM THE STRIP. RAC gives a panel with no focusable child of its own
// `tabIndex={0}` precisely so Tab from the selected tab lands on the content rather than skipping
// past it — which is what makes a tab set navigable at all for a keyboard user.
export const TabMovesFromTheStripIntoThePanel: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole("tab", { name: "Overview" }).focus();

    await userEvent.tab();

    await expect(canvas.getByRole("tabpanel")).toHaveFocus();
  },
};

// ONLY THE SELECTED PANEL EXISTS, asserted in the browser as well as in jsdom because the
// alternative — every panel mounted and inert — looks identical in a screenshot and differs
// entirely for a screen-reader user walking the document.
export const OnlyTheSelectedPanelIsMounted: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("tabpanel")).toHaveLength(1);

    await userEvent.click(canvas.getByRole("tab", { name: "API" }));

    await expect(canvas.getAllByRole("tabpanel")).toHaveLength(1);
    await expect(canvas.getByRole("tabpanel")).toHaveTextContent("Every prop");
  },
};

// THE THREE NON-EVENTS, in a real browser. Upstream fires `onSelectionChange` on mount, on a
// re-click of the selected tab, and on a click that lands on a disabled one; `Tabs.tsx` gates all
// three so the callback reports changes and nothing else. A consumer wiring this to a router
// depends on exactly that.
export const ReportsChangesAndNothingElse: Story = {
  tags: ["!visual"],
  args: { onSelectionChange: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);

    // Mounted, untouched: silent.
    await expect(args.onSelectionChange).not.toHaveBeenCalled();

    // The already-selected tab: still silent.
    await userEvent.click(canvas.getByRole("tab", { name: "Overview" }));
    await expect(args.onSelectionChange).not.toHaveBeenCalled();

    // A real change: exactly one call, carrying the id rather than the label.
    await userEvent.click(canvas.getByRole("tab", { name: "API" }));
    await expect(args.onSelectionChange).toHaveBeenCalledTimes(1);
    await expect(args.onSelectionChange).toHaveBeenCalledWith("api");
  },
};
