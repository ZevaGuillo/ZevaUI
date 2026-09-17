import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@zevaui/components";
import { expect, fn, userEvent, within } from "storybook/test";

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

// The pending state. The ring is frozen in every baseline below and that is not a limitation to
// work around — the Playwright context pins `reducedMotion: "reduce"` for every capture, which is
// exactly the condition `spinner.recipe.ts` parks the rotation under. A spinner that kept spinning
// would make each of these screenshots a coin flip.
export const Pending: Story = {
  args: { isPending: true, pendingLabel: "Saving", children: "Save" },
};

// At `lg`, where the gap ratio is largest, so the spacing between the ring and the label is
// exaggerated the same way `IconBothLarge` exaggerates the icon gap.
export const PendingLarge: Story = {
  args: { size: "lg", isPending: true, pendingLabel: "Saving", children: "Save" },
};

// THE SUBSTITUTION, drawn rather than described: `iconStart` is supplied and does NOT appear,
// because the indicator took its place, while `iconEnd` is untouched. Compare against
// `IconBothLarge` — if the spinner ever started sitting BESIDE the start icon instead of
// replacing it, this baseline would gain a glyph and widen.
export const PendingReplacesIconStart: Story = {
  args: {
    isPending: true,
    pendingLabel: "Saving",
    iconStart: <Glyph />,
    iconEnd: <Glyph />,
    children: "Save",
  },
};

// `danger` is the visual whose pending state is easiest to get wrong: the ring's accent edge is
// `accent.default`, not the button's own text colour, so it does NOT inherit `currentColor` the
// way `Glyph` does. This baseline is what would catch a ring that vanished against a red fill.
export const PendingDanger: Story = {
  args: { visual: "danger", isPending: true, pendingLabel: "Deleting", children: "Delete" },
};

// PENDING MUST NOT LOOK DISABLED. Placed next to nothing in particular on purpose: the assertion
// is the comparison a reviewer makes between THIS baseline and `Disabled` above. That one is
// dimmed to 50% opacity; this one is at full strength with a ring. If a future change ever
// borrowed the disabled treatment for pending — the exact confusion the state exists to remove —
// these two baselines would converge.
export const PendingIsNotDisabled: Story = {
  args: { isPending: true, pendingLabel: "Saving", children: "Disabled button" },
};

// The `flexShrink: 0` half of the pending rule, and the only case that exercises it: at
// `width="full"` with a label long enough to compete for space, a ring without it is squashed
// below its intrinsic width — and a squashed circle is an ellipse.
export const PendingSurvivesFullWidth: Story = {
  tags: ["!visual"],
  args: {
    width: "full",
    isPending: true,
    pendingLabel: "Saving",
    children: "A deliberately long label that competes with the indicator for horizontal space",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /deliberately long label/ });

    const ring = button.querySelector("[data-zui-pending] [class*='indicator']");
    await expect(ring).not.toBeNull();

    const box = (ring as Element).getBoundingClientRect();
    // Square to within a pixel IS the assertion. A ring squeezed by the label keeps its height
    // and loses width, so comparing the two axes catches exactly that failure — and it catches it
    // without hard-coding a diameter that the `size` axis is free to re-tune.
    await expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(1);
  },
};

// THE DIFFERENCE FROM `isDisabled`, in a real browser rather than jsdom. A disabled button cannot
// be tabbed to at all; a pending one must still be reachable, because the user's focus is already
// there and taking it away mid-operation drops a keyboard user at the top of the document.
export const PendingStaysFocusable: Story = {
  tags: ["!visual"],
  args: { isPending: true, pendingLabel: "Saving", children: "Save" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button", { name: /Save/ });

    await userEvent.tab();
    await expect(button).toHaveFocus();

    await expect(button).toHaveAttribute("aria-disabled", "true");
    // The attribute that would have cost the focus above, asserted absent rather than assumed.
    await expect(button).not.toHaveAttribute("disabled");
  },
};

export const PendingSuppressesPress: Story = {
  tags: ["!visual"],
  args: { isPending: true, pendingLabel: "Saving", children: "Save", onPress: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Save/ }));
    await expect(args.onPress).not.toHaveBeenCalled();
  },
};

// IMPLICIT FORM SUBMISSION, which suppressing `onPress` does not cover and no unit test in this
// package can reach: pressing Enter inside a text input submits the form through the browser's
// own default-button lookup, never through the button's press handling. react-aria-components
// downgrades `type="submit"` to `type="button"` while pending for exactly this, and a real
// browser is the only place that path runs.
export const PendingDoesNotSubmitItsForm: Story = {
  tags: ["!visual"],
  args: { isPending: true, pendingLabel: "Saving", type: "submit", children: "Save" },
  // TWO fields, and that is load-bearing rather than incidental — the first version of this story
  // had one and PASSED THE FORM THROUGH, proving nothing. HTML's implicit submission has two arms:
  // with a default button it presses that button, but with NO default button it still submits the
  // form when there is EXACTLY ONE field that blocks implicit submission. A single-field form
  // therefore submits whatever the button's type is, so the story would have gone green for a
  // `type="submit"` that was never downgraded. With two fields the browser's only route to submit is
  // the default button, which is precisely the route react-aria-components closes.
  render: (args) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        (event.currentTarget as HTMLFormElement).dataset.submitted = "true";
      }}
    >
      <label htmlFor="pending-form-name">Name</label>
      <input id="pending-form-name" name="name" />
      <label htmlFor="pending-form-email">Email</label>
      <input id="pending-form-email" name="email" />
      <Button {...args} />
    </form>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByLabelText("Name");
    const form = field.closest("form") as HTMLFormElement;

    await expect(canvas.getByRole("button", { name: /Save/ })).toHaveAttribute("type", "button");

    await userEvent.type(field, "anything{Enter}");

    await expect(form.dataset.submitted).toBeUndefined();
  },
};

// The announcement half of the contract, and the reason the indicator gets its own box instead of
// riding in `iconStart`: that slot is `aria-hidden`, which would leave this query finding nothing
// at all. A `progressbar` with `aria-valuenow` ABSENT is what assistive tech reads as "busy, with
// no measurable extent" — the exact claim a button that cannot predict its own completion should
// be making.
export const PendingIndicatorIsNamedAndUnmeasured: Story = {
  tags: ["!visual"],
  args: { isPending: true, pendingLabel: "Saving", children: "Save" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const indicator = canvas.getByRole("progressbar", { name: "Saving" });

    await expect(indicator).not.toHaveAttribute("aria-valuenow");
    await expect(indicator).not.toHaveAttribute("aria-valuetext");

    // The box the system owns, asserted NOT hidden. This is the regression the whole design
    // exists to prevent, and it is the one assertion here that would still pass in jsdom — kept
    // anyway, because if it ever fails the query above fails with it and the cause is unclear.
    const box = indicator.closest("[data-zui-pending]");
    await expect(box).not.toBeNull();
    await expect(box).not.toHaveAttribute("aria-hidden");
  },
};
