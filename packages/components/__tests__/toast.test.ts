// @vitest-environment jsdom
//
// JSX is intentionally NOT used here, for the reason `button.test.ts` gives: this file stays
// `.test.ts` so the package's Vitest setup needs no JSX transform plugin.
//
// THE QUEUE IS A MODULE SINGLETON, which is a deliberate design decision and also the one thing
// that makes this file's hygiene matter more than most. `toast.show()` has to be callable from a
// submit handler, a router guard, or a `catch` block — places with no React context to read — so
// the queue cannot live in a provider. The cost is shared state between tests, paid off in
// `afterEach` rather than worked around per test.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { ToastRegion } from "../src/toast/ToastRegion.js";
import { toastRecipe } from "../src/toast/toast.recipe.js";
import type { ToastOptions } from "../src/toast/toast.types.js";
import { toast } from "../src/toast/toast-queue.js";

afterEach(() => {
  act(() => {
    toast.clear();
  });
  cleanup();
});

const showToast = (options: ToastOptions) => {
  let key = "";
  act(() => {
    key = toast.show(options);
  });
  return key;
};

const renderRegion = () => render(createElement(ToastRegion));

describe("Toast", () => {
  // The region PORTALS to the document body and renders nothing at all while the queue is empty —
  // measured in RAC's source, where the whole subtree is gated on
  // `state.visibleToasts.length > 0 && portalContainer`. Asserting the empty case explicitly
  // matters because every other test here queries `screen` (the body), so a region that rendered
  // an always-present empty container would go unnoticed while shipping a stray landmark that
  // screen-reader users would hear listed on every page.
  it("renders nothing until a toast is queued", () => {
    renderRegion();
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("renders a queued toast as an alertdialog named by its title", () => {
    renderRegion();
    showToast({ tone: "success", title: "Changes saved" });
    expect(screen.getByRole("alertdialog", { name: "Changes saved" })).toBeTruthy();
  });

  // THE ANNOUNCEMENT, and it does not live on the alertdialog. RAC puts `role="alert"` and
  // `aria-atomic="true"` on the CONTENT element, not the dialog — the dialog is the thing a
  // keyboard user lands on via F6, while the content is the thing assistive tech reads out when it
  // appears. Asserting the dialog alone would leave a toast that renders correctly and announces
  // nothing, which is a toast that does not work.
  it("announces through an atomic live region inside the dialog", () => {
    renderRegion();
    showToast({ tone: "success", title: "Changes saved" });

    const live = screen.getByRole("alert");
    expect(live.getAttribute("aria-atomic")).toBe("true");
    expect(screen.getByRole("alertdialog").contains(live)).toBe(true);
  });

  it("wires the description as the dialog's accessible description", () => {
    renderRegion();
    showToast({ tone: "danger", title: "Upload failed", description: "The file was too large." });

    const dialog = screen.getByRole("alertdialog");
    const describedBy = dialog.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(describedBy)?.textContent).toBe("The file was too large.");
  });

  // RAC sets `aria-describedby` on the dialog UNCONDITIONALLY, pointing at an id it generates
  // whether or not anything renders with that id. `ToastRegion` therefore always renders the
  // description element and the recipe collapses it with `&:empty`.
  //
  // THIS ASSERTION IS THE ONLY THING ENFORCING THAT, which is the opposite of what was assumed
  // while writing it. The first version of this comment claimed the blocking axe gate would fail
  // on the dangling reference. Making the element conditional and running the whole Storybook
  // suite DISPROVED it — all 594 tests stayed green and `aria-valid-attr-value` never fired. A
  // reference to an id nothing owns is invalid regardless of who checks, so the behaviour stays;
  // it simply has no gate behind it except this test.
  it("leaves no dangling aria-describedby when no description is supplied", () => {
    renderRegion();
    showToast({ tone: "success", title: "Changes saved" });

    const describedBy = screen.getByRole("alertdialog").getAttribute("aria-describedby") ?? "";
    expect({ describedBy, resolves: document.getElementById(describedBy) !== null }).toEqual({
      describedBy,
      resolves: true,
    });
  });

  it("closes the toast from its close button", async () => {
    const user = userEvent.setup();
    renderRegion();
    showToast({ tone: "success", title: "Changes saved" });

    await user.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("closes the toast from the key show() returned", () => {
    renderRegion();
    const key = showToast({ tone: "success", title: "Changes saved" });
    expect(screen.getByRole("alertdialog")).toBeTruthy();

    act(() => {
      toast.dismiss(key);
    });
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  // `timeout` is the only prop here that cannot be observed without controlling the clock. Fake
  // timers rather than a real wait, so the suite does not spend the toast's own lifetime proving
  // it has one.
  it("auto-dismisses after the supplied timeout", () => {
    vi.useFakeTimers();
    try {
      renderRegion();
      showToast({ tone: "success", title: "Changes saved", timeout: 5000 });
      expect(screen.getByRole("alertdialog")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.queryByRole("alertdialog")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps a toast with no timeout on screen indefinitely", () => {
    vi.useFakeTimers();
    try {
      renderRegion();
      showToast({ tone: "success", title: "Changes saved" });

      act(() => {
        vi.advanceTimersByTime(600_000);
      });
      expect(screen.getByRole("alertdialog")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  // NEWEST FIRST IN THE DOM, and that is upstream's decision rather than this package's:
  // `ToastQueue.add` does `this.queue.unshift(toast)`, measured in react-stately's source. The
  // first version of this test asserted chronological order and failed, which is the useful kind
  // of failure — the assumption was wrong, not the code.
  //
  // It is pinned here because it is load-bearing in two directions. A screen-reader user
  // navigating the region meets the most recent message first, which is the one most likely to
  // still matter. And the recipe's `flexDirection: column-reverse` is calibrated against exactly
  // this order: it paints the first DOM node LAST, so the newest toast lands nearest the corner
  // the stack is anchored to and older ones ride upward. Flip either one alone and the newest
  // toast quietly moves to the far end of the stack.
  it("puts the newest toast first in the DOM, which the reversed column paints nearest the edge", () => {
    renderRegion();
    showToast({ tone: "success", title: "First" });
    showToast({ tone: "warning", title: "Second" });

    const titles = screen
      .getAllByRole("alertdialog")
      .map((dialog) => dialog.textContent?.trim() ?? "");
    expect(titles[0]).toContain("Second");
    expect(titles[1]).toContain("First");
  });

  it("applies exactly the tone's slot classes and no others", () => {
    renderRegion();
    showToast({ tone: "danger", title: "Upload failed" });

    const expected = slotRecipeClassNames(toastRecipe, { tone: "danger" });
    expect(screen.getByRole("alertdialog").className).toBe(expected.toast);
  });

  // The region is a LANDMARK, which is what makes the F6 hotkey work and what lets a screen-reader
  // user navigate to a toast they heard but did not act on. It exists only while toasts do.
  it("exposes the toast area as a landmark region", () => {
    renderRegion();
    showToast({ tone: "success", title: "Changes saved" });
    expect(screen.getByRole("region")).toBeTruthy();
  });

  // `clear()` is public API rather than a test-only affordance: a route change or a sign-out
  // should not leave a stale toast from the previous screen floating over the new one.
  it("clears every visible toast at once", () => {
    renderRegion();
    showToast({ tone: "success", title: "First" });
    showToast({ tone: "warning", title: "Second" });

    act(() => {
      toast.clear();
    });
    expect(screen.queryAllByRole("alertdialog")).toHaveLength(0);
  });
});

describe("Toast public API surface (type-level)", () => {
  it("rejects a missing title, an unknown tone, and styling props", () => {
    // tsc asserts the rejection: each @ts-expect-error fails the typecheck the moment its error
    // disappears. What runs here is the runtime half — a rejected option object is still an
    // object, so this proves the assertions above are about types rather than throwing.
    const rejected = [
      // @ts-expect-error title is required — it is the alertdialog's accessible name
      { tone: "success" } satisfies ToastOptions,
      // @ts-expect-error unknown tone
      { tone: "info", title: "x" } satisfies ToastOptions,
      // @ts-expect-error styling is owned by the design system
      { tone: "success", title: "x", className: "x" } satisfies ToastOptions,
    ];
    expect(rejected).toHaveLength(3);
  });

  it("constructs a valid element for the region with no props at all", () => {
    expect(isValidElement(createElement(ToastRegion))).toBe(true);
  });
});
