import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "@zevaui/components";

// Every story here has real, non-empty visible text content. This file is the positive
// counterpart to __gate__/BrokenA11y.stories.tsx: it must pass the a11y gate, not just exist.
//
// AND THAT IS A HARDER CLAIM FOR BADGE THAN FOR ALERT. A badge has no role and announces
// nothing, so its tone reaches a sighted user and nobody else — the whole meaning has to survive
// in the text. Every story below therefore names its state in words ("Overdue", "Passing"), and
// none of them ships a badge whose content is a bare dot or a colour with no label. That is WCAG
// 1.4.1, and it is a story-level obligation because no gate can read intent out of a string.
const meta = {
  title: "Badge",
  component: Badge,
  tags: ["visual"],
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Neutral: Story = {
  args: { children: "Draft" },
};

export const Accent: Story = {
  args: { tone: "accent", children: "Beta" },
};

export const Danger: Story = {
  args: { tone: "danger", children: "Overdue" },
};

export const Success: Story = {
  args: { tone: "success", children: "Passing" },
};

export const Warning: Story = {
  args: { tone: "warning", children: "Deprecated" },
};

// The baseline that would catch a padding or line-height regression the single-badge shots
// cannot: a badge's height comes from its own type, not from the line it sits on, so a row of
// them has to align with each other and with the sentence around them.
export const InARow: Story = {
  args: { children: "Draft" },
  render: () => (
    <p>
      Release <Badge tone="accent">Beta</Badge> <Badge tone="success">Passing</Badge>{" "}
      <Badge tone="warning">Deprecated</Badge> — shipping Friday.
    </p>
  ),
};

// A count is the shortest content a badge ever holds, and the case where `paddingInline` on its
// own decides whether the chip reads as a pill or as a cramped square.
export const Count: Story = {
  args: { tone: "danger", children: "3" },
};

// No baseline: nothing here is a new pixel arrangement, only a long label proving the chip grows
// with its text instead of clipping it. `white-space: nowrap` is the declaration under test.
export const LongLabel: Story = {
  tags: ["!visual"],
  args: { tone: "neutral", children: "Waiting on upstream review" },
};
