import type { Meta, StoryObj } from "@storybook/react-vite";
import { Link } from "@zevaui/components";

// Every story here has real, descriptive link text. That is not decoration: a screen reader can
// list a page's links out of context, so "Read more" repeated down a page is a set of identical
// announcements. The stories that need a short label supply an `aria-label` instead of relying on
// the sentence around them.
const meta = {
  title: "Link",
  component: Link,
  tags: ["visual"],
} satisfies Meta<typeof Link>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { href: "/docs/getting-started", children: "Getting started" },
};

// The pairing a link inside prose must have: the colour AND the underline. A link distinguished
// from the text around it by hue alone fails WCAG 1.4.1, and this is the baseline that proves the
// default is the safe one rather than the pretty one.
export const InAParagraph: Story = {
  args: { href: "/docs", children: "the token reference" },
  render: () => (
    <p style={{ maxInlineSize: "42ch" }}>
      Every colour in this system resolves through a custom property. The full list lives in{" "}
      <Link href="/docs/tokens">the token reference</Link>, and each one is validated against the
      backgrounds it is allowed to sit on.
    </p>
  ),
};

export const Neutral: Story = {
  args: { tone: "neutral", href: "/pricing", children: "Pricing" },
};

export const UnderlineOnHover: Story = {
  args: { underline: "hover", href: "/changelog", children: "Changelog" },
};

// The combination this package cannot check for you, shown in the context where it is CORRECT: a
// row of navigation links, where position already says what each one is and painting them all blue
// would make the colour carry no information. The same pair inside a paragraph would be a 1.4.1
// failure — see link.recipe.ts.
export const NavigationRow: Story = {
  args: { href: "/", children: "Overview" },
  render: () => (
    <nav aria-label="Documentation">
      <div style={{ display: "flex", gap: "1.5rem" }}>
        <Link tone="neutral" underline="hover" href="/docs">
          Overview
        </Link>
        <Link tone="neutral" underline="hover" href="/docs/components">
          Components
        </Link>
        <Link tone="neutral" underline="hover" href="/docs/tokens">
          Tokens
        </Link>
      </div>
    </nav>
  ),
};

// A disabled link keeps its underline and its shape and loses its colour to `text.muted` — the one
// dimmed text colour @zevaui/constraints validates against both backgrounds. Button dims with
// opacity instead; the divergence is argued in link.recipe.ts, and it is why this baseline exists.
export const Disabled: Story = {
  args: { href: "/admin", isDisabled: true, children: "Admin settings" },
};

// The default nobody has to remember: `rel="noopener noreferrer"` is applied here, not documented
// somewhere a call site can miss. No baseline — the attribute is invisible and `link.test.ts`
// already pins it — but the story exists so the behaviour is reachable in the canvas.
export const NewTab: Story = {
  tags: ["!visual"],
  args: {
    href: "https://www.w3.org/TR/WCAG22/",
    target: "_blank",
    children: "WCAG 2.2 (opens in a new tab)",
  },
};

// No baseline: nothing here is a new pixel arrangement, only a link long enough to wrap, proving
// the underline follows it across the line break instead of the link becoming a block.
export const WrappingLink: Story = {
  tags: ["!visual"],
  args: { href: "/docs", children: "x" },
  render: () => (
    <p style={{ maxInlineSize: "24ch" }}>
      See <Link href="/docs/theming">how to override every design token without forking</Link> for
      the full procedure.
    </p>
  ),
};
