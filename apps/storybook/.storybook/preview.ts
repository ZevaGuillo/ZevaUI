// Order matters: `@zevaui/components/styles.css` is a chain of
// `var(--zui-*)` pointers (see ADR-0004 D2) that only resolve once the
// token layer's custom properties exist. Reversing this import order ships
// components with unresolved CSS variables.
import "@zevaui/tokens/styles.css";
import "@zevaui/components/styles.css";
import type { Preview } from "@storybook/react-vite";
// `vitest/browser`, never the deprecated `@vitest/browser/context` (it
// warns) — both re-export the same provider context, but only this path is
// current. `expect` from `vitest` itself: `preview.ts` is not a test file,
// so it never gets the implicit per-test-file global vitest injects, and
// `toMatchScreenshot` is a custom matcher registered on this exact `expect`
// instance by the browser provider's own setup.
import { expect } from "vitest";
import { page } from "vitest/browser";

const preview: Preview = {
  parameters: {
    // Any axe violation fails the story's test — this is the gate G-A11Y
    // relies on. See apps/storybook/scripts/assert-gate-fails.js.
    a11y: { test: "error" },
  },
  // Fail-closed visual capture (D-A2): every story tagged `visual` is
  // screenshotted automatically, with no per-story wiring to forget. The
  // normal `test` run and the a11y gate never carry the `visual` tag, so
  // they are unaffected by this hook.
  //
  // The capture target is the pinned VIEWPORT, not the bare `canvasElement`
  // box (D-A1): react-aria portals `ModalOverlay`/`Popover` out of the
  // story root, so an unmodified element screenshot would silently pass for
  // an empty or trigger-only canvas. `minHeight: 100vh` pins the frame
  // height to the viewport.
  //
  // `width: 100vw` (decisions-round-3) is kept here as specified, but
  // measured to have NO effect on the captured frame — see the PR4
  // gatekeeper finding. `canvasElement` genuinely resizes to its own
  // iframe's full width (measured 1200px against a 1280px pinned viewport),
  // but @storybook/addon-vitest's own test-runner harness wraps that iframe
  // in a `#vitest-tester` container that itself renders at ~75% of the
  // outer viewport (measured 960px), entirely OUTSIDE canvasElement's box
  // model. Every capture in this repo is therefore still 960px wide; the
  // ADR-0005 scrim clipping the PR3 gatekeeper found is NOT fixed by this
  // override. Left in place rather than silently reverted, per instruction:
  // it is harmless, documents the attempt, and the finding is recorded
  // honestly instead of papered over.
  async afterEach({ tags, canvasElement }) {
    // Empirically probed (a throwing afterEach, per the S-A spike's own
    // methodology — a silent probe here is not evidence): `!visual` on
    // BrokenVisual.stories.tsx resolves to no-op, since the story never
    // carries `visual` to begin with, so tags there are exactly
    // `["dev", "visual-negative"]`. `visual-negative` must also open the
    // gate, or the negative fixture could never exercise this hook. This
    // does not risk sweeping the fixture into the real vitest.visual.config
    // run — that config's OWN `include: ["visual"]` tag filter (not this
    // guard) is what selects which stories run there, and BrokenVisual
    // never carries `visual`.
    if (!tags.includes("visual") && !tags.includes("visual-negative")) return;
    canvasElement.style.minHeight = "100vh";
    canvasElement.style.width = "100vw";
    await expect
      .element(page.elementLocator(canvasElement))
      .toMatchScreenshot({ comparatorOptions: { allowedMismatchedPixels: 0, threshold: 0.1 } });
  },
};

export default preview;
