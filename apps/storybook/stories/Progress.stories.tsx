import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "@zevaui/components";
import { expect, within } from "storybook/test";

// Every story here carries a real label, so the whole file must pass the blocking a11y gate —
// including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7). Two
// pairings are new to this file: `text.secondary` for the value text, and an `accent.default`
// fill on a `bg.muted` track, which is a non-text contrast question (WCAG 1.4.11) rather than a
// text one.
//
// The indeterminate stories are SAFE to screenshot even though they animate, and that is not
// luck: the Playwright context in vitest.shared.ts pins `reducedMotion: "reduce"` for every
// capture, and progress.recipe.ts cancels the sweep under exactly that media query. The sliver
// therefore parks at the start of the track in every baseline.
const meta = {
  title: "Progress",
  component: Progress,
  tags: ["visual"],
  args: {
    label: "Uploading",
  },
} satisfies Meta<typeof Progress>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm", value: 62 },
};

export const Medium: Story = {
  args: { size: "md", value: 62 },
};

export const Large: Story = {
  args: { size: "lg", value: 62 },
};

// The two ends of the range, which are the only values where a rounding or clamping mistake is
// visible rather than merely a few pixels off.
export const Empty: Story = {
  args: { value: 0 },
};

export const Complete: Story = {
  args: { value: 100 },
};

// Parked at the start under reduced motion, on purpose: a full accent track would read as
// "finished", which is the one thing an operation of unknown extent must not claim.
export const Indeterminate: Story = {
  args: { label: "Syncing", isIndeterminate: true },
};

export const IndeterminateLarge: Story = {
  args: { label: "Syncing", isIndeterminate: true, size: "lg" },
};

// `{ style: "percent" }` is react-aria's default and it formats the POSITION IN THE RANGE, not
// the raw value — so this reads "50%", not "5%".
export const CustomRange: Story = {
  args: { label: "Step", value: 5, maxValue: 10 },
};

// Any style other than percent formats the VALUE instead, which is what makes a step counter
// readable without a valueLabel.
export const DecimalFormat: Story = {
  args: { label: "Step", value: 5, maxValue: 10, formatOptions: { style: "decimal" } },
};

export const CustomValueLabel: Story = {
  args: { label: "Step", value: 5, maxValue: 10, valueLabel: "5 of 10" },
};

// A label long enough to wrap against a value text that must stay on one line: without
// `flex: none` on the value text, the percentage is the run that collapses, and the number the
// user is watching is the one that breaks.
export const LongLabel: Story = {
  args: {
    label:
      "Uploading the third of seventeen attachments to the archive nobody will ever open again",
    value: 62,
  },
};

// The fill width is the package's only inline style, and the only thing a static stylesheet
// cannot express. Asserted on the RENDERED geometry rather than on the declaration, for the
// reason Checkbox's squareness story gives: the declaration is the input, the laid-out box is
// what a user sees, and only the second one is evidence.
export const FillWidthTracksTheValue: Story = {
  tags: ["!visual"],
  args: { value: 62 },
  play: async ({ canvasElement }) => {
    const track = canvasElement.querySelector(".zui-progress__track") as HTMLElement;
    const fill = canvasElement.querySelector(".zui-progress__fill") as HTMLElement;

    const trackWidth = track.getBoundingClientRect().width;
    const fillWidth = fill.getBoundingClientRect().width;

    expect(trackWidth).toBeGreaterThan(0);
    // Within a pixel: the browser resolves 62% against a fractional track width.
    expect(Math.abs(fillWidth - trackWidth * 0.62)).toBeLessThan(1);
  },
};

// THE CLAIM THIS STORY PROTECTS: an operation of unknown extent must never look finished.
//
// Under the pinned `reducedMotion: "reduce"` the sweep is cancelled, so the sliver has nowhere to
// travel and simply sits at the start of the track. If the reduced-motion branch ever "fixed"
// that by widening the fill to the whole track, every baseline would still pass — a full accent
// bar is a perfectly stable screenshot — and the component would silently start announcing
// completion it has no idea about. Only a width assertion catches it.
export const IndeterminateNeverLooksComplete: Story = {
  tags: ["!visual"],
  args: { label: "Syncing", isIndeterminate: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole("progressbar", { name: "Syncing" });
    expect(bar.hasAttribute("aria-valuenow")).toBe(false);

    const track = canvasElement.querySelector(".zui-progress__track") as HTMLElement;
    const fill = canvasElement.querySelector(".zui-progress__fill") as HTMLElement;
    const trackWidth = track.getBoundingClientRect().width;
    const fillWidth = fill.getBoundingClientRect().width;

    expect(trackWidth).toBeGreaterThan(0);
    expect(fillWidth).toBeGreaterThan(0);
    expect(fillWidth).toBeLessThan(trackWidth * 0.75);
  },
};

// The value reaches assistive tech exactly once. The progressbar role already publishes it
// through `aria-valuetext`; the visible copy is `aria-hidden`, so it is not announced a second
// time as the widget's content.
export const TheValueIsAnnouncedOnce: Story = {
  tags: ["!visual"],
  args: { value: 62 },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bar = canvas.getByRole("progressbar", { name: "Uploading" });
    expect(bar.getAttribute("aria-valuetext")).toBe("62%");

    const valueText = canvasElement.querySelector(".zui-progress__valueText") as HTMLElement;
    expect(valueText.textContent).toBe("62%");
    expect(valueText.getAttribute("aria-hidden")).toBe("true");
    expect(canvasElement.querySelector(".zui-progress__track")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  },
};
