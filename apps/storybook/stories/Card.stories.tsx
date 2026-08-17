import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card } from "@zevaui/components";

// Every story here has real, non-empty content in every slot. This file is the positive
// counterpart to __gate__/BrokenA11y.stories.tsx: it must pass the a11y gate, not just exist.
//
// `args.children` only satisfies `CardProps` at the type level: every story below builds its
// actual content through `render`, composing `Card.Header` / `Card.Body` / `Card.Footer`, which
// is how a consumer actually uses Card.
const meta = {
  title: "Card",
  component: Card,
  args: {
    children: "Card content",
  },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Elevated: Story = {
  render: () => (
    <Card surface="elevated">
      <Card.Header>Project overview</Card.Header>
      <Card.Body>Track progress across every workstream in one place.</Card.Body>
      <Card.Footer>Updated 2 hours ago</Card.Footer>
    </Card>
  ),
};

export const Outlined: Story = {
  render: () => (
    <Card surface="outlined">
      <Card.Header>Project overview</Card.Header>
      <Card.Body>Track progress across every workstream in one place.</Card.Body>
      <Card.Footer>Updated 2 hours ago</Card.Footer>
    </Card>
  ),
};
