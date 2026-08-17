import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@zevaui/components";

// Deliberately broken fixture for the a11y gate (see
// apps/storybook/scripts/assert-gate-fails.js). This Button renders an
// icon-only child with `aria-hidden="true"` and passes no `aria-label`, so
// its accessible-name computation is empty — axe's "button-name" rule (WCAG
// 4.1.2, part of the default ruleset) must flag it.
//
// `!test` removes the implicit `test` tag so the normal `pnpm turbo run
// test` run (and the Vitest addon's default `tags.include: ['test']`)
// never sees this story. `a11y-negative` is the tag the gate script uses to
// deliberately re-include it in one scoped, throwaway run.
const meta = {
  title: "Gate/BrokenA11y",
  component: Button,
  tags: ["a11y-negative", "!test"],
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const IconOnlyWithoutAccessibleName: Story = {
  args: {
    children: (
      <svg aria-hidden="true" focusable="false" width="16" height="16" viewBox="0 0 16 16">
        <path d="M2 8h12M8 2l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
};
