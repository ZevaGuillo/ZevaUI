import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateField } from "@zevaui/components";
import { expect, userEvent, within } from "storybook/test";

// Every story here carries a real programmatic label, so the whole file must pass the blocking
// a11y gate — including axe's color-contrast rule, which only executes in browser mode
// (ADR-0004 D7). That matters more than usual for this component: the focused segment inverts to
// `accent.default` under `text.inverse`, and this file is where that pair meets real pixels.
const meta = {
  title: "DateField",
  component: DateField,
  tags: ["visual"],
  args: {
    label: "Start date",
  },
} satisfies Meta<typeof DateField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Small: Story = {
  args: { size: "sm", label: "Start date (small)", value: "2026-09-21" },
};

export const Medium: Story = {
  args: { size: "md", label: "Start date (medium)", value: "2026-09-21" },
};

export const Large: Story = {
  args: { size: "lg", label: "Start date (large)", value: "2026-09-21" },
};

// The empty field is not a degenerate case: every segment shows its placeholder, and those are
// the only characters a user sees before typing. They are dimmed to `text.secondary`, so this is
// the story that holds that choice against the contrast rule.
export const Empty: Story = {
  args: { label: "Start date" },
};

export const WithDescription: Story = {
  args: {
    label: "Start date",
    description: "Type the date, or use the arrow keys on each part.",
  },
};

export const Required: Story = {
  args: { label: "Start date", isRequired: true },
};

export const Disabled: Story = {
  args: { label: "Start date", value: "2026-09-21", isDisabled: true },
};

export const ReadOnly: Story = {
  args: { label: "Start date", value: "2026-09-21", isReadOnly: true },
};

// The error state is not conveyed by the red border alone: FieldError renders real text and RAC
// wires it through aria-describedby, so the state survives for a user who cannot perceive the
// colour change. This story exists to keep that true under axe.
export const Invalid: Story = {
  args: {
    label: "Start date",
    value: "2026-09-21",
    isInvalid: true,
    errorMessage: "Pick a date in the future.",
  },
};

// The bounded field: RAC refuses to increment past `maxValue`, and the constraint is expressed in
// the same ISO strings the value uses — no date library at the call site.
export const Bounded: Story = {
  args: {
    label: "Start date",
    value: "2026-09-21",
    minValue: "2026-09-01",
    maxValue: "2026-09-30",
    description: "September 2026 only.",
  },
};

// An unparseable value must degrade to an empty field rather than taking down the render. This is
// the visual half of the assertion `__tests__/iso-date.test.ts` makes on the parser.
export const UnparseableValueDegrades: Story = {
  args: {
    label: "Start date",
    value: "21/09/2026",
    description: "The value is not ISO, so the field renders empty instead of throwing.",
  },
};

// The focused segment is the caret: a date field has no text cursor, so the highlight is the only
// thing telling a user which part the arrow keys will change. This story drives a real focus so
// the inverted pair is captured in the visual baseline rather than only asserted in CSS.
export const FocusedSegment: Story = {
  args: { label: "Start date", value: "2026-09-21" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [firstSegment] = canvas.getAllByRole("spinbutton");
    await userEvent.click(firstSegment);
    await expect(firstSegment).toHaveFocus();
  },
};
