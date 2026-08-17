import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";

// Every story here has a real, non-empty accessible name (visible text
// content). This file is the positive counterpart to
// __gate__/BrokenA11y.stories.tsx: it must pass the a11y gate, not just
// exist.
const meta = {
  title: "Button",
  component: Button,
  args: {
    children: "Continue",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SolidSmall: Story = {
  args: { visual: "solid", size: "sm", children: "Solid small" },
};

export const SolidMedium: Story = {
  args: { visual: "solid", size: "md", children: "Solid medium" },
};

export const SolidLarge: Story = {
  args: { visual: "solid", size: "lg", children: "Solid large" },
};

export const SubtleSmall: Story = {
  args: { visual: "subtle", size: "sm", children: "Subtle small" },
};

export const SubtleMedium: Story = {
  args: { visual: "subtle", size: "md", children: "Subtle medium" },
};

export const SubtleLarge: Story = {
  args: { visual: "subtle", size: "lg", children: "Subtle large" },
};

export const DangerSmall: Story = {
  args: { visual: "danger", size: "sm", children: "Danger small" },
};

export const DangerMedium: Story = {
  args: { visual: "danger", size: "md", children: "Danger medium" },
};

export const DangerLarge: Story = {
  args: { visual: "danger", size: "lg", children: "Danger large" },
};

export const Disabled: Story = {
  args: { isDisabled: true, children: "Disabled button" },
};

// Tabs focus onto the button and asserts the focus-visible outline path
// (`&[data-focus-visible]` in button.recipe.ts) is reachable by keyboard,
// without giving up the accessible name.
export const Focused: Story = {
  args: { children: "Focus me" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Focus me" });

    await userEvent.tab();

    await expect(button).toHaveFocus();
  },
};
