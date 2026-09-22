import type { Meta, StoryObj } from "@storybook/react-vite";
import { DatePicker } from "@zevaui/components";

// Every story here carries a real accessible name, so the whole file must pass the blocking a11y
// gate — including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7).
//
// The closed states are what the visual baseline captures. A story cannot open the popover by
// itself, so the panel's own contrast is covered where it already was: `Calendar.stories.tsx`
// renders the SAME component this picker puts inside its popover — which is the practical payoff
// of composing it rather than writing a second month grid for an overlay.
//
// Every story pins an explicit `value`, so the baseline is a fixed date rather than whatever day
// CI happens to run on.
const meta = {
  title: "DatePicker",
  component: DatePicker,
  tags: ["visual"],
  args: {
    label: "Trip date",
    value: "2026-09-21",
  },
} satisfies Meta<typeof DatePicker>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The size axis moves the BOX only. Rendering the three steps is what shows that a picker and an
// `Input` or a `DateField` stand at the same height in one form column, which is the whole reason
// the axis reads `internal/text-surface.ts` instead of declaring its own padding.
export const Small: Story = {
  args: { size: "sm" },
};

export const Large: Story = {
  args: { size: "lg" },
};

export const Empty: Story = {
  args: { value: null },
};

export const WithDescription: Story = {
  args: { description: "Arrival day. Type it or pick it from the calendar." },
};

// The error state is not conveyed by colour alone: FieldError renders real text, so the state
// survives for a user who cannot perceive the colour change. It is stated ONCE — the Calendar
// inside the popover has a FieldError of its own and it stays silent.
export const Invalid: Story = {
  args: {
    isInvalid: true,
    errorMessage: "That day is fully booked.",
  },
};

export const Disabled: Story = {
  args: { isDisabled: true },
};

export const ReadOnly: Story = {
  args: { isReadOnly: true },
};

// The bounds reach BOTH halves of the component: the segments refuse a date outside them and the
// calendar announces those days as disabled. That second half travels through react-aria's
// context, and it is the behaviour a probe was written for before this component existed.
export const Bounded: Story = {
  args: {
    minValue: "2026-09-01",
    maxValue: "2026-09-30",
  },
};

// The reason most teams need a picker rather than a field. The predicate takes an ISO string, so
// blocking weekends needs no date library at the call site.
export const UnavailableDays: Story = {
  args: {
    isDateUnavailable: (date) => {
      const day = Number(date.slice(-2));
      return day % 7 === 0 || day % 7 === 6;
    },
  },
};

// An unparseable value must clear the field rather than taking down the render. This is the visual
// half of the assertion `__tests__/date-picker.test.ts` makes on the parser.
export const UnparseableValueClearsTheField: Story = {
  args: { value: "21/09/2026" },
};
