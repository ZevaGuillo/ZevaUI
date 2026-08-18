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

// __VISUAL_CAPTURE__ is resolved per CONFIG (vitest.shared.ts), not per
// story: `visual` and `test` are not mutually exclusive — the 6 real story
// files carry BOTH — so a story's own tags can never tell this hook which
// vitest run is executing it. Each config bakes in `true`/`false` at
// config-load time from its own tags.include, so the normal `test` run and
// the a11y gate both resolve `false` here regardless of which tags an
// individual story carries, and this hook is a true no-op there.
declare const __VISUAL_CAPTURE__: boolean;

// The target width for the capture box, and for the widened
// #vitest-tester container below — see the afterEach comment for how this
// number was measured, not assumed.
const CAPTURE_WIDTH_PX = "1200px";

const preview: Preview = {
  parameters: {
    // Any axe violation fails the story's test — this is the gate G-A11Y
    // relies on. See apps/storybook/scripts/assert-gate-fails.js.
    a11y: { test: "error" },
  },
  // Fail-closed visual capture (D-A2): every story tagged `visual` is
  // screenshotted automatically, with no per-story wiring to forget, in
  // any run whose own config selects `visual` or `visual-negative` (see
  // __VISUAL_CAPTURE__ above). The normal `test` run and the a11y gate
  // both resolve that constant to `false`, so they are unaffected by this
  // hook regardless of which tags an individual story carries.
  async afterEach({ canvasElement }) {
    if (!__VISUAL_CAPTURE__) return;

    // The capture target is the pinned VIEWPORT, not the bare
    // `canvasElement` box (D-A1): react-aria portals `ModalOverlay`/
    // `Popover` out of the story root, so an unmodified element screenshot
    // would silently pass for an empty or trigger-only canvas.
    // `minHeight: 100vh` pins the frame height to the viewport.
    canvasElement.style.minHeight = "100vh";
    canvasElement.style.width = CAPTURE_WIDTH_PX;

    // decisions-round-3 (width override) — measured, not assumed, per the
    // PR4 gatekeeper finding: `canvasElement.style.width` alone genuinely
    // resizes canvasElement to its OWN iframe's internal width (measured
    // 1200px, matching that iframe's own window.innerWidth against a
    // 1280px pinned viewport), but @storybook/addon-vitest wraps that
    // iframe in its OWN `#vitest-tester` container, which renders at only
    // ~75% of the outer viewport (measured 960px) — entirely OUTSIDE
    // canvasElement's box model, so no override on canvasElement itself
    // can reach it.
    //
    // That container IS reachable, though: the story iframe is same-origin
    // with its host, so `window.parent.document` resolves. Measured by
    // widening #vitest-tester from inside this hook: an explicit pixel
    // width plus `max-width: none` (a bare `100vw` there only reached
    // ~1024px, short of the 1200px target — #vitest-tester's own
    // containing block isn't the pinned 1280px viewport) moved the
    // rendered container, and every captured frame, from 960x720 to the
    // full 1200px-wide iframe. 1200 (the story iframe's own width) is the
    // right target, not 1280 (the outer viewport): the scrim covers the
    // iframe's own viewport, which is what a user actually sees.
    //
    // Guarded: if window.parent is ever cross-origin, or the container is
    // absent (a future addon-vitest version renaming or removing it), this
    // degrades to a no-op rather than throwing — the capture still runs at
    // the unwidened (clipped) box instead of crashing the whole test.
    try {
      const tester = window.parent.document.getElementById("vitest-tester");
      tester?.style.setProperty("width", CAPTURE_WIDTH_PX, "important");
      tester?.style.setProperty("max-width", "none", "important");
      // addon-vitest also sets an inline `transform: scale(0.8)` on this
      // same element (its own "fit story into the visible pane" zoom) —
      // measured directly: width alone left getBoundingClientRect() at
      // 960 (1200 * 0.8) despite computedWidth already reading 1200px.
      // getBoundingClientRect() reports the POST-transform rendered size,
      // which is what Playwright's screenshot actually captures, so the
      // scale has to be neutralized too, or the width override is
      // invisible to the capture regardless of its own CSS value.
      tester?.style.setProperty("transform", "none", "important");
      // #vitest-tester's own inline height (measured 900px) was ALSO only
      // ever rendering at the pinned 720px because of that same 0.8 scale
      // (900 * 0.8 = 720) — a coincidental byproduct of addon-vitest's own
      // fit-to-pane sizing, not a real link to the pinned viewport. With
      // the scale neutralized, that 900px renders unscaled unless pinned
      // explicitly, so it is pinned here too, to the same 720px the rest
      // of this project already assumes (vitest.shared.ts's contextOptions,
      // and every existing capture/baseline).
      tester?.style.setProperty("height", "720px", "important");
    } catch {
      // Cross-origin or otherwise inaccessible parent document.
    }

    await expect
      .element(page.elementLocator(canvasElement))
      .toMatchScreenshot({ comparatorOptions: { allowedMismatchedPixels: 0, threshold: 0.1 } });
  },
};

export default preview;
