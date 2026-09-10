import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";
import { assertHoverDoesNotOutrankInvalid } from "./support/markable-control.js";

// Every story here carries a real question and real answers, so the whole file must pass the
// blocking a11y gate — including axe's color-contrast rule, which only executes in browser mode
// (ADR-0004 D7). The pairing this component exercises and no other does is the dot: an
// `accent.default` disc on the `bg.surface` fill the marker keeps when selected, rather than
// Checkbox's inverse glyph on a flooded accent box. Both have to hold in all three themes.
const meta = {
  title: "RadioGroup",
  component: RadioGroup,
  tags: ["visual"],
  args: {
    label: "How should we contact you?",
    options: [
      { value: "email", label: "Email" },
      { value: "sms", label: "Text message" },
      { value: "none", label: "Do not contact me" },
    ],
  },
} satisfies Meta<typeof RadioGroup>;

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

export const Selected: Story = {
  args: { defaultValue: "sms" },
};

// The second axis, and the only one that changes layout rather than size. It gets its own
// screenshot because a per-state capture of the vertical default would never show the row.
export const Horizontal: Story = {
  args: { orientation: "horizontal", defaultValue: "email" },
};

// Disabling the GROUP dims the question too, which is the claim `root`'s `&[data-disabled]` rule
// makes and the one a screenshot can actually settle.
export const Disabled: Story = {
  args: { isDisabled: true },
};

export const DisabledSelected: Story = {
  args: { isDisabled: true, defaultValue: "email" },
};

// The other half of that pair, and the reason the two rules had to stay separate: ONE unavailable
// answer dims only its own row, while the question and its siblings stay at full strength.
export const DisabledOption: Story = {
  args: {
    options: [
      { value: "email", label: "Email" },
      { value: "sms", label: "Text message (unavailable in your region)", isDisabled: true },
      { value: "none", label: "Do not contact me" },
    ],
  },
};

export const ReadOnly: Story = {
  args: { isReadOnly: true, defaultValue: "email" },
};

// `isRequired` and `isInvalid` sit on the GROUP, not on any option — a single radio has nothing
// to be required about, the question does. These stories are the visual half of that decision.
export const Required: Story = {
  args: { isRequired: true },
};

export const Invalid: Story = {
  args: { isInvalid: true },
};

export const InvalidSelected: Story = {
  args: { isInvalid: true, defaultValue: "none" },
};

// An answer long enough to wrap, which is the case that catches a marker laid out as an ordinary
// flex item: without `flex: none` the marker shrinks to the leftover width and stops being a
// circle — it becomes an ellipse, and an ellipse is not a radio.
export const WrappingOptionLabel: Story = {
  tags: ["!visual"],
  args: {
    options: [
      { value: "email", label: "Email" },
      {
        value: "post",
        label:
          "A physical letter, printed and posted to the address I gave you four years ago and have not updated since, arriving some time next month",
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const marker = canvas
      .getByRole("radio", { name: /A physical letter/ })
      .closest("label")
      ?.querySelector(".zui-radio-group__marker") as HTMLElement;
    const { width, height } = marker.getBoundingClientRect();

    // Asserted on the RENDERED marker, not on the emitted `flex: none` declaration: the
    // declaration is the input, the laid-out marker is what a user sees, and only the second one
    // is evidence. Rounded because sub-pixel layout differs across engines.
    expect(Math.round(width)).toBe(Math.round(height));
    expect(width).toBeGreaterThan(0);
    // The answer really did wrap, so the assertion above was not vacuous.
    const optionLabel = canvas.getByText(/A physical letter/);
    expect(optionLabel.getBoundingClientRect().height).toBeGreaterThan(height);
  },
};

// `orientation: horizontal` folds rather than scrolls, which is the choice the recipe argues: an
// answer a user cannot see is an answer they cannot choose. Measured on the laid-out rows,
// because `flex-wrap: wrap` in the computed style is the input and a second row is the outcome.
export const HorizontalWrapsRatherThanOverflows: Story = {
  tags: ["!visual"],
  args: {
    orientation: "horizontal",
    options: Array.from({ length: 8 }, (_, index) => ({
      value: `option-${index}`,
      label: `A deliberately long answer number ${index + 1}`,
    })),
  },
  play: async ({ canvasElement }) => {
    const list = canvasElement.querySelector(".zui-radio-group__list") as HTMLElement;
    const options = [...canvasElement.querySelectorAll(".zui-radio-group__option")];
    const topOf = (element: Element) => Math.round(element.getBoundingClientRect().top);

    // More than one row, which is what wrapping MEANS. Eight long answers cannot fit on one line
    // at any width this runner uses, so the check is not width-dependent in practice.
    expect(new Set(options.map(topOf)).size).toBeGreaterThan(1);
    // And nothing was pushed out sideways instead: no horizontal scroll, no clipped answer. The
    // +1 absorbs sub-pixel rounding, not a real overflow.
    expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth + 1);
  },
};

// THE STATE IS NOT CONVEYED BY COLOUR ALONE, which is WCAG 1.4.1 rather than a nicety. Checkbox
// reveals a glyph and Switch moves its thumb; a radio reveals a dot. The recipe expresses that as
// `transform: scale(0)` -> `scale(1)`, so only a real layout box can confirm the dot is actually
// there — a `background-color` assertion would pass on an invisible element scaled to nothing.
export const TheDotAppearsRatherThanOnlyTheColour: Story = {
  tags: ["!visual"],
  args: { defaultValue: "sms" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dotOf = (name: string) =>
      canvas
        .getByRole("radio", { name })
        .closest("label")
        ?.querySelector(".zui-radio-group__dot") as HTMLElement;

    const selected = dotOf("Text message").getBoundingClientRect();
    const unselected = dotOf("Email").getBoundingClientRect();

    expect(selected.width).toBeGreaterThan(0);
    expect(selected.height).toBeGreaterThan(0);
    // Scaled to nothing rather than removed: one element in the DOM either way, so choosing an
    // answer never shifts the row. That is why this asserts a zero BOX and not a missing node.
    expect(unselected.width).toBe(0);
    expect(dotOf("Email")).toBeInTheDocument();
  },
};

// THE MEASURED FINDING, pinned so it cannot be "fixed" back into the intuitive-but-wrong shape.
// `aria-invalid` belongs to the RADIOGROUP and to no individual radio, which is what RAC 1.20
// emits and what is correct: the invalid thing is the ANSWER TO THE QUESTION, so a screen reader
// announces it once on entering the group instead of once per option the user arrows past. An
// implementation that stamped it on every input would look more thorough and be worse.
export const AriaInvalidLivesOnTheGroupNotOnEachOption: Story = {
  tags: ["!visual"],
  args: { isInvalid: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole("radiogroup", { name: "How should we contact you?" });

    expect(group).toHaveAttribute("aria-invalid", "true");
    for (const radio of canvas.getAllByRole("radio")) {
      expect(radio).not.toHaveAttribute("aria-invalid");
    }
  },
};

// The bug review caught on Checkbox, guarded here BEFORE it could be re-introduced. The
// specificity is identical:
//
//   .zui-radio-group__marker[data-hovered]:not([data-disabled])  -> (0,3,0)
//   .zui-radio-group__marker[data-invalid]                       -> (0,2,0)
//
// A `:not()` argument carries its own weight, so without the `:not([data-invalid])` guard the
// hover tint outranks the invalid border no matter the source order, and an invalid group loses
// its red boundary the moment the pointer touches an option — the one moment the user is looking
// straight at it. `aria-invalid` never changes, so only sighted users would lose the signal.
//
// TWO GROUPS rather than three controls in one, and that is forced rather than stylistic:
// validity is a property of the GROUP here, so "an invalid option beside a valid one" does not
// exist in this component. The valid comparison control has to be a second group.
export const HoveringAnInvalidRadioKeepsItRed: Story = {
  tags: ["!visual"],
  render: () => (
    <>
      <RadioGroup
        isInvalid
        label="Invalid question"
        options={[
          { value: "hovered", label: "Invalid, will be hovered" },
          { value: "resting", label: "Invalid, left alone" },
        ]}
      />
      <RadioGroup
        label="Valid question"
        options={[{ value: "hovered", label: "Valid, will be hovered" }]}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    assertHoverDoesNotOutrankInvalid(canvasElement, "radio", ".zui-radio-group__marker", {
      hoveredInvalid: "Invalid, will be hovered",
      restingInvalid: "Invalid, left alone",
      hoveredValid: "Valid, will be hovered",
    });
  },
};

// Clicking the TEXT must choose the answer, which is the whole reason `RadioButton` renders a
// real `<label>` with the input associated to it rather than a div with a click handler.
export const ClickingTheOptionLabelSelects: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const option = canvas.getByRole("radio", { name: "Text message" });

    expect(option).not.toBeChecked();
    await userEvent.click(canvas.getByText("Text message"));
    expect(option).toBeChecked();
  },
};

// THE KEYBOARD CONTRACT THAT IS THIS COMPONENT'S AND NOT THE OTHER TWO'S. Checkbox and Switch
// each own a tab stop and toggle on space. A radio group owns ONE tab stop for the whole
// question, and the arrow keys move between answers AND choose as they go. A group that gave
// every option its own tab stop would pass every other story in this file.
export const ArrowKeysMoveBetweenAnswers: Story = {
  tags: ["!visual"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const email = canvas.getByRole("radio", { name: "Email" });
    const sms = canvas.getByRole("radio", { name: "Text message" });

    await userEvent.tab();
    expect(email).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(sms).toHaveFocus();
    // Selection FOLLOWS focus, which is the ARIA radio-group pattern rather than an accident:
    // arrowing to an answer chooses it, so a keyboard user needs no separate confirm step.
    expect(sms).toBeChecked();
    expect(email).not.toBeChecked();

    // One tab stop for the whole question: tabbing again leaves the group entirely rather than
    // landing on the third answer. That is the half a roving tabindex gets wrong when it is
    // reimplemented by hand.
    await userEvent.tab();
    expect(canvas.getByRole("radio", { name: "Do not contact me" })).not.toHaveFocus();
  },
};

// A disabled answer is SKIPPED by that same arrow-key walk rather than merely being unclickable,
// which is the difference between an answer a keyboard user cannot choose and one they have to
// arrow THROUGH to reach the next available one.
export const ArrowKeysSkipADisabledAnswer: Story = {
  tags: ["!visual"],
  args: {
    options: [
      { value: "email", label: "Email" },
      { value: "sms", label: "Text message (unavailable in your region)", isDisabled: true },
      { value: "none", label: "Do not contact me" },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.tab();
    expect(canvas.getByRole("radio", { name: "Email" })).toHaveFocus();

    await userEvent.keyboard("{ArrowDown}");
    expect(canvas.getByRole("radio", { name: "Do not contact me" })).toHaveFocus();
    expect(canvas.getByRole("radio", { name: /Text message/ })).not.toBeChecked();
  },
};
