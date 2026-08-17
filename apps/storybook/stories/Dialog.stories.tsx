import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Dialog, type DialogProps } from "@zevaui/components";
import { useState } from "react";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

// Every story here must pass the blocking axe gate configured in .storybook/preview.ts
// (`a11y: { test: "error" }`), run in real Chromium. Two things that gate depends on:
//
//   * The dialog is portalled to <body>, and addon-a11y scans `document.body`, so the open
//     dialog IS in scope — it is not silently skipped.
//   * While the dialog is open, react-aria marks everything outside the portal `aria-hidden`.
//     A focusable control left behind in the story root would then trip axe's
//     `aria-hidden-focus` rule. The always-open stories therefore render the dialog alone, and
//     the story that does need a trigger closes the dialog again before axe runs.
const meta = {
  title: "Dialog",
  component: Dialog,
  args: {
    title: "Delete project",
    description: "Every task, file and comment in this project is removed as well.",
    children: "This action cannot be undone.",
    defaultOpen: true,
  },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm", title: "Leave workspace" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg", title: "Review the changes before publishing" },
};

export const TopPlacement: Story = {
  args: { placement: "top", title: "Jump to a project" },
};

export const WithoutDescription: Story = {
  args: { description: undefined },
};

export const WithFooterActions: Story = {
  args: {
    footer: (
      <>
        <Button visual="subtle">Keep project</Button>
        <Button visual="danger">Delete project</Button>
      </>
    ),
  },
};

export const CustomCloseLabel: Story = {
  args: { closeLabel: "Not now" },
};

// A trigger has to live outside the dialog, so this one is controlled. Declared as a real
// component rather than an inline `render` arrow so the hook sits at a component top level.
function TriggeredDialog(props: DialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setIsOpen(true)}>Open dialog</Button>
      <Dialog {...props} isOpen={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}

// Exercises the full keyboard round trip: open, focus lands inside the dialog and stays trapped
// there across a Tab, then Escape closes it and the trigger is reachable again. `screen` (not
// `within(canvasElement)`) because the overlay is portalled out of the story root.
export const OpensTrapsFocusAndClosesOnEscape: Story = {
  args: { defaultOpen: undefined },
  render: (args) => <TriggeredDialog {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Open dialog" });

    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Delete project" });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await userEvent.tab();
    await expect(dialog.contains(document.activeElement)).toBe(true);

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await expect(trigger).toBeVisible();
  },
};
