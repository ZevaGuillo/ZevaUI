// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, the same reason every other
// component test here is written against `React.createElement`.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { selectorSegments } from "../src/internal/selector-segments.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Popover } from "../src/popover/Popover.js";
import { popoverRecipe } from "../src/popover/popover.recipe.js";
import type { PopoverProps, PopoverSize } from "../src/popover/popover.types.js";
import { emittedStylesheet, styledClassPredicate } from "./support/emitted-css.js";

const css = emittedStylesheet();

const SIZES: readonly PopoverSize[] = ["sm", "md", "lg"];

afterEach(() => {
  cleanup();
});

function renderPopover(props: Partial<PopoverProps> = {}) {
  return render(
    createElement(Popover, {
      label: "Filters",
      title: "Filter by status",
      children: "Only open issues are shown.",
      ...props,
    } as PopoverProps),
  );
}

describe("Popover", () => {
  it("renders its own trigger and nothing else until it is opened", () => {
    renderPopover();
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens on the trigger and closes on Escape, returning focus", async () => {
    const user = userEvent.setup();
    renderPopover();

    const trigger = screen.getByRole("button", { name: "Filters" });
    await user.click(trigger);

    await screen.findByRole("dialog", { name: "Filter by status" });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});

/**
 * THE TRIGGER'S TEXT AND THE PANEL'S NAME ARE TWO DIFFERENT STRINGS, AND THAT IS WHERE THIS
 * DIVERGES FROM `Menu`.
 *
 * react-aria names a `role="menu"` from its trigger, so `Menu` needs one label. A `role="dialog"`
 * is named by its own heading instead, which react-aria finds through `Heading slot="title"` — a
 * title rendered anywhere else in the tree leaves the panel with a dangling `aria-labelledby` and
 * no accessible name at all. These assertions pin both halves: the button keeps its own words, the
 * dialog takes its name from the heading this component renders.
 */
describe("Popover names its panel from its own heading", () => {
  it("gives the dialog the title, not the trigger's label", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));

    const dialog = await screen.findByRole("dialog", { name: "Filter by status" });
    expect(screen.queryByRole("dialog", { name: "Filters" })).toBeNull();

    // The name comes from a real, drawn heading — not an `aria-label` a caller cannot see go
    // stale. See the argument on `PopoverProps.title`.
    const heading = screen.getByRole("heading", { name: "Filter by status" });
    expect(dialog.getAttribute("aria-labelledby")).toBe(heading.id);
  });

  it("renders the body the caller supplied", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await screen.findByRole("dialog");

    expect(screen.getByText("Only open issues are shown.")).toBeTruthy();
  });
});

/**
 * NON-MODAL, AND THAT IS THE WHOLE REASON THIS IS NOT A `Dialog`.
 *
 * `Dialog` goes through `ModalOverlay`, which takes the page out of the accessibility tree and
 * traps focus. This goes through `Popover`, which does neither — measured here rather than
 * assumed, because the two produce nearly identical markup and only this distinction decides which
 * component a caller should reach for.
 */
describe("Popover leaves the page behind it alone", () => {
  it("renders no scrim and marks the document with no modal attribute", async () => {
    const user = userEvent.setup();
    const { container } = renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog");

    expect(dialog.getAttribute("aria-modal")).toBeNull();
    // The trigger stays reachable in the story root rather than being replaced by an overlay.
    expect(container.querySelector("button")).toBeTruthy();
  });
});

describe("Popover class contract", () => {
  it("falls back to size=md and stamps each slot's classes", async () => {
    const user = userEvent.setup();
    renderPopover();

    await user.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = await screen.findByRole("dialog");

    const slots = slotRecipeClassNames(popoverRecipe, {});
    expect(dialog.className).toBe(slots.dialog);
    expect(screen.getByRole("heading").className).toBe(slots.title);
  });

  it("emits one class set per declared size", async () => {
    for (const size of SIZES) {
      cleanup();
      const user = userEvent.setup();
      renderPopover({ size });
      await user.click(screen.getByRole("button", { name: "Filters" }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog.className).toBe(slotRecipeClassNames(popoverRecipe, { size }).dialog);
    }
  });
});

function popoverElement(props: PopoverProps) {
  return createElement(Popover, props);
}

describe("Popover public API surface (type-level)", () => {
  it("rejects className, style, an unknown size and an unknown placement at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the typecheck the moment its
    // error disappears. What runs here is the runtime half — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      popoverElement({ className: "x", label: "l", title: "t", children: "c" }),
      // @ts-expect-error style is not part of the public API
      popoverElement({ style: {}, label: "l", title: "t", children: "c" }),
      // @ts-expect-error unknown size value
      popoverElement({ size: "xl", label: "l", title: "t", children: "c" }),
      // @ts-expect-error placement is narrowed to the four logical sides
      popoverElement({ placement: "bottom left", label: "l", title: "t", children: "c" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  // Both names are required and neither substitutes for the other: a panel with no title is a
  // `role="dialog"` with no accessible name, which fails the blocking axe gate.
  it("requires both the trigger's label and the panel's title", () => {
    const constructed = [
      // @ts-expect-error title is required
      popoverElement({ label: "l", children: "c" }),
      // @ts-expect-error label is required
      popoverElement({ title: "t", children: "c" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

describe("the emitted CSS Popover owes", () => {
  const hasRule = styledClassPredicate(css);

  it("emits a rule for every slot it styles", () => {
    for (const slot of popoverRecipe.slots) {
      expect({ [slot]: hasRule(`zui-popover__${slot}`) }).toEqual({ [slot]: true });
    }
  });

  it("emits exactly three sizes on the surface slot", () => {
    const selectors = [...new Set(css.match(/\.zui-popover__popover--size_[a-z]+/g) ?? [])];
    expect(selectors.sort()).toEqual(
      SIZES.map((size) => `.zui-popover__popover--size_${size}`).sort(),
    );
  });

  /**
   * IT TAKES MENU'S ELEVATION, NOT DIALOG'S, AND THE SHADOW IS THE ONLY THING SAYING SO.
   * `shadow.modal` means "the page behind this is unavailable" — true of a modal, false here.
   * With no borders on any overlay in this package (ADR-0005 D2), depth is the entire vocabulary
   * available for the distinction, so this assertion is the one guarding it.
   */
  it("sits at dropdown depth, never modal depth", () => {
    const base = selectorSegments(css).filter(
      (segment) => segment.selector.trim() === ".zui-popover__popover",
    );
    expect(base.length).toBeGreaterThan(0);
    const body = base
      .map((segment) =>
        css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex)),
      )
      .join(";");
    expect(body).toMatch(/box-shadow:\s*var\(--zuip-shadows-dropdown\)/);
    expect(body).not.toMatch(/--zuip-shadows-modal/);
  });

  it("never animates opacity", () => {
    const segments = selectorSegments(css).filter((segment) =>
      segment.selector.includes(".zui-popover"),
    );
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      const body = css.slice(segment.openBraceIndex + 1, css.indexOf("}", segment.openBraceIndex));
      expect(body).not.toMatch(/(^|[;\s])opacity\s*:/);
    }
  });
});
