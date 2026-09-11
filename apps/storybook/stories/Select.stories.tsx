import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "@zevaui/components";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

// Every story here carries a real programmatic label, so the whole file must pass the blocking
// a11y gate configured in .storybook/preview.ts (`a11y: { test: "error" }`), run in real Chromium
// — including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7).
//
// The trigger stays in the story root, visible and focusable, while the list is open. That is the
// same arrangement Menu.stories.tsx argues for and the reason carries over unchanged: `usePopover`
// in the installed react-aria hides outside content with `ariaHideOutside(targets,
// { shouldUseInert: true })`, which sets the `inert` PROPERTY rather than `aria-hidden="true"`
// wherever the browser supports it, so `aria-hidden-focus` has nothing to fire on. Dialog's
// workaround belongs to `useModalOverlay`, a different code path. `OpensNavigatesAndSelects`
// asserts the inert/aria-hidden pair explicitly, so a future react-aria that drops the inert
// branch fails here with a readable reason instead of as an opaque axe violation.
const OPTIONS = [
  { value: "free", label: "Free", description: "One project, community support." },
  { value: "pro", label: "Pro", description: "Unlimited projects and priority support." },
  { value: "team", label: "Team", description: "Everything in Pro, plus shared billing." },
  { value: "legacy", label: "Legacy", description: "No longer sold.", isDisabled: true },
];

const meta = {
  title: "Select",
  component: Select,
  tags: ["visual"],
  args: {
    label: "Billing plan",
    options: OPTIONS,
    defaultOpen: true,
    onChange: fn(),
  },
} satisfies Meta<typeof Select>;

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

// The resting field, which is the only view that exists for most of this control's life and the
// one that has to line up with an Input in the same form.
export const Closed: Story = {
  args: { defaultOpen: false },
};

export const WithPlaceholder: Story = {
  args: { defaultOpen: false, placeholder: "Choose a plan" },
};

// The chosen option's text on the closed trigger IS the primary carrier of the selection — the
// list's tint is redundant to it, which is the argument select.recipe.ts makes for WCAG 1.4.1.
// This story is that claim rendered.
export const WithValue: Story = {
  args: { defaultOpen: false, defaultValue: "pro" },
};

// The selected row inside the open list: `[data-selected]` paints `bg.muted`, distinct from both
// the resting row and the hover tint.
export const SelectedInList: Story = {
  args: { defaultValue: "pro" },
};

// Options carry no supporting copy here, which is the shape most selects actually have. It exists
// because the row's vertical rhythm is entirely different without a second line.
export const WithoutDescriptions: Story = {
  args: {
    label: "Sort by",
    options: [
      { value: "name", label: "Name" },
      { value: "updated", label: "Last updated" },
      { value: "size", label: "Size" },
    ],
  },
};

export const WithDescription: Story = {
  args: {
    defaultOpen: false,
    description: "You can change this at any time.",
  },
};

export const Required: Story = {
  args: { defaultOpen: false, isRequired: true },
};

export const Disabled: Story = {
  args: { defaultOpen: false, isDisabled: true, defaultValue: "free" },
};

// The error state is not conveyed by the red border alone: FieldError renders real text and RAC
// wires it into the trigger's aria-describedby, so the state survives for a user who cannot
// perceive the colour change. This story keeps that true under axe.
export const Invalid: Story = {
  args: {
    defaultOpen: false,
    isInvalid: true,
    errorMessage: "Pick a plan to continue.",
  },
};

export const InvalidWithDescription: Story = {
  args: {
    defaultOpen: false,
    description: "You can change this at any time.",
    isInvalid: true,
    errorMessage: "Pick a plan to continue.",
  },
};

// A value longer than the trigger, which is the one case that decides whether the chevron stays
// inside the box. The value truncates; the affordance does not move.
export const LongValueTruncates: Story = {
  args: {
    defaultOpen: false,
    label: "Deployment target",
    options: [
      {
        value: "long",
        label: "production-eu-west-1 (primary, blue/green, manual approval required)",
      },
      { value: "short", label: "staging" },
    ],
    defaultValue: "long",
  },
};

// ---------------------------------------------------------------- interaction only

// Tabs onto the trigger and asserts the `&[data-focus-visible]` outline path in select.recipe.ts
// is reachable by keyboard, without giving up the accessible name.
export const Focused: Story = {
  tags: ["!visual"],
  args: { defaultOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Billing plan/ });

    await userEvent.tab();

    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveAttribute("data-focus-visible", "true");
  },
};

// The full keyboard round trip against the real component: the trigger opens the list, arrow keys
// walk the rows stepping over the disabled one, Enter chooses, the list closes and focus returns
// to the trigger, which now shows the chosen label. `screen` (not `within(canvasElement)`) for
// anything inside the popover, because it is portalled out of the story root.
export const OpensNavigatesAndSelects: Story = {
  tags: ["!visual"],
  args: { defaultOpen: false },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Billing plan/ });

    await userEvent.click(trigger);
    await screen.findByRole("listbox");

    // The measured reason the trigger may stay in the story root while axe scans — see the file
    // header. Asserted here so a react-aria that switches back to `aria-hidden` fails with this
    // message rather than as a bare axe violation.
    await expect(canvasElement).toHaveProperty("inert", true);
    await expect(canvasElement).not.toHaveAttribute("aria-hidden");

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("option", { name: "Free" })).toHaveFocus());

    await userEvent.keyboard("{ArrowDown}");
    await waitFor(() => expect(screen.getByRole("option", { name: "Pro" })).toHaveFocus());

    // "Legacy" is disabled, so walking to the end of the list must stop on "Team" and never land
    // on it. This is the assertion that decides whether `ListBoxItem`'s own `isDisabled` is enough
    // inside a Select — RAC gives `SelectProps` no collection-level `disabledKeys` to fall back on,
    // unlike Menu.
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(screen.getByRole("option", { name: "Team" })).toHaveFocus());

    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await expect(args.onChange).toHaveBeenCalledWith("team");
    await expect(trigger).toHaveFocus();
    await expect(trigger).toHaveTextContent("Team");
    // ...and the page is handed back: closing the list must undo the inert marking, or the story
    // root would stay unreachable for good.
    await waitFor(() => expect(canvasElement).toHaveProperty("inert", false));
  },
};

// `[data-open]` is stamped onto the chevron by Select.tsx off the root's render prop, precisely so
// the rotation can be a LOCAL `&[data-open]` rule instead of an ancestor-conditioned selector that
// any `[data-open]` ancestor would trigger. This story proves the stamp reaches the DOM and comes
// back off, which no unit test in jsdom can show through a real transform.
export const ChevronRotatesWhenOpen: Story = {
  tags: ["!visual"],
  args: { defaultOpen: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Billing plan/ });
    const chevron = trigger.lastElementChild as HTMLElement;

    const restingTransform = getComputedStyle(chevron).transform;
    await expect(chevron).not.toHaveAttribute("data-open");

    await userEvent.click(trigger);
    await screen.findByRole("listbox");

    await waitFor(() => expect(chevron).toHaveAttribute("data-open", "true"));
    await waitFor(() => expect(getComputedStyle(chevron).transform).not.toBe(restingTransform));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(chevron).not.toHaveAttribute("data-open"));
  },
};

// Proves the error text is announced, not merely painted: the message must be reachable through
// the trigger's own aria-describedby chain. It also pins the gap — RAC emits no `aria-invalid`
// anywhere for a Select and its Button drops one passed in, so this control announces strictly
// less than Input and Textarea do. The day RAC closes it, this story goes red and says so.
export const InvalidIsAnnouncedWithoutAriaInvalid: Story = {
  tags: ["!visual"],
  args: {
    defaultOpen: false,
    isInvalid: true,
    errorMessage: "Pick a plan to continue.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /Billing plan/ });

    await expect(trigger).toHaveAttribute("data-invalid", "true");
    await expect(canvasElement.querySelector("[aria-invalid]")).toBeNull();

    const describedBy = trigger.getAttribute("aria-describedby") ?? "";
    const announced = describedBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => canvasElement.ownerDocument.getElementById(id)?.textContent)
      .join(" ");

    await expect(announced).toContain("Pick a plan to continue.");
  },
};

// The specificity trap, pinned where it actually shows: in a browser, against the painted border.
//
// `[data-hovered]:not([data-disabled])` scores (0,3,0) and `[data-invalid]` scores (0,2,0),
// because a `:not()` argument carries its own specificity weight. Without the third `:not()`
// clause in select.recipe.ts the hover tint outranks the invalid border in any source order, and
// an invalid select turns from red back to accent the moment the pointer touches it.
//
// Asserted by comparing three rendered controls rather than against a colour literal: the tokens
// differ per theme, so any hard-coded expectation would be wrong in two of the three theme runs.
export const HoveringAnInvalidSelectKeepsItRed: Story = {
  tags: ["!visual"],
  args: { defaultOpen: false },
  render: (args) => (
    <>
      <Select {...args} label="Invalid, will be hovered" isInvalid />
      <Select {...args} label="Invalid, left alone" isInvalid />
      <Select {...args} label="Valid, will be hovered" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const triggerNamed = (name: string) => canvas.getByRole("button", { name: new RegExp(name) });

    const hoveredInvalid = triggerNamed("Invalid, will be hovered");
    const restingInvalid = triggerNamed("Invalid, left alone");
    const hoveredValid = triggerNamed("Valid, will be hovered");

    hoveredInvalid.dataset.hovered = "true";
    hoveredValid.dataset.hovered = "true";

    await expect(restingInvalid).not.toHaveAttribute("data-hovered");

    const borderOf = (element: HTMLElement) => getComputedStyle(element).borderColor;

    await expect(borderOf(hoveredInvalid)).toBe(borderOf(restingInvalid));
    await expect(borderOf(hoveredInvalid)).not.toBe(borderOf(hoveredValid));
  },
};

// The same trap one level down, on the rows. `&[data-hovered]:not([data-disabled])` is (0,3,0)
// against `&[data-selected]`'s (0,2,0), so without the `:not([data-selected])` guard the chosen
// row would lose its tint under the pointer — the one row the user is checking.
export const HoveringTheSelectedRowKeepsItsTint: Story = {
  tags: ["!visual"],
  args: { defaultValue: "pro" },
  play: async () => {
    await screen.findByRole("listbox");

    const selected = screen.getByRole("option", { name: "Pro" });
    const unselected = screen.getByRole("option", { name: "Free" });

    const restingSelectedBackground = getComputedStyle(selected).backgroundColor;

    selected.dataset.hovered = "true";
    unselected.dataset.hovered = "true";

    await expect(getComputedStyle(selected).backgroundColor).toBe(restingSelectedBackground);
    await expect(getComputedStyle(selected).backgroundColor).not.toBe(
      getComputedStyle(unselected).backgroundColor,
    );
  },
};
