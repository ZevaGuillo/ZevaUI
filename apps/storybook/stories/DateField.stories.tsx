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

    // ...and then get the pointer off it, because that click sets TWO states and this story only
    // wants one. RAC reports `data-hovered` on the DateInput while the pointer rests inside it,
    // and `textSurfaceBase` paints that as an `accent.default` border over the resting
    // `border.strong`. Only the focus was held; the hover was incidental and unasserted.
    //
    // Nothing kept it stable. `useHover` ends hover from a document-level `pointerover` listener
    // that the browser re-fires whenever it re-runs hit-testing — and preview.ts's capture hook
    // relayouts the page after `play` and before the screenshot. So the border was accent in some
    // runs and border.strong in others: 260 pixels, this field's 1px ring, reported as the same
    // integer by three separate CI runs. An identical pixel count across independent runs is a
    // two-state difference, not noise, which is what ruled out antialiasing and timing jitter.
    //
    // NOT `.focus()` and not `userEvent.tab()`, either of which would have been the obvious fix.
    // Both make the captured frame depend on react-aria's interaction modality, which is GLOBAL
    // document state — and `.focus()` with no preceding pointer or key event is classified as
    // `virtual`, which IS focus-visible and would draw an outline this baseline does not have.
    // Keeping the click pins the modality to `pointer` with a real `pointerdown`.
    await userEvent.unhover(firstSegment);

    // The assertion is the point, not the unhover. This runs in the plain `test` config too —
    // three themed projects, every CI run, no screenshot involved. If a future RAC version keeps
    // the field hovered, it fails here by name instead of silently rotting one PNG a third of the
    // time, which is how this cost three red runs before anyone could see the image.
    await expect(canvas.getByRole("group")).not.toHaveAttribute("data-hovered");
  },
};
