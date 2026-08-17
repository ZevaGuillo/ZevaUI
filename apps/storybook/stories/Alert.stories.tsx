import type { Meta, StoryObj } from "@storybook/react-vite";
import { Alert } from "@zevaui/components";

// Every story here has real, non-empty visible text content. This file is the positive
// counterpart to __gate__/BrokenA11y.stories.tsx: it must pass the a11y gate, not just exist.
const meta = {
  title: "Alert",
  component: Alert,
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Danger: Story = {
  args: { tone: "danger", children: "Something went wrong while saving your changes." },
};

export const Success: Story = {
  args: { tone: "success", children: "Your changes have been saved." },
};

export const Warning: Story = {
  args: { tone: "warning", children: "This action cannot be undone." },
};
