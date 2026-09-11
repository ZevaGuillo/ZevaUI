import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";

// Every story here carries a real programmatic label, so the whole file must pass the blocking
// a11y gate — including axe's color-contrast rule, which only executes in browser mode
// (ADR-0004 D7). Textarea reuses Input's palette token for token, so what this file adds over
// Input.stories.tsx is the multi-line box: the `resize` axis, `rows`, and a value that wraps.
const meta = {
  title: "Textarea",
  component: Textarea,
  tags: ["visual"],
  args: {
    label: "Bio",
  },
} satisfies Meta<typeof Textarea>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm", label: "Bio (small)" },
};

export const Medium: Story = {
  args: { size: "md", label: "Bio (medium)" },
};

export const Large: Story = {
  args: { size: "lg", label: "Bio (large)" },
};

// `rows` is the initial height, and the only reason the three size stories above do not already
// cover the box: padding scales with `size`, line count does not.
export const ManyRows: Story = {
  args: { label: "Bio", rows: 8 },
};

// The axis exists because `className` is `never` and the browser default is `resize: both`. This
// story is the visual proof that `none` reaches the stylesheet — the resize grabber disappears
// from the bottom-right corner.
export const ResizeNone: Story = {
  args: { label: "Bio", resize: "none", rows: 4 },
};

// Text long enough to wrap across lines, which is the one rendering behaviour an Input can never
// exercise.
export const WithLongValue: Story = {
  args: {
    label: "Bio",
    rows: 4,
    value:
      "I maintain a design system, which mostly means arguing about whether a component earns its place before writing a single line of it.",
    onChange: () => {},
  },
};

export const WithDescription: Story = {
  args: {
    label: "Bio",
    description: "Max 200 characters. Markdown is not supported.",
  },
};

export const Required: Story = {
  args: { label: "Bio", isRequired: true },
};

export const Disabled: Story = {
  args: { label: "Bio", isDisabled: true },
};

export const ReadOnly: Story = {
  args: { label: "Bio", isReadOnly: true, value: "Nothing to declare.", onChange: () => {} },
};

// The error state is not conveyed by the red border alone: FieldError renders real text and RAC
// wires it through aria-describedby, so the state survives for a user who cannot perceive the
// colour change. This story exists to keep that true under axe.
export const Invalid: Story = {
  args: {
    label: "Bio",
    isInvalid: true,
    errorMessage: "Tell us a little about yourself.",
  },
};

export const InvalidWithDescription: Story = {
  args: {
    label: "Bio",
    description: "Max 200 characters. Markdown is not supported.",
    isInvalid: true,
    errorMessage: "Tell us a little about yourself.",
  },
};

// Tabs onto the field and asserts the `&[data-focus-visible]` outline path in textarea.recipe.ts
// is reachable by keyboard, without giving up the accessible name.
export const Focused: Story = {
  tags: ["!visual"],
  args: { label: "Bio" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Bio" });

    await userEvent.tab();

    await expect(field).toHaveFocus();
    await expect(field).toHaveAttribute("data-focus-visible", "true");
  },
};

// Proves the error text is announced, not merely painted: the message must be reachable through
// the textarea's own aria-describedby chain.
export const InvalidIsAnnounced: Story = {
  tags: ["!visual"],
  args: {
    label: "Bio",
    isInvalid: true,
    errorMessage: "Tell us a little about yourself.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Bio" });

    await expect(field).toHaveAttribute("aria-invalid", "true");

    const describedBy = field.getAttribute("aria-describedby") ?? "";
    const announced = describedBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => canvasElement.ownerDocument.getElementById(id)?.textContent)
      .join(" ");

    await expect(announced).toContain("Tell us a little about yourself.");
  },
};

// The bug the review caught on this component, pinned where it actually shows: in a browser,
// against the painted border.
//
// `[data-hovered]:not([data-disabled])` scores (0,3,0) and `[data-invalid]` scores (0,2,0),
// because a `:not()` argument carries its own specificity weight. Without the third `:not()`
// clause in textarea.recipe.ts the hover tint outranks the invalid border in any source order,
// and an invalid field turns from red back to accent the moment the pointer touches it.
//
// `assertHoverDoesNotOutrankInvalid` from ./support/markable-control.js is NOT reused here: it
// resolves the styled part through `closest("label")`, which only exists for a markable control.
// A textarea IS its own styled part, so the lookup is a plain role query.
//
// Asserted by comparing two rendered controls rather than against a colour literal: the tokens
// differ per theme, so any hard-coded expectation would be wrong in two of the three theme runs.
export const HoveringAnInvalidTextareaKeepsItRed: Story = {
  tags: ["!visual"],
  render: () => (
    <>
      <Textarea label="Invalid, will be hovered" isInvalid />
      <Textarea label="Invalid, left alone" isInvalid />
      <Textarea label="Valid, will be hovered" />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const fieldNamed = (name: string) => canvas.getByRole("textbox", { name });

    const hoveredInvalid = fieldNamed("Invalid, will be hovered");
    const restingInvalid = fieldNamed("Invalid, left alone");
    const hoveredValid = fieldNamed("Valid, will be hovered");

    hoveredInvalid.dataset.hovered = "true";
    hoveredValid.dataset.hovered = "true";

    await expect(restingInvalid).not.toHaveAttribute("data-hovered");

    const borderOf = (element: HTMLElement) => getComputedStyle(element).borderColor;

    await expect(borderOf(hoveredInvalid)).toBe(borderOf(restingInvalid));
    await expect(borderOf(hoveredInvalid)).not.toBe(borderOf(hoveredValid));
  },
};

// The multi-line half of the contract, in a real browser rather than jsdom: Enter has to insert a
// newline into the value instead of submitting or being swallowed.
export const NewlinesSurvive: Story = {
  tags: ["!visual"],
  args: { label: "Bio" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Bio" });

    await userEvent.type(field, "first{Enter}second");

    await expect(field).toHaveValue("first\nsecond");
  },
};
