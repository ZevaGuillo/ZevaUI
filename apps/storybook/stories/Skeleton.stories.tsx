import type { Meta, StoryObj } from "@storybook/react-vite";
import { Skeleton } from "@zevaui/components";

// Skeleton is the first component in this file set that renders NO text at all, which changes
// what the blocking a11y gate can and cannot say about it. Axe's `color-contrast` rule has
// nothing to measure here — there are no glyphs — so what these stories are really evidence for
// is the other half: that an `aria-hidden` placeholder introduces no announcement of its own, in
// all three themes.
//
// THE CALLER CONTRACT IS DEMONSTRATED, NOT JUST DOCUMENTED. Skeleton.tsx hides every placeholder
// from assistive technology on purpose (a shape has nothing to read, and a list of eight rows
// would otherwise announce two dozen times), which moves the obligation onto the region that is
// waiting: it carries `aria-busy="true"`, once. Every composed story below does exactly that, so
// the correct usage is the thing a reader copies.
//
// These stories are SAFE to screenshot even though the placeholder pulses, and that is not luck:
// the Playwright context in vitest.shared.ts pins `reducedMotion: "reduce"` for every capture,
// and skeleton.recipe.ts cancels the pulse under exactly that media query — parked at the BRIGHT
// end, so a baseline never catches a half-faded frame.
const meta = {
  title: "Skeleton",
  component: Skeleton,
  tags: ["visual"],
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TextLine: Story = {
  args: {},
};

export const HeadingLine: Story = {
  args: { shape: "heading" },
};

// The `block` shape has no height of its own: it fills the box the consumer reserved and only
// falls back to its own floor when nothing reserved one. Both halves of that need a baseline, so
// this story gives it a container with a height and the next one gives it none.
export const PanelInASizedBox: Story = {
  args: { shape: "block" },
  render: (args) => (
    <div style={{ blockSize: "12rem", inlineSize: "20rem" }}>
      <Skeleton {...args} />
    </div>
  ),
};

export const PanelWithNoReservedHeight: Story = {
  args: { shape: "block" },
  render: (args) => (
    <div style={{ inlineSize: "20rem" }}>
      <Skeleton {...args} />
    </div>
  ),
};

// The four widths in one shot: this is the axis that replaces the `className` a consumer cannot
// pass, so a regression in any one of them is a regression in the component's whole reason for
// having a typed API.
export const Widths: Story = {
  args: {},
  render: () => (
    <div style={{ display: "grid", gap: "0.5rem", inlineSize: "24rem" }}>
      <Skeleton width="full" />
      <Skeleton width="wide" />
      <Skeleton width="half" />
      <Skeleton width="narrow" />
    </div>
  ),
};

// The dominant real use, and the reason `width` carries fractions rather than lengths: a
// paragraph placeholder is three full lines and a short last one, and it has to stay right in a
// column of any measure. `aria-busy` on the region is the caller's half of the contract.
export const RaggedParagraph: Story = {
  args: {},
  render: () => (
    <div aria-busy="true" style={{ display: "grid", gap: "0.5rem", inlineSize: "24rem" }}>
      <Skeleton />
      <Skeleton />
      <Skeleton />
      <Skeleton width="wide" />
    </div>
  ),
};

// What a whole loading card looks like when it is assembled from the three shapes: a heading
// line, a panel and a short paragraph, inside one busy region that announces once.
export const LoadingArticle: Story = {
  args: {},
  render: () => (
    <div aria-busy="true" style={{ display: "grid", gap: "0.75rem", inlineSize: "24rem" }}>
      <Skeleton shape="heading" width="half" />
      <div style={{ blockSize: "8rem" }}>
        <Skeleton shape="block" />
      </div>
      <Skeleton />
      <Skeleton />
      <Skeleton width="half" />
    </div>
  ),
};

// No baseline: nothing here is a new pixel arrangement. It exists to prove a placeholder is valid
// and correctly laid out INSIDE a paragraph, which is the reason the component renders a `<span>`
// with `display: block` rather than a `<div>` — a `<div>` there would be invalid markup a
// consumer has no escape hatch to fix.
export const InsideAParagraph: Story = {
  tags: ["!visual"],
  args: {},
  render: () => (
    <p aria-busy="true" style={{ inlineSize: "24rem" }}>
      <Skeleton />
    </p>
  ),
};
