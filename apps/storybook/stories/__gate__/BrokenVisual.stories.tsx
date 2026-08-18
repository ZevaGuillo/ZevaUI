import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@zevaui/components";

// The Vite `define` below (see vitest.visual-gate.config.ts) lets this one
// story render two different labels across separate vitest invocations —
// see scripts/assert-visual-gate-fails.js — instead of needing two
// near-duplicate stories.
declare const __VISUAL_GATE_LABEL__: string;

// Deliberately broken fixture for the visual gate (see
// apps/storybook/scripts/assert-visual-gate-fails.js). Seeds a screenshot
// baseline under one label, then re-renders under a different label; the
// captured screenshot MUST fail its comparison.
//
// `!test` removes the implicit `test` tag, exactly `BrokenA11y.stories.tsx`'s
// opt-out mechanism, so this story never runs through the normal `pnpm turbo
// run test`. `!visual` keeps it out of the real `vitest.visual.config.ts`
// sweep even though it never carries the `visual` tag in the first place —
// the same defensive, opt-out-twice pattern. `visual-negative` is the tag
// vitest.visual-gate.config.ts scopes its own run to.
const meta = {
  title: "Gate/BrokenVisual",
  component: Button,
  tags: ["visual-negative", "!test", "!visual"],
  args: {
    children: __VISUAL_GATE_LABEL__,
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SimpleLabel: Story = {};
