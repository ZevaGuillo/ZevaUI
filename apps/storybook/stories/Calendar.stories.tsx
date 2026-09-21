import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar } from "@zevaui/components";

// Every story here carries a real accessible name, so the whole file must pass the blocking a11y
// gate — including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7).
// That matters twice over for this component: the selected day inverts to `accent.default` under
// `text.inverse`, and UNAVAILABLE days stay focusable and must still clear 4.5:1, which is the
// constraint react-aria states in its own types and the reason they are not simply dimmed.
//
// Every story pins an explicit `value`, so the visual baseline is a fixed month rather than
// whatever month CI happens to run in.
const meta = {
  title: "Calendar",
  component: Calendar,
  tags: ["visual"],
  args: {
    label: "Event date",
    value: "2026-09-21",
  },
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// A calendar with nothing chosen still has an anchor: today is ringed rather than filled, so the
// two states stay distinguishable when today IS the selected day.
export const NothingSelected: Story = {
  args: { value: null },
};

export const Bounded: Story = {
  args: {
    minValue: "2026-09-01",
    maxValue: "2026-09-30",
  },
};

// The reason most teams need a calendar at all. The predicate takes an ISO string, so blocking
// weekends needs no date library at the call site — just the day number arithmetic every consumer
// already knows how to write.
export const UnavailableDays: Story = {
  args: {
    isDateUnavailable: (date) => {
      const day = Number(date.slice(-2));
      return day % 7 === 0 || day % 7 === 6;
    },
  },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

export const ReadOnly: Story = {
  args: { isReadOnly: true },
};

// The error state is not conveyed by colour alone: FieldError renders real text, so the state
// survives for a user who cannot perceive the colour change.
export const Invalid: Story = {
  args: {
    isInvalid: true,
    errorMessage: "That date is already booked.",
  },
};

// An unparseable value must select nothing rather than taking down the render. This is the visual
// half of the assertion `__tests__/calendar.test.ts` makes on the parser.
export const UnparseableValueSelectsNothing: Story = {
  args: { value: "21/09/2026" },
};
