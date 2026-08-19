import type { Meta, StoryObj } from "@storybook/react-vite";
import { Dialog } from "@zevaui/components";

// The same Vite `define` the non-portalled fixture uses (see
// vitest.shared.ts): one story renders two different titles across separate
// vitest invocations — see scripts/assert-visual-overlay-fails.js — instead
// of needing two near-duplicate stories.
declare const __VISUAL_GATE_LABEL__: string;

// The load-bearing negative fixture (D-A3). BrokenVisual.stories.tsx proves
// the gate catches a change on a normally-rendered component; this one
// proves it on the PORTALLED path, which is the failure mode the entire
// capture design exists to prevent.
//
// react-aria portals `Modal`/`ModalOverlay` out of the story root
// (packages/components/__tests__/dialog.test.ts:39-48 pins this), and this
// story renders the dialog ALONE — no trigger — so `canvasElement` is
// effectively empty. The text that varies between runs is the dialog
// TITLE, which lives inside the portal:
//
//   * If the capture frame contains the portalled node, the two runs
//     produce DIFFERENT images and the comparison FAILS. That failure is
//     the proof, and it is the only direct evidence that the frame is not
//     empty.
//   * If it does not, both runs produce the same empty (or identically
//     clipped) frame and the comparison PASSES — the silent false-PASS
//     that would otherwise let 14 of the 38 real baselines assert nothing
//     at all, forever.
//
// assert-visual-overlay-fails.js therefore reads a PASSING mismatch run as
// a FAILED gate.
//
// The tag opt-outs mirror BrokenVisual.stories.tsx (`!test` is exactly
// BrokenA11y's mechanism), plus `!visual-negative` so this fixture can
// never leak into the non-portalled gate's own isolated run.
const meta = {
  title: "Gate/BrokenVisualOverlay",
  component: Dialog,
  tags: ["visual-negative-overlay", "!test", "!visual", "!visual-negative"],
  args: {
    title: __VISUAL_GATE_LABEL__,
    description: "Every task, file and comment in this project is removed as well.",
    children: "This action cannot be undone.",
    defaultOpen: true,
  },
} satisfies Meta<typeof Dialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PortalledTitle: Story = {};
