import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Popover, Separator } from "@zevaui/components";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

// These stories open the popover through `defaultOpen` and leave the trigger on screen while axe
// scans, exactly as `Menu.stories.tsx` does — and for the reason measured there rather than a new
// one. `usePopover` in react-aria 3.51.0 hides outside content with
// `ariaHideOutside(targets, { shouldUseInert: true })`, which sets the `inert` PROPERTY instead of
// `aria-hidden="true"` wherever the browser supports it, so axe's `aria-hidden-focus` rule has
// nothing to fire on. `Dialog`, which goes through `useModalOverlay`, is the code path that does
// need its stories arranged around the question.
//
// `OpensAndDismisses` asserts the inert pair explicitly, so a future react-aria that drops the
// inert branch goes red here with a readable reason instead of as an opaque axe violation.
const meta = {
  title: "Popover",
  component: Popover,
  tags: ["visual"],
  args: {
    label: "Filters",
    title: "Filter by status",
    children: "Only issues that are still open are shown in this view.",
    defaultOpen: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Popover>;

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

export const Top: Story = {
  args: { placement: "top" },
};

// The body is an unrestricted `ReactNode`, which is the half a popover genuinely needs: a filter
// panel holds controls, not a sentence. The title stays a plain string, which is the half that has
// to stay predictable — it is the panel's accessible name.
export const WithContent: Story = {
  args: {
    label: "Account",
    title: "Signed in as Ana",
    size: "sm",
    children: (
      <>
        <span>ana@example.com</span>
        <Separator decorative />
        <Button visual="subtle" size="sm" width="full">
          Sign out
        </Button>
      </>
    ),
  },
};

// The trigger's words and the panel's name are two different strings, and this story is where that
// is most obviously right: the button says what pressing it does, the heading says what the panel
// is. `Menu` needs only one label because react-aria names a `role="menu"` from its trigger; a
// `role="dialog"` is named by its own heading instead.
export const TriggerAndTitleDiffer: Story = {
  args: {
    label: "Change plan",
    title: "Plans and billing",
  },
};

export const Closed: Story = {
  args: { defaultOpen: false },
};

export const DisabledTrigger: Story = {
  args: { defaultOpen: false, isDisabled: true },
};

// The full round trip against the real component: the trigger opens the panel, the panel is named
// by its own heading, Escape dismisses it, and focus lands back on the trigger. `screen` (not
// `within(canvasElement)`) for anything inside the panel, because it is portalled out of the story
// root.
export const OpensAndDismisses: Story = {
  tags: ["!visual"],
  args: { defaultOpen: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Filters" });

    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Filter by status" });

    // Non-modal: the panel never claims `aria-modal`, because the page behind it really does stay
    // available. This is the assertion that separates Popover from Dialog.
    await expect(dialog).not.toHaveAttribute("aria-modal");

    // The measured reason the trigger may stay in the story root while axe scans — react-aria
    // takes outside content out of the tree with `inert`, never `aria-hidden`.
    await expect(canvasElement).toHaveProperty("inert", true);
    await expect(canvasElement).not.toHaveAttribute("aria-hidden");

    await userEvent.keyboard("{Escape}");

    await waitFor(async () => {
      await expect(screen.queryByRole("dialog")).toBeNull();
    });
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
    await expect(trigger).toHaveFocus();
    // ...and the page is handed back: closing must undo the inert marking, or the story root would
    // stay unreachable for good.
    await waitFor(async () => {
      await expect(canvasElement).toHaveProperty("inert", false);
    });
  },
};

// No baseline: the point is that clicking away closes it, which is the behaviour that makes this
// non-modal rather than a `Dialog` in a smaller box.
export const DismissesOnOutsideClick: Story = {
  tags: ["!visual"],
  args: { defaultOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog");

    await userEvent.click(document.body);

    await waitFor(async () => {
      await expect(screen.queryByRole("dialog")).toBeNull();
    });
  },
};
