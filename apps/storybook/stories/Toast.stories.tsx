import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ToastOptions, ToastRegion, toast } from "@zevaui/components";
import { useEffect } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";

// Every story here must pass the blocking axe gate configured in .storybook/preview.ts
// (`a11y: { test: "error" }`), run in real Chromium. Two things it depends on:
//
//   * The region is PORTALLED to <body>, and addon-a11y scans `document.body`, so the toasts are
//     in scope rather than silently skipped — the same arrangement Dialog relies on.
//   * react-aria-components sets `aria-describedby` on every toast UNCONDITIONALLY, pointing at an
//     id it generates whether or not a description was supplied. `ToastRegion` always renders the
//     description element so that reference resolves — but NOT because this gate demands it.
//     Measured: making that element conditional left all 594 tests here green, so
//     `aria-valid-attr-value` does not fire on the dangling reference. The unit test in
//     `toast.test.ts` is what enforces it; this file must not be cited as the reason.
//
// THE QUEUE IS A MODULE SINGLETON, so a story cannot just declare its state in `args` — it has to
// seed it. Every story clears on mount and on unmount, so one story's toasts can never leak into
// the next one's baseline.
const Seeded = ({ toasts }: { readonly toasts: readonly ToastOptions[] }) => {
  useEffect(() => {
    toast.clear();
    for (const queued of toasts) {
      toast.show(queued);
    }
    return () => {
      toast.clear();
    };
  }, [toasts]);

  return <ToastRegion />;
};

// Module scope, so each array is referentially stable and the effect above runs once per story
// rather than on every render.
const SUCCESS = [{ tone: "success", title: "Changes saved" }] as const;
const DANGER = [
  { tone: "danger", title: "Upload failed", description: "The file was larger than 25 MB." },
] as const;
const WARNING = [
  { tone: "warning", title: "Connection is unstable", description: "Some changes may not sync." },
] as const;
const STACKED = [
  { tone: "success", title: "Project created" },
  { tone: "warning", title: "Connection is unstable" },
  { tone: "danger", title: "Upload failed", description: "The file was larger than 25 MB." },
] as const;
const WITH_TIMEOUT = [{ tone: "success", title: "Changes saved", timeout: 1000 }] as const;
const LONG = [
  {
    tone: "danger",
    title: "Could not publish the release",
    description:
      "The changeset referenced a package that is not part of this workspace, so the version bump was rolled back and nothing was published to the registry.",
  },
] as const;

const meta = {
  title: "Toast",
  component: ToastRegion,
  tags: ["visual"],
} satisfies Meta<typeof ToastRegion>;

export default meta;

type Story = StoryObj<typeof meta>;

// No description on purpose: the tone accent and the title alone, which is the shortest toast this
// component renders. It is also the case where RAC's unconditional `aria-describedby` points at an
// empty element — see the file header for why that is deliberate, and why this gate is not what
// proves it.
export const Success: Story = {
  render: () => <Seeded toasts={SUCCESS} />,
};

export const Danger: Story = {
  render: () => <Seeded toasts={DANGER} />,
};

export const Warning: Story = {
  render: () => <Seeded toasts={WARNING} />,
};

// THREE TOASTS, WHICH IS ALSO THE CAP. `maxVisibleToasts: 3` in toast-queue.ts, so this baseline
// is the tallest the stack can ever get — a fourth would wait in the queue rather than grow the
// column off the top of the viewport.
//
// The ORDER in this capture is the assertion. `ToastQueue.add` unshifts, so the DOM runs
// newest-first, and the recipe's `column-reverse` paints it back the other way: "Upload failed"
// was queued last and must appear at the BOTTOM, nearest the corner. If either half of that pair
// is ever changed alone, this baseline flips.
export const Stacked: Story = {
  render: () => <Seeded toasts={STACKED} />,
};

// The `inlineSize: min(24rem, ...)` cap and the `minInlineSize: 0` on the content slot, which only
// a description long enough to compete for space exercises. Without them a single long word would
// widen the toast past its own measure.
export const LongDescription: Story = {
  render: () => <Seeded toasts={LONG} />,
};

// The announcement half of the contract, and it is NOT on the dialog. react-aria-components puts
// `role="alert"` and `aria-atomic` on the CONTENT element — the dialog is what F6 navigates to,
// the content is what assistive tech reads when it appears. A toast that rendered correctly and
// announced nothing would pass every visual baseline above.
export const AnnouncesAtomically: Story = {
  tags: ["!visual"],
  render: () => <Seeded toasts={SUCCESS} />,
  play: async () => {
    const live = await screen.findByRole("alert");
    await expect(live).toHaveAttribute("aria-atomic", "true");
    await expect(screen.getByRole("alertdialog").contains(live)).toBe(true);
  },
};

// `screen`, not `within(canvasElement)`, throughout this file: the region is portalled out of the
// story root, so a canvas-scoped query would find nothing at all.
export const DismissesFromTheCloseButton: Story = {
  tags: ["!visual"],
  render: () => <Seeded toasts={SUCCESS} />,
  play: async () => {
    await expect(await screen.findByRole("alertdialog")).toBeInTheDocument();

    // The close button's accessible name comes from react-aria's own localized strings, never from
    // the glyph — that svg is `aria-hidden`. Matching case-insensitively rather than pinning the
    // exact string keeps this from breaking on a locale change it does not care about.
    await userEvent.click(screen.getByRole("button", { name: /close/i }));

    await waitFor(async () => {
      await expect(screen.queryByRole("alertdialog")).toBeNull();
    });
  },
};

// THE REASON RAC IS WORTH ITS BYTES HERE, and the one behaviour no unit test in this repo can
// reach: a toast is not in the tab order, so the only way a keyboard user gets to one is the F6
// landmark hotkey. That path needs a real browser with real focus management.
// FOCUS LANDS ON THE REGION, NOT ON THE TOAST, and that distinction was measured rather than
// assumed — the first version of this story asserted the `alertdialog` took focus and failed in
// all three themes. `useToastRegion` gives the region `tabIndex: -1` and registers it as the
// landmark, so F6 focuses the region itself; the toasts inside are reached from there. Asserting
// containment rather than an exact element keeps this honest about which node upstream picks,
// while still proving the only thing that matters: the keyboard user got in.
export const ReachableWithTheLandmarkHotkey: Story = {
  tags: ["!visual"],
  render: () => <Seeded toasts={SUCCESS} />,
  play: async () => {
    await screen.findByRole("alertdialog");
    const region = screen.getByRole("region");
    await expect(region.contains(document.activeElement)).toBe(false);

    await userEvent.keyboard("{F6}");

    await waitFor(async () => {
      const active = document.activeElement;
      await expect(active === region || region.contains(active)).toBe(true);
    });
  },
};

// Hovering the region pauses every visible timer, which is what keeps a toast from expiring while
// it is being read. Asserted as "still there after more than its own timeout", because the pause
// is only observable as an absence of the dismissal.
export const HoverPausesTheTimeout: Story = {
  tags: ["!visual"],
  render: () => <Seeded toasts={WITH_TIMEOUT} />,
  play: async () => {
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.hover(dialog);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await expect(screen.queryByRole("alertdialog")).toBeInTheDocument();
  },
};
