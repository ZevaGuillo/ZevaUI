import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Link, Tooltip } from "@zevaui/components";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

// A tooltip is only in the DOM while its trigger is hovered or focused, so unlike Menu these
// stories cannot open themselves through a `defaultOpen` arg — there is no such prop, and adding
// one would be adding API that exists only for screenshots. Every visual story therefore drives
// the trigger in a `play` function first and leaves the bubble up while the capture runs.
//
// EVERY TRIGGER HERE CARRIES ITS OWN ACCESSIBLE NAME, and that is the rule these stories exist to
// demonstrate as much as the pixels. react-aria wires the bubble to `aria-describedby`, never to
// the name, and a tooltip does not exist at all on touch — so `IconOnlyTrigger` below spells out
// what an icon button still owes.
const meta = {
  title: "Tooltip",
  component: Tooltip,
  tags: ["visual"],
  args: {
    content: "Moves the project out of your active list",
    delay: 0,
  },
} satisfies Meta<typeof Tooltip>;

export default meta;

type Story = StoryObj<typeof meta>;

// Focus rather than hover: `userEvent.tab()` produces the keyboard focus react-aria shows a
// tooltip for immediately, with no warmup to wait out and no pointer position to keep steady
// while the screenshot is taken.
const showTooltip = async () => {
  await userEvent.tab();
  await screen.findByRole("tooltip");
};

export const Default: Story = {
  args: { children: <Button>Archive</Button> },
  play: showTooltip,
};

export const Top: Story = {
  args: { placement: "top", children: <Button>Archive</Button> },
  play: showTooltip,
};

export const End: Story = {
  args: { placement: "end", children: <Button>Archive</Button> },
  play: showTooltip,
};

// The bubble's `max-width` doing its job: a tooltip that grew to the viewport would be a
// paragraph, and a paragraph is not what a tooltip is for.
export const LongContent: Story = {
  args: {
    content:
      "Archiving keeps every task, file and comment, but removes the project from search and from your sidebar until you restore it.",
    children: <Button>Archive</Button>,
  },
  play: showTooltip,
};

// A tooltip works on any focusable control this package ships, not only on buttons.
export const OnALink: Story = {
  args: {
    content: "Opens the full changelog",
    children: <Link href="/changelog">What's new</Link>,
  },
  play: showTooltip,
};

/**
 * THE STORY THAT DOCUMENTS THE OBLIGATION, and the reason it carries a real `aria-label`.
 *
 * The tooltip is the trigger's DESCRIPTION, never its name. A description is announced after the
 * name, many screen-reader configurations suppress descriptions entirely, and a tooltip does not
 * exist on touch — there is no hover, and a tap activates the control instead of revealing the
 * bubble. An icon-only button whose only label lived in its tooltip would announce as "button" and
 * would be unlabelled on every phone.
 *
 * So the button below names itself, and the tooltip expands on that name rather than supplying it.
 * The `play` function asserts the pair, which is what makes this a gate rather than an example.
 */
export const IconOnlyTrigger: Story = {
  args: {
    content: "Archive this project",
    children: (
      <Button aria-label="Archive">
        <span aria-hidden="true">🗄️</span>
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Archive" });

    await userEvent.tab();
    const bubble = await screen.findByRole("tooltip");

    // Described by the bubble...
    await expect(button).toHaveAttribute("aria-describedby", bubble.id);
    // ...and named by itself. If react-aria ever started contributing to the name, this fails here
    // rather than silently making every icon button in every consumer app look labelled.
    await expect(button).toHaveAttribute("aria-label", "Archive");
  },
};

// No baseline: nothing new is drawn. What this proves is the full lifecycle — the bubble appears
// on focus and is taken back out of the DOM when focus leaves, rather than lingering invisibly
// where a linear reader would still meet it.
export const AppearsAndLeaves: Story = {
  tags: ["!visual"],
  args: { children: <Button>Archive</Button> },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("tooltip")).toBeNull();

    await userEvent.tab();
    await screen.findByRole("tooltip");

    await userEvent.tab();
    await waitFor(async () => {
      await expect(screen.queryByRole("tooltip")).toBeNull();
    });
  },
};

// No baseline: the point is the absence. `isDisabled` suppresses the bubble without unmounting
// the trigger, so a control whose explanation is only sometimes relevant keeps its focus.
export const Disabled: Story = {
  tags: ["!visual"],
  args: { isDisabled: true, children: <Button>Archive</Button> },
  play: async () => {
    await userEvent.tab();
    await expect(screen.queryByRole("tooltip")).toBeNull();
  },
};
