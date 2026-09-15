import type { Meta, StoryObj } from "@storybook/react-vite";
import { Spinner } from "@zevaui/components";
import { expect, within } from "storybook/test";

// Every story here carries a real label, so the whole file must pass the blocking a11y gate —
// including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7). The
// pairings are the same two Progress already proves: `text.default` for the label, and an
// `accent.default` arc on a `bg.muted` ring, which is a non-text contrast question (WCAG 1.4.11)
// rather than a text one.
//
// The spinning stories are SAFE to screenshot even though the ring rotates forever, and that is
// not luck: the Playwright context in vitest.shared.ts pins `reducedMotion: "reduce"` for every
// capture, and spinner.recipe.ts cancels the rotation under exactly that media query. The arc
// therefore parks at the top of the ring in every baseline — a fixed, recognisable glyph rather
// than whatever frame the capture happened to catch.
const meta = {
  title: "Spinner",
  component: Spinner,
  tags: ["visual"],
  args: {
    label: "Loading",
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm" },
};

export const Medium: Story = {
  args: { size: "md" },
};

export const Large: Story = {
  args: { size: "lg" },
};

// The default, and the shape this component is asked for most often: the name reaches assistive
// tech, nothing reaches the page but the ring.
export const LabelHidden: Story = {
  args: { labelVisibility: "hidden" },
};

export const LabelVisible: Story = {
  args: { labelVisibility: "visible" },
};

export const LabelVisibleLarge: Story = {
  args: { labelVisibility: "visible", size: "lg" },
};

// A name long enough to wrap beside a ring that must not be squashed by it. `flex: none` on the
// indicator and `min-width: 0` on the label are what keep the circle a circle here; without the
// first, the ring is the part that gives way and renders as an ellipse.
export const LongLabelWrapsWithoutSquashingTheRing: Story = {
  args: {
    labelVisibility: "visible",
    label: "Reticulating the splines of every attachment in the archive nobody will ever open",
  },
};

// THE CLAIM THIS STORY PROTECTS: hiding the label must never cost the spinner its name.
//
// `display: none` and `visibility: hidden` would both look identical on screen and both remove
// the element from the accessibility tree — leaving a busy indicator that announces nothing. Only
// asking for the control BY NAME catches that, and only a laid-out check proves the element is
// really clipped rather than merely rendered somewhere off the page.
export const TheNameSurvivesHiding: Story = {
  tags: ["!visual"],
  args: { labelVisibility: "hidden" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Resolved through the accessibility tree, which is the whole point: a clipped label is still
    // a name, a removed one is not.
    expect(canvas.getByRole("progressbar", { name: "Loading" })).toBeTruthy();

    const label = canvasElement.querySelector(".zui-spinner__label") as HTMLElement;
    expect(label.textContent).toBe("Loading");
    // Still laid out — `display: none` would give it no box at all, and `offsetParent` null.
    expect(label.offsetParent).not.toBeNull();
    // ...but clipped to a pixel, so it takes no room in the line beside the ring.
    expect(label.getBoundingClientRect().width).toBeLessThan(2);
  },
};

// A spinner must never claim progress. RAC publishes the indeterminate state as the ABSENCE of
// `aria-valuenow`, so this is the one attribute whose appearance would change what the control
// says without changing anything a screenshot can see.
export const NoValueIsEverClaimed: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole("progressbar", { name: "Loading" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);
    expect(bar.hasAttribute("aria-valuetext")).toBe(false);
  },
};

// Asserted on the RENDERED geometry rather than on the declaration, for the reason Checkbox's
// squareness story gives: the declaration is the input, the laid-out box is what a user sees, and
// only the second one is evidence. A ring is only a ring while its box stays square — a rotating
// ellipse is the most obvious rendering bug this component can have, and it is invisible in a
// baseline captured with the rotation frozen at 0deg.
export const TheRingStaysCircularBesideALongLabel: Story = {
  tags: ["!visual"],
  args: {
    labelVisibility: "visible",
    label: "Reticulating the splines of every attachment in the archive nobody will ever open",
  },
  play: async ({ canvasElement }) => {
    const ring = canvasElement.querySelector(".zui-spinner__indicator") as HTMLElement;
    const box = ring.getBoundingClientRect();

    expect(box.width).toBeGreaterThan(0);
    // Within a pixel: the diameter is a `calc()` against a fractional font size, so both axes land
    // on the same sub-pixel value rather than on an integer.
    expect(Math.abs(box.width - box.height)).toBeLessThan(1);
  },
};

// The diameter is a `calc()` against the body type scale, not a pixel literal, so it is worth one
// assertion that the expression actually RESOLVES. A `calc()` referencing a token the theme never
// bridged computes to nothing, the border collapses to its own width, and three separate
// baselines of three near-identical dots would all look plausible.
export const TheRingTracksTheBodyTypeScale: Story = {
  tags: ["!visual"],
  args: { size: "sm" },
  play: async ({ canvasElement }) => {
    const ring = canvasElement.querySelector(".zui-spinner__indicator") as HTMLElement;
    // `sm` is exactly one body size across, and the shipped body size is 0.875rem = 14px.
    expect(ring.getBoundingClientRect().width).toBeCloseTo(14, 0);
  },
};
