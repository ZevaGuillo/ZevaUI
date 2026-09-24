import type { Meta, StoryObj } from "@storybook/react-vite";
import { Calendar } from "@zevaui/components";
import { expect } from "storybook/test";

// Every story here carries a real accessible name, so the whole file must pass the blocking a11y
// gate — including axe's color-contrast rule, which only executes in browser mode (ADR-0004 D7).
// That matters twice over for this component: the selected day inverts to `accent.default` under
// `text.inverse`, and UNAVAILABLE days stay focusable and must still clear 4.5:1, which is the
// constraint react-aria states in its own types and the reason they are not simply dimmed.
//
// A pinned `value` fixes the visible MONTH and nothing else — it does not fix today. That
// distinction cost `main` a red CI: react-aria sets `data-today` from the real system clock,
// `calendar.recipe.ts` rings `&[data-today]:not([data-selected])`, and so the ring walks one cell
// per day. The baselines were captured on 2026-09-22 and every one of these eight stories failed
// on 2026-09-24 with 175-196 pixels differing. That is not a flake, it is a baseline that rots
// daily, and regenerating the PNGs buys exactly 24 hours.
//
// So the clock is frozen instead. Scoped to THIS file on purpose: `Toast` is also captured, and
// react-aria-components drives its auto-dismiss pause/resume off `Date.now()`, so freezing time
// globally would break `Hover Pauses The Timeout` to fix a calendar.
//
// 15 September, not the 21st the stories select: a today that differs from the selection is
// strictly better evidence, because one frame then proves the ring and the fill are visually
// distinct AT THE SAME TIME. It sits inside `Bounded`'s min/max so that story rings it too, and
// 15 % 7 == 1 keeps it clear of the days `UnavailableDays` blocks.
const FROZEN_TODAY = "2026-09-15T12:00:00.000Z";

// Noon UTC, not midnight: `today()` resolves through the runner's local zone, and midnight would
// land on the previous day for any negative offset. Noon survives +/-11 hours, which covers both
// the Linux runner that authors the baselines (UTC) and a local Windows checkout.
//
// Captured at MODULE load, before anything can wrap it, and always restored to this exact
// reference rather than to whatever `Date` happened to be on entry. That is the difference
// between a leak and a self-healing one: if a story throws mid-render and Storybook never runs
// the cleanup, the next `beforeEach` would otherwise capture the PROXY as its "real" Date, nest a
// second one inside it, and restore the outer proxy forever. Pinning the pristine reference here
// makes re-entry idempotent no matter how the previous story ended.
const REAL_DATE = Date;

// A Proxy rather than a subclass, so `target` stays the real Date: `instanceof`, `Date.parse`,
// `Date.UTC` and explicit-argument construction all keep working untouched, and only the readings
// of "now" are answered from the frozen instant.
//
// Not gated on `__VISUAL_CAPTURE__`, unlike preview.ts's page scaffold, and that asymmetry is
// deliberate. The scaffold is gated because the baselines were captured WITHOUT it, so matching
// them requires the divergence. Here the opposite holds: a Calendar rendered in `storybook dev`
// on a different day than the capture is a story whose appearance nobody can reproduce, which is
// how this bug survived review in the first place. Dev and capture render the same frame.
function freezeToday(iso: string): () => void {
  const frozen = new REAL_DATE(iso).getTime();
  // Allocated ONCE, so `Date.now === Date.now` still holds while frozen. A fresh closure per
  // property read would break referential identity for anything memoising the function itself.
  const now = () => frozen;

  globalThis.Date = new Proxy(REAL_DATE, {
    construct(target, args) {
      return args.length === 0
        ? new target(frozen)
        : new (target as new (...a: unknown[]) => Date)(...args);
    },
    // `Date()` without `new` is a distinct trap: un-trapped, [[Call]] forwards straight to the
    // real target and hands back the true system time as a string, silently unfrozen. Nothing in
    // react-aria is known to take that form, which is exactly why it is cheap to close now rather
    // than to discover later.
    apply() {
      return new REAL_DATE(frozen).toString();
    },
    get(target, property, receiver) {
      return property === "now" ? now : Reflect.get(target, property, receiver);
    },
  }) as DateConstructor;

  return () => {
    globalThis.Date = REAL_DATE;
  };
}

const meta = {
  title: "Calendar",
  component: Calendar,
  tags: ["visual"],
  beforeEach: () => freezeToday(FROZEN_TODAY),
  args: {
    label: "Event date",
    value: "2026-09-21",
  },
} satisfies Meta<typeof Calendar>;

export default meta;

type Story = StoryObj<typeof meta>;

// The teeth for the freeze, and the reason this file no longer trusts a screenshot to notice.
// If a react-aria or @internationalized/date upgrade ever reads the clock by a path the Proxy
// above does not cover, FROZEN_TODAY stops applying — and the ONLY symptom would be these eight
// PNGs rotting again, on some later date, looking exactly like the flake this was mistaken for.
// Naming the invariant turns that into an assertion that fails on the spot and says why.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    const today = canvasElement.querySelector("[data-today]");
    const selected = canvasElement.querySelector("[data-selected]");

    await expect(today).toHaveTextContent("15");
    await expect(selected).toHaveTextContent("21");
    // The ring renders on `[data-today]:not([data-selected])`, so the two states are only
    // provably distinct while they sit on different cells. This is what picking the 15th over
    // the 21st buys, asserted rather than left to whoever reads the PNG.
    expect(today).not.toBe(selected);
  },
};

// A calendar with nothing chosen still has an anchor: today is ringed rather than filled, so the
// two states stay distinguishable. `Default` above is where that pays off — with today frozen to
// the 15th and the 21st selected, one frame carries a ringed cell and a filled cell at once.
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
