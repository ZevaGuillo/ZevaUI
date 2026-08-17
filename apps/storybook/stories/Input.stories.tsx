import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";

// Every story here carries a real programmatic label, so the whole file must pass the blocking
// a11y gate — including axe's color-contrast rule, which only executes in browser mode
// (ADR-0004 D7). That makes this file the first place the Input palette is checked against real
// rendered pixels rather than against the token contract alone.
const meta = {
  title: "Input",
  component: Input,
  args: {
    label: "Email",
  },
} satisfies Meta<typeof Input>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm", label: "Email (small)" },
};

export const Medium: Story = {
  args: { size: "md", label: "Email (medium)" },
};

export const Large: Story = {
  args: { size: "lg", label: "Email (large)" },
};

export const WithDescription: Story = {
  args: {
    label: "Email",
    description: "We only use this to send receipts.",
  },
};

export const Required: Story = {
  args: { label: "Email", isRequired: true },
};

export const Disabled: Story = {
  args: { label: "Email", isDisabled: true },
};

export const ReadOnly: Story = {
  args: { label: "Email", isReadOnly: true, value: "someone@example.com" },
};

export const Password: Story = {
  args: { label: "Password", type: "password" },
};

// The error state is not conveyed by the red border alone: FieldError renders real text and RAC
// wires it through aria-describedby, so the state survives for a user who cannot perceive the
// colour change. This story exists to keep that true under axe.
export const Invalid: Story = {
  args: {
    label: "Email",
    isInvalid: true,
    errorMessage: "Enter a valid email address.",
  },
};

export const InvalidWithDescription: Story = {
  args: {
    label: "Email",
    description: "We only use this to send receipts.",
    isInvalid: true,
    errorMessage: "Enter a valid email address.",
  },
};

// Tabs onto the field and asserts the `&[data-focus-visible]` outline path in input.recipe.ts is
// reachable by keyboard, without giving up the accessible name.
export const Focused: Story = {
  args: { label: "Email" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Email" });

    await userEvent.tab();

    await expect(input).toHaveFocus();
    await expect(input).toHaveAttribute("data-focus-visible", "true");
  },
};

// Proves the error text is announced, not merely painted: the message must be reachable through
// the input's own aria-describedby chain.
export const InvalidIsAnnounced: Story = {
  args: {
    label: "Email",
    isInvalid: true,
    errorMessage: "Enter a valid email address.",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Email" });

    await expect(input).toHaveAttribute("aria-invalid", "true");

    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const announced = describedBy
      .split(/\s+/)
      .filter(Boolean)
      .map((id) => canvasElement.ownerDocument.getElementById(id)?.textContent)
      .join(" ");

    await expect(announced).toContain("Enter a valid email address.");
  },
};

export const TypingIsReported: Story = {
  args: { label: "Email" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Email" });

    await userEvent.type(input, "hello");

    await expect(input).toHaveValue("hello");
  },
};
