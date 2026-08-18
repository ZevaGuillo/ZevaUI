import type { Meta, StoryObj } from "@storybook/react-vite";
import { Menu } from "@zevaui/components";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

// Every story here must pass the blocking axe gate configured in .storybook/preview.ts
// (`a11y: { test: "error" }`), run in real Chromium.
//
// Dialog's stories work around react-aria hiding everything outside the portal while an overlay
// is open: a focusable control left in the story root trips axe's `aria-hidden-focus` rule, so
// those stories either render the dialog alone or close it before axe runs. A Menu cannot do
// that — its trigger is part of the component and stays in the story root, visible and
// focusable, for as long as the popover is open.
//
// It does not have to, and the reason was measured rather than assumed. `usePopover` in the
// installed react-aria 3.51.0 hides outside content with
// `ariaHideOutside(targets, { shouldUseInert: true })`, and that helper sets the `inert`
// PROPERTY instead of `aria-hidden="true"` whenever the browser supports it. Probed in this very
// Chromium run with the menu open: the story canvas reports `inert === true` and NO `aria-hidden`
// attribute, and the trigger's nearest `[aria-hidden=true]` ancestor is none. `aria-hidden-focus`
// therefore has nothing to fire on — the content is genuinely unfocusable, not merely relabelled.
// `useModalOverlay`, which Dialog goes through, is the code path Dialog's note describes.
//
// So these stories keep the trigger on screen and leave the menu open while axe scans, rather
// than arranging the DOM so the question never comes up. `OpensNavigatesAndSelects` asserts the
// inert/aria-hidden pair explicitly, so a future react-aria that drops the inert branch goes red
// here with a readable reason instead of as an opaque axe violation.
const meta = {
  title: "Menu",
  component: Menu,
  tags: ["visual"],
  args: {
    label: "Project actions",
    items: [
      { id: "rename", label: "Rename project" },
      {
        id: "duplicate",
        label: "Duplicate project",
        description: "Copies every task, file and comment.",
      },
      { id: "export", label: "Export as CSV" },
      { id: "archive", label: "Archive project", description: "Read-only from then on." },
      { id: "delete", label: "Delete project", isDisabled: true },
    ],
    defaultOpen: true,
    onAction: fn(),
  },
} satisfies Meta<typeof Menu>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const MatchingTriggerWidth: Story = {
  args: {
    width: "trigger",
    label: "Choose a destination branch for this release",
  },
};

export const WithoutDescriptions: Story = {
  args: {
    label: "Sort by",
    items: [
      { id: "name", label: "Name" },
      { id: "updated", label: "Last updated" },
      { id: "size", label: "Size" },
    ],
  },
};

export const Closed: Story = {
  args: { defaultOpen: false },
};

// The full keyboard round trip against the real component: the trigger opens the menu, arrow
// keys walk the rows (stepping over the disabled one), Enter activates a row, the menu closes
// and focus returns to the trigger. `screen` (not `within(canvasElement)`) for anything inside
// the popover, because it is portalled out of the story root.
export const OpensNavigatesAndSelects: Story = {
  tags: ["!visual"],
  args: { defaultOpen: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Project actions" });

    await userEvent.click(trigger);
    await screen.findByRole("menu", { name: "Project actions" });

    // The measured reason the trigger may stay in the story root while axe scans: react-aria
    // takes the outside content out of the accessibility tree with `inert`, never `aria-hidden`,
    // so `aria-hidden-focus` has nothing to fire on. Asserted here so a react-aria that switches
    // back to `aria-hidden` fails with this message rather than as a bare axe violation.
    await expect(canvasElement).toHaveProperty("inert", true);
    await expect(canvasElement).not.toHaveAttribute("aria-hidden");

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Rename project" })).toHaveFocus(),
    );

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Duplicate project" })).toHaveFocus(),
    );

    // "Delete project" is disabled, so walking to the end of the list must stop on "Archive
    // project" and never land on it.
    await userEvent.keyboard("{End}");
    await waitFor(() =>
      expect(screen.getByRole("menuitem", { name: "Archive project" })).toHaveFocus(),
    );

    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await expect(args.onAction).toHaveBeenCalledWith("archive");
    await expect(trigger).toHaveFocus();
    // ...and the page is handed back: closing the menu must undo the inert marking, or the story
    // root would stay unreachable for good.
    await waitFor(() => expect(canvasElement).toHaveProperty("inert", false));
  },
};
