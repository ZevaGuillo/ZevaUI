import type { Meta, StoryObj } from "@storybook/react-vite";
import { Checkbox } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";
import { assertHoverDoesNotOutrankInvalid } from "./support/markable-control.js";

// Every story here carries a real label, so the whole file must pass the blocking a11y gate —
// including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7). For a
// markable control that gate is doing more work than it does for Input: the check glyph is
// `text.inverse` painted on an `accent.default` fill, a pairing no other component exercises.
const meta = {
  title: "Checkbox",
  component: Checkbox,
  tags: ["visual"],
  args: {
    children: "Accept the terms",
  },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm", children: "Accept the terms (small)" },
};

export const Medium: Story = {
  args: { size: "md", children: "Accept the terms (medium)" },
};

export const Large: Story = {
  args: { size: "lg", children: "Accept the terms (large)" },
};

export const Selected: Story = {
  args: { isSelected: true, onChange: () => {} },
};

// The third state gets its own story rather than riding along as an arg, because it is the one
// appearance a screenshot diff would otherwise never cover: dash instead of tick, on the same
// fill as selected.
export const Indeterminate: Story = {
  args: { isIndeterminate: true, children: "Select all" },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

export const DisabledSelected: Story = {
  args: { isDisabled: true, isSelected: true, onChange: () => {} },
};

export const ReadOnly: Story = {
  args: { isReadOnly: true, isSelected: true, onChange: () => {} },
};

export const Required: Story = {
  args: { isRequired: true },
};

// The invalid state is not conveyed by the red box alone: RAC sets aria-invalid on the real
// input, so the state survives for a user who cannot perceive the colour change. This story
// exists to keep that true under axe.
export const Invalid: Story = {
  args: { isInvalid: true },
};

export const InvalidSelected: Story = {
  args: { isInvalid: true, isSelected: true, onChange: () => {} },
};

// A label long enough to wrap, which is the case that catches a box laid out as an ordinary flex
// item: without `flex: none` the box shrinks to the leftover width and stops being square.
export const WrappingLabel: Story = {
  tags: ["!visual"],
  args: {
    children:
      "I agree to the terms of service, the privacy policy, and every other document nobody reads before ticking this box",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const box = canvasElement.querySelector(".zui-checkbox__control") as HTMLElement;
    const { width, height } = box.getBoundingClientRect();

    // Asserted on the RENDERED box, not on the emitted `flex: none` declaration: the declaration
    // is the input, the laid-out box is what a user sees, and only the second one is evidence.
    // Rounded because sub-pixel layout differs across engines and the squareness is the claim.
    expect(Math.round(width)).toBe(Math.round(height));
    expect(width).toBeGreaterThan(0);
    // The label really did wrap, so the assertion above was not vacuous.
    const label = canvas.getByText(/I agree to the terms/);
    expect(label.getBoundingClientRect().height).toBeGreaterThan(height);
  },
};

// The bug the review caught, pinned where it actually shows: in a browser, with a real pointer,
// against the painted border.
//
// `[data-hovered]:not([data-disabled])` scores (0,3,0) and `[data-invalid]` scores (0,2,0),
// because a `:not()` argument carries its own specificity weight. So the hover tint outranked
// the invalid border no matter the source order, and an invalid checkbox turned from red back to
// accent the moment the pointer touched it — the one moment the user is looking straight at it.
//
// Asserted by comparing two rendered controls rather than against a colour literal: the tokens
// differ per theme, so any hard-coded expectation would be wrong in two of the three theme runs.
// Hovered-invalid must match unhovered-invalid, and must NOT match hovered-valid.
export const HoveringAnInvalidCheckboxKeepsItRed: Story = {
  tags: ["!visual"],
  render: () => (
    <>
      <Checkbox isInvalid>Invalid, will be hovered</Checkbox>
      <Checkbox isInvalid>Invalid, left alone</Checkbox>
      <Checkbox>Valid, will be hovered</Checkbox>
    </>
  ),
  play: async ({ canvasElement }) => {
    assertHoverDoesNotOutrankInvalid(canvasElement, "checkbox", ".zui-checkbox__control", {
      hoveredInvalid: "Invalid, will be hovered",
      restingInvalid: "Invalid, left alone",
      hoveredValid: "Valid, will be hovered",
    });
  },
};

// Clicking the TEXT must toggle the control, which is the whole reason the root is a real
// `<label>` with the input associated to it rather than a div with a click handler.
export const ClickingTheLabelToggles: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const checkbox = canvas.getByRole("checkbox", { name: "Accept the terms" });

    expect(checkbox).not.toBeChecked();
    await userEvent.click(canvas.getByText("Accept the terms"));
    expect(checkbox).toBeChecked();
  },
};
