import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";

// Every story here has a real, non-empty accessible name (visible text
// content). This file is the positive counterpart to
// __gate__/BrokenA11y.stories.tsx: it must pass the a11y gate, not just
// exist.
const meta = {
  title: "Button",
  component: Button,
  tags: ["visual"],
  args: {
    children: "Continue",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SolidSmall: Story = {
  args: { visual: "solid", size: "sm", children: "Solid small" },
};

export const SolidMedium: Story = {
  args: { visual: "solid", size: "md", children: "Solid medium" },
};

export const SolidLarge: Story = {
  args: { visual: "solid", size: "lg", children: "Solid large" },
};

export const SubtleSmall: Story = {
  args: { visual: "subtle", size: "sm", children: "Subtle small" },
};

export const SubtleMedium: Story = {
  args: { visual: "subtle", size: "md", children: "Subtle medium" },
};

export const SubtleLarge: Story = {
  args: { visual: "subtle", size: "lg", children: "Subtle large" },
};

export const DangerSmall: Story = {
  args: { visual: "danger", size: "sm", children: "Danger small" },
};

export const DangerMedium: Story = {
  args: { visual: "danger", size: "md", children: "Danger medium" },
};

export const DangerLarge: Story = {
  args: { visual: "danger", size: "lg", children: "Danger large" },
};

export const Disabled: Story = {
  args: { isDisabled: true, children: "Disabled button" },
};

// The only story here whose point is the box rather than the label, and the
// only one whose baseline is meaningless without a container to stretch
// against — the story canvas is the container, so a full-width button spans
// it while every story above shrink-wraps. That contrast IS the assertion:
// if `width: full` ever stopped stretching, this baseline would collapse to
// the same shape as `SolidMedium` and the visual gate would catch it.
export const FullWidth: Story = {
  args: { width: "full", children: "Full width" },
};

// Inline rather than an icon dependency: this package ships no icon set, and
// what these stories are about is the BOX the design system puts around
// whatever it is handed. `currentColor` is the point of the fill — the icon
// inherits the button's text colour per visual, so `danger` and `subtle` need
// no icon-specific styling at all.
const Glyph = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <title>arrow</title>
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const IconStart: Story = {
  args: { iconStart: <Glyph />, children: "Icon start" },
};

export const IconEnd: Story = {
  args: { iconEnd: <Glyph />, children: "Icon end" },
};

// Both slots at `lg`, where the gap ratio is largest, so a regression in the
// per-size gap shows up in the baseline at the size that exaggerates it.
export const IconBothLarge: Story = {
  args: { size: "lg", iconStart: <Glyph />, iconEnd: <Glyph />, children: "Both icons" },
};

// MEASURES THE RENDERED BOX, which every unit test in the package structurally
// cannot: those assert a class is rendered and a declaration exists in the
// stylesheet, never that the stylesheet reaches the element. Here the browser
// has resolved the cascade, so the distance between the icon's right edge and
// the label's first glyph is real geometry — and it is compared against the
// gap the button actually computed, not against a number copied from the
// recipe, so re-tuning the ratio cannot leave this story asserting a stale
// value.
export const IconGapIsReal: Story = {
  tags: ["!visual"],
  args: { iconStart: <Glyph />, children: "Save" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Save" });

    const icon = button.querySelector("[data-zui-icon]");
    await expect(icon).not.toBeNull();

    const label = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
    await expect(label).toBeDefined();
    const labelRange = document.createRange();
    labelRange.selectNodeContents(label as Node);

    // Wait for fonts before measuring. Text metrics are what the label's Range rect is made of,
    // and a fallback face resolves to different glyph advances than the real one — measuring
    // before the swap is how this assertion would flake in CI without ever being wrong.
    await document.fonts.ready;

    const computedGap = Number.parseFloat(getComputedStyle(button).columnGap);
    await expect(computedGap).toBeGreaterThan(0);

    const measured =
      labelRange.getBoundingClientRect().left - (icon as Element).getBoundingClientRect().right;

    // A 1px band, not exact equality. Both sides are sub-pixel values from independent sources —
    // a text Range rect and a resolved CSS length — and on a fractional device pixel ratio they
    // can legitimately round to adjacent integers. The regression this guards against is the gap
    // collapsing or doubling, which a 1px band still catches.
    await expect(Math.abs(measured - computedGap)).toBeLessThanOrEqual(1);
  },
};

// The `flexShrink: 0` half of the icon rule, and the only case that exercises
// it: at `width="full"` with a label long enough to compete for space, an icon
// without it is squashed below its intrinsic width by the label.
export const IconSurvivesFullWidth: Story = {
  tags: ["!visual"],
  args: {
    width: "full",
    iconStart: <Glyph />,
    iconEnd: <Glyph />,
    children: "A deliberately long label that competes with both icons for horizontal space",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /deliberately long label/ });

    const icons = [...button.querySelectorAll("[data-zui-icon]")];
    await expect(icons).toHaveLength(2);
    for (const icon of icons) {
      await expect(Math.round(icon.getBoundingClientRect().width)).toBe(16);
    }
  },
};

// Tabs focus onto the button and asserts the focus-visible outline path
// (`&[data-focus-visible]` in button.recipe.ts) is reachable by keyboard,
// without giving up the accessible name.
export const Focused: Story = {
  tags: ["!visual"],
  args: { children: "Focus me" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: "Focus me" });

    await userEvent.tab();

    await expect(button).toHaveFocus();
  },
};
