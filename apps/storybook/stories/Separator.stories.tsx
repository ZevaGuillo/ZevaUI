import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, Link, Separator } from "@zevaui/components";

// A separator has no text of its own, so unlike Badge these stories cannot carry their meaning in
// a label — the gate they have to pass is the STRUCTURAL one. Each story below places the divider
// between content that is genuinely separate, because a `role="separator"` sitting between two
// halves of the same thing is a lie told to everyone navigating by structure.
const meta = {
  title: "Separator",
  component: Separator,
  tags: ["visual"],
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  args: {},
  render: () => (
    <div style={{ display: "grid", gap: "1rem", inlineSize: "24rem" }}>
      <p>Everything above this line is one thought.</p>
      <Separator />
      <p>Everything below it is another.</p>
    </div>
  ),
};

// The orientation whose one precondition is real: `vertical` takes its height from a flex or grid
// parent, because CSS has no cross-axis equivalent of `width: 100%` in normal flow. This story IS
// that parent, which is why it is also the baseline — a regression here shows up as nothing at all
// being drawn.
export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
      <Link href="/docs" tone="neutral" underline="hover">
        Docs
      </Link>
      <Separator orientation="vertical" />
      <Link href="/docs/components" tone="neutral" underline="hover">
        Components
      </Link>
      <Separator orientation="vertical" />
      <Link href="/changelog" tone="neutral" underline="hover">
        Changelog
      </Link>
    </div>
  ),
};

// The crowded row that proves `flex-shrink: 0`. A 1px flex item is the first thing a row squashes
// to nothing when it runs out of space, and a divider that vanishes only under pressure is the
// hardest kind of regression to see. Each divider here is competing with content wider than the
// container.
export const InACrowdedRow: Story = {
  args: { orientation: "vertical" },
  render: () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        inlineSize: "18rem",
      }}
    >
      <span style={{ minInlineSize: 0, overflow: "hidden" }}>A deliberately long first label</span>
      <Separator orientation="vertical" />
      <span style={{ minInlineSize: 0, overflow: "hidden" }}>A second one, just as long</span>
      <Separator orientation="vertical" />
      <Badge tone="accent">Beta</Badge>
    </div>
  ),
};

// The escape hatch, and the case it is FOR: two sections that each announce themselves with a
// heading, where the line only repeats a boundary a screen-reader user was already told about.
// Visually identical to `Horizontal` by design — `decorative` is an ARIA decision, never a paint
// one — so it carries no baseline of its own.
export const Decorative: Story = {
  tags: ["!visual"],
  args: { decorative: true },
  render: () => (
    <div style={{ display: "grid", gap: "1rem", inlineSize: "24rem" }}>
      <section>
        <h3>Installation</h3>
        <p>Add the package and import the stylesheet.</p>
      </section>
      <Separator decorative />
      <section>
        <h3>Theming</h3>
        <p>Override the custom properties, never fork the package.</p>
      </section>
    </div>
  ),
};

// No baseline: the geometry is the same 1px line, only stacked. What this proves is that the rule
// takes its colour from `border.default` in every theme rather than from a value that happens to
// look right on one background.
//
// IT ALSO EXISTS TO SHOW THE MISTAKE IT WAS WRITTEN WITH, because it is the one a consumer will
// make too. The first version put each `<Separator />` BETWEEN the `<li>` elements, which reads
// naturally and is invalid HTML: a `<ul>` may only contain `<li>`, and axe's `list` rule failed
// this story in all three themes on the spot. The divider belongs INSIDE the row it closes. That
// is also why these ones are `decorative` — the list already announces its own item boundaries, so
// a `role="separator"` between two of them would be the same fact told twice.
export const BetweenListRows: Story = {
  tags: ["!visual"],
  args: {},
  render: () => (
    <ul style={{ inlineSize: "20rem", listStyle: "none", margin: 0, padding: 0 }}>
      <li>
        <div style={{ paddingBlock: "0.75rem" }}>Tokens</div>
        <Separator decorative />
      </li>
      <li>
        <div style={{ paddingBlock: "0.75rem" }}>Components</div>
        <Separator decorative />
      </li>
      <li>
        <div style={{ paddingBlock: "0.75rem" }}>Constraints</div>
      </li>
    </ul>
  ),
};
