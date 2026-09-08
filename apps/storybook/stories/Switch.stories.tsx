import type { Meta, StoryObj } from "@storybook/react-vite";
import { Switch } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";

// Every story here carries a real label, so the whole file must pass the blocking a11y gate —
// including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7). The
// pairing this component exercises and no other does is the thumb: `bg.surface` sitting on
// `accent.default` when on, and on `bg.muted` when off. Both have to hold in all three themes.
const meta = {
  title: "Switch",
  component: Switch,
  tags: ["visual"],
  args: {
    children: "Enable notifications",
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm", children: "Enable notifications (small)" },
};

export const Medium: Story = {
  args: { size: "md", children: "Enable notifications (medium)" },
};

export const Large: Story = {
  args: { size: "lg", children: "Enable notifications (large)" },
};

export const Selected: Story = {
  args: { isSelected: true, onChange: () => {} },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

export const DisabledSelected: Story = {
  args: { isDisabled: true, isSelected: true, onChange: () => {} },
};

export const ReadOnly: Story = {
  args: { isReadOnly: true, isSelected: true, onChange: () => {} },
};

// `isRequired` and `isInvalid` only exist because this component is built on SwitchField +
// SwitchButton: RAC 1.20's flat `Switch` omits both from its props. These two stories are the
// visual half of that architectural guard.
export const Required: Story = {
  args: { isRequired: true },
};

export const Invalid: Story = {
  args: { isInvalid: true },
};

export const InvalidSelected: Story = {
  args: { isInvalid: true, isSelected: true, onChange: () => {} },
};

// The off and on states side by side, which is the one comparison a per-state screenshot cannot
// make: what distinguishes them must be the thumb's POSITION, not only the track's colour.
export const OffAndOn: Story = {
  render: () => (
    <>
      <Switch>Off</Switch>
      <Switch isSelected onChange={() => {}}>
        On
      </Switch>
    </>
  ),
};

// A label long enough to wrap, which is the case that catches a track laid out as an ordinary
// flex item: without `flex: none` the track shrinks to the leftover width and stops being a pill.
export const WrappingLabel: Story = {
  tags: ["!visual"],
  args: {
    children:
      "Send me an email every time somebody I have never met comments on a thread I stopped reading months ago",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const track = canvasElement.querySelector(".zui-switch__track") as HTMLElement;
    const thumb = canvasElement.querySelector(".zui-switch__thumb") as HTMLElement;
    const trackBox = track.getBoundingClientRect();
    const thumbBox = thumb.getBoundingClientRect();

    // Asserted on the RENDERED boxes, not on the emitted declarations: the declaration is the
    // input, the laid-out control is what a user sees, and only the second one is evidence.
    expect(trackBox.width).toBeGreaterThan(trackBox.height);
    // The thumb is a circle, which is what `alignSelf: stretch` + `aspect-ratio: 1` buys without
    // any per-size length. Rounded because sub-pixel layout differs across engines.
    expect(Math.round(thumbBox.width)).toBe(Math.round(thumbBox.height));
    expect(thumbBox.width).toBeGreaterThan(0);
    // The label really did wrap, so the assertions above were not vacuous.
    const label = canvas.getByText(/Send me an email/);
    expect(label.getBoundingClientRect().height).toBeGreaterThan(trackBox.height);
  },
};

// The state is NOT conveyed by the track colour alone: the thumb moves from one end to the
// other, which is a non-chromatic difference and therefore what WCAG 1.4.1 asks for. Measured in
// a real browser against two rendered controls, because the recipe expresses this as a
// `justify-content` flip and only layout can confirm the thumb actually moved.
export const TheThumbMovesRatherThanOnlyTheColour: Story = {
  tags: ["!visual"],
  render: () => (
    <>
      <Switch>Off switch</Switch>
      <Switch isSelected onChange={() => {}}>
        On switch
      </Switch>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const partOf = (name: string, part: string) =>
      canvas
        .getByRole("switch", { name })
        .closest("label")
        ?.querySelector(`.zui-switch__${part}`) as HTMLElement;

    const offTrack = partOf("Off switch", "track").getBoundingClientRect();
    const offThumb = partOf("Off switch", "thumb").getBoundingClientRect();
    const onTrack = partOf("On switch", "track").getBoundingClientRect();
    const onThumb = partOf("On switch", "thumb").getBoundingClientRect();

    // Measured as a fraction of each track, so the assertion holds at any size and in any theme.
    const offset = (thumb: DOMRect, track: DOMRect) => (thumb.left - track.left) / track.width;

    expect(offset(offThumb, offTrack)).toBeLessThan(0.25);
    expect(offset(onThumb, onTrack)).toBeGreaterThan(0.25);
  },
};

// The bug review caught on Checkbox, guarded here BEFORE it could be re-introduced rather than
// after. The specificity is identical:
//
//   .zui-switch__track[data-hovered]:not([data-disabled])  -> (0,3,0)
//   .zui-switch__track[data-invalid]                       -> (0,2,0)
//
// A `:not()` argument carries its own weight, so without the `:not([data-invalid])` guard the
// hover tint outranks the invalid border no matter the source order, and an invalid switch turns
// from red back to accent the moment the pointer touches it — the one moment the user is looking
// straight at it. `aria-invalid` never changes, so only sighted users would lose the signal.
export const HoveringAnInvalidSwitchKeepsItRed: Story = {
  tags: ["!visual"],
  render: () => (
    <>
      <Switch isInvalid>Invalid, will be hovered</Switch>
      <Switch isInvalid>Invalid, left alone</Switch>
      <Switch>Valid, will be hovered</Switch>
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trackOf = (name: string) =>
      canvas
        .getByRole("switch", { name })
        .closest("label")
        ?.querySelector(".zui-switch__track") as HTMLElement;

    const hoveredInvalid = trackOf("Invalid, will be hovered");
    const restingInvalid = trackOf("Invalid, left alone");
    const hoveredValid = trackOf("Valid, will be hovered");

    // THE HOVER IS SET DIRECTLY, NOT SIMULATED, for the reason the equivalent Checkbox story
    // records: `userEvent.hover` does not drive react-aria's hover state in this runner, so
    // asserting through it would produce a test that passes for the wrong reason. `data-hovered`
    // on this track is not react-aria's attribute anyway — `Switch.tsx` stamps it from the
    // render prop precisely so the recipe's rules stay local. The stimulus is synthetic; the
    // measurement is not, since `getComputedStyle` resolves the real stylesheet in a real
    // browser, which is the only place a specificity bug is ever visible.
    hoveredInvalid.setAttribute("data-hovered", "true");
    hoveredValid.setAttribute("data-hovered", "true");

    expect(restingInvalid).not.toHaveAttribute("data-hovered");

    const borderOf = (track: HTMLElement) => getComputedStyle(track).borderColor;

    // Compared against other rendered controls rather than a colour literal: the tokens differ
    // per theme, so any hard-coded expectation would be wrong in two of the three theme runs.
    expect(borderOf(hoveredInvalid)).toBe(borderOf(restingInvalid));
    expect(borderOf(hoveredInvalid)).not.toBe(borderOf(hoveredValid));
  },
};

// Clicking the TEXT must toggle the control, which is the whole reason `SwitchButton` renders a
// real `<label>` with the input associated to it rather than a div with a click handler.
export const ClickingTheLabelToggles: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("switch", { name: "Enable notifications" });

    expect(control).not.toBeChecked();
    await userEvent.click(canvas.getByText("Enable notifications"));
    expect(control).toBeChecked();
  },
};

// The space bar is the switch's keyboard contract, and it is genuinely distinct from a click: a
// control that only responded to the pointer would pass every other story here.
export const SpaceBarToggles: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const control = canvas.getByRole("switch", { name: "Enable notifications" });

    await userEvent.tab();
    expect(control).toHaveFocus();
    await userEvent.keyboard(" ");
    expect(control).toBeChecked();
  },
};
