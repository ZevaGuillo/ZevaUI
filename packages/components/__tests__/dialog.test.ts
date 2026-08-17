// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin (`@vitejs/plugin-react` is not a
// dependency here, and adding it just for tests would be an extra build-pipeline dependency).
// `React.createElement` gives the exact same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on, without that extra dependency.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dialog } from "../src/dialog/Dialog.js";
import { dialogRecipe } from "../src/dialog/dialog.recipe.js";
import type { DialogProps } from "../src/dialog/dialog.types.js";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(packageRoot, "dist", "styles.css"), "utf8");

afterEach(() => {
  cleanup();
});

// `DialogProps.children` and `.title` are required, so they must live on the props object itself
// for `createElement`'s overload resolution (and the excess-property checks below) to see them.
function renderDialog(props: Omit<DialogProps, "children">, children: ReactNode) {
  return render(createElement(Dialog, { ...props, children }));
}

function requireElement(element: Element | null, what: string): HTMLElement {
  if (element === null) throw new Error(`expected the dialog to render a ${what}`);
  return element as HTMLElement;
}

/**
 * Walks the rendered tree structurally rather than by class name, so these tests pin the DOM
 * shape RF-07 promises (the consumer can never change it) at the same time as the class names.
 * `Modal` and `ModalOverlay` are portalled out of the render container, so the walk starts from
 * the one element with a role and climbs.
 */
function dialogParts() {
  const content = screen.getByRole("dialog");
  const modal = requireElement(content.parentElement, "modal");
  const overlay = requireElement(modal.parentElement, "overlay");
  const [header, body, footer] = Array.from(content.children) as HTMLElement[];
  const [title, closeButton, description] = Array.from(
    requireElement(header ?? null, "header").children,
  ) as HTMLElement[];
  return { overlay, modal, content, header, title, closeButton, description, body, footer };
}

describe("Dialog", () => {
  it("renders a dialog whose accessible name is the title", () => {
    renderDialog({ title: "Delete project", defaultOpen: true }, "This cannot be undone.");
    expect(screen.getByRole("dialog", { name: "Delete project" })).toBeDefined();
  });

  it("renders the title as a level-2 heading", () => {
    renderDialog({ title: "Delete project", defaultOpen: true }, "Body");
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Delete project");
  });

  it("renders the children as the dialog body", () => {
    renderDialog({ title: "Delete project", defaultOpen: true }, "This cannot be undone.");
    expect(dialogParts().body.textContent).toBe("This cannot be undone.");
  });

  it("renders nothing at all while closed", () => {
    renderDialog({ title: "Delete project", isOpen: false }, "Body");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("points aria-describedby at the rendered description", () => {
    renderDialog(
      { title: "Delete project", defaultOpen: true, description: "Every task is removed too." },
      "Body",
    );
    const { content, description } = dialogParts();
    expect(description.textContent).toBe("Every task is removed too.");
    expect(content.getAttribute("aria-describedby")).toBe(description.id);
  });

  it("renders no description element and no aria-describedby when none is given", () => {
    renderDialog({ title: "Delete project", defaultOpen: true }, "Body");
    const { content, header } = dialogParts();
    expect(header.children).toHaveLength(2);
    expect(content.hasAttribute("aria-describedby")).toBe(false);
  });

  it("renders the footer content when given, and no footer element otherwise", () => {
    const { unmount } = renderDialog(
      { title: "Delete project", defaultOpen: true, footer: "Actions go here" },
      "Body",
    );
    expect(dialogParts().footer.textContent).toBe("Actions go here");
    unmount();

    renderDialog({ title: "Delete project", defaultOpen: true }, "Body");
    expect(dialogParts().content.children).toHaveLength(2);
  });

  it("applies exactly the base and default variant classes to every slot", () => {
    renderDialog(
      {
        title: "Delete project",
        defaultOpen: true,
        description: "Every task is removed too.",
        footer: "Actions",
      },
      "Body",
    );
    const parts = dialogParts();
    expect({
      overlay: parts.overlay.className,
      modal: parts.modal.className,
      content: parts.content.className,
      header: parts.header.className,
      title: parts.title.className,
      description: parts.description.className,
      body: parts.body.className,
      footer: parts.footer.className,
    }).toEqual(slotRecipeClassNames(dialogRecipe, {}));
  });

  it("applies exactly the size=lg placement=top variant classes and no others", () => {
    renderDialog(
      {
        title: "Delete project",
        defaultOpen: true,
        size: "lg",
        placement: "top",
        description: "Every task is removed too.",
        footer: "Actions",
      },
      "Body",
    );
    const parts = dialogParts();
    expect({
      overlay: parts.overlay.className,
      modal: parts.modal.className,
      content: parts.content.className,
      header: parts.header.className,
      title: parts.title.className,
      description: parts.description.className,
      body: parts.body.className,
      footer: parts.footer.className,
    }).toEqual(slotRecipeClassNames(dialogRecipe, { size: "lg", placement: "top" }));
  });

  it("moves focus into the dialog when it opens", async () => {
    renderDialog({ title: "Delete project", defaultOpen: true }, "Body");
    const { content } = dialogParts();
    await waitFor(() => {
      expect(content.contains(document.activeElement)).toBe(true);
    });
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog({ title: "Delete project", defaultOpen: true, onOpenChange }, "Body");
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes when the close control is pressed", async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderDialog({ title: "Delete project", defaultOpen: true, onOpenChange }, "Body");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("labels the close control with the given closeLabel", () => {
    renderDialog({ title: "Delete project", defaultOpen: true, closeLabel: "Dismiss" }, "Body");
    expect(dialogParts().closeButton.textContent).toBe("Dismiss");
  });
});

describe('G6: the emitted Dialog module ships the "use client" directive', () => {
  it("starts dist/dialog/Dialog.js with the client boundary directive", () => {
    const built = readFileSync(join(packageRoot, "dist", "dialog", "Dialog.js"), "utf8");
    expect(built.startsWith('"use client";')).toBe(true);
  });
});

// Raw contents between the matching braces of the block that opens at `openBraceIndex`.
function blockAt(source: string, openBraceIndex: number): string {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openBraceIndex + 1, i);
    }
  }
  throw new Error("emitted CSS has a rule block with no matching closing brace");
}

// Bodies of every emitted rule whose selector list satisfies `matches`. Panda collapses rules
// with identical declaration blocks into one comma-separated selector list, so a predicate over
// the whole selector text is the only reliable way to collect a class's rules.
function ruleBodies(matches: (selectorText: string) => boolean): string[] {
  const bodies: string[] = [];
  for (const match of css.matchAll(/([^{}]*)\{/g)) {
    if (!matches(match[1])) continue;
    bodies.push(blockAt(css, (match.index ?? 0) + match[0].length - 1));
  }
  return bodies;
}

const declarationsOf = (matches: (selectorText: string) => boolean): string =>
  ruleBodies(matches).join("\n");

const OPACITY_DECLARATION = /(^|[\s;{])opacity\s*:/;

// The scrim decision, asserted against the real emitted stylesheet rather than the recipe source:
// `ModalOverlay` is the full-screen scrim container and `Modal` renders INSIDE it, so an `opacity`
// on the overlay would fade the dialog with the backdrop. Translucency therefore has to come out
// of the scrim's own color channel. A literal color is forbidden (G2), so it is derived from the
// `color-bg-inverse` semantic token with `color-mix`, which keeps the token bridge intact (G4).
describe("the scrim is translucent without fading the modal content", () => {
  const anyDialogRule = (selectorText: string) => selectorText.includes(".zui-dialog");
  const overlayBaseRule = (selectorText: string) =>
    classSelectorPattern("zui-dialog__overlay").test(selectorText);
  const modalBaseRule = (selectorText: string) =>
    classSelectorPattern("zui-dialog__modal").test(selectorText);

  it("emits dialog rules at all (sanity check)", () => {
    expect(ruleBodies(anyDialogRule).length).toBeGreaterThan(0);
    expect(ruleBodies(overlayBaseRule).length).toBeGreaterThan(0);
    expect(ruleBodies(modalBaseRule).length).toBeGreaterThan(0);
  });

  it("never declares opacity in any dialog rule, so nothing can fade a descendant", () => {
    for (const body of ruleBodies(anyDialogRule)) {
      expect(body).not.toMatch(OPACITY_DECLARATION);
    }
  });

  it("derives the scrim from the color-bg-inverse token with a transparent color-mix", () => {
    expect(declarationsOf(overlayBaseRule)).toMatch(
      /background-color:\s*color-mix\([^;]*var\(--zuip-colors-bg-inverse\)[^;]*transparent[^;]*\)/,
    );
  });

  it("keeps the modal surface fully opaque on top of that scrim", () => {
    expect(declarationsOf(modalBaseRule)).toMatch(
      /background-color:\s*var\(--zuip-colors-bg-surface\)/,
    );
  });

  it("separates the modal from the page with shadow-modal, not a border", () => {
    expect(declarationsOf(modalBaseRule)).toMatch(/box-shadow:\s*var\(--zuip-shadows-modal\)/);
  });

  // color-border-strong measurably fails WCAG 1.4.11 non-text contrast in both base themes
  // (2.49:1 light, 2.66:1 dark, against a 3.0 floor) — see packages/constraints/README.md.
  it("never uses color-border-strong as a boundary", () => {
    expect(declarationsOf(anyDialogRule)).not.toMatch(/border-strong/);
  });

  // G3 restated for the case a modal specifically invites: RAC scroll-locks in JavaScript, so
  // shipping a component-owned `body { overflow: hidden }` would be a global reset, not a fix.
  it("ships no global scroll lock", () => {
    expect(css).not.toMatch(/(^|[\s,{}])body\s*\{/);
    expect(css).not.toMatch(/(^|[\s,{}])html\s*\{/);
  });
});

// Routed through a plain function typed as `DialogProps` (rather than a direct call to
// `createElement`) so the excess-property/type checks below still apply to a fresh object
// literal, without tripping Biome's `noChildrenProp` rule on a raw `createElement` call.
function dialogElement(props: DialogProps) {
  return createElement(Dialog, props);
}

describe("Dialog public API surface (type-level)", () => {
  it("rejects className, style and unknown variant values at compile time", () => {
    // @ts-expect-error className is not part of the public API
    dialogElement({ className: "x", title: "t", children: "x" });
    // @ts-expect-error style is not part of the public API
    dialogElement({ style: {}, title: "t", children: "x" });
    // @ts-expect-error unknown size value
    dialogElement({ size: "nope", title: "t", children: "x" });
    // @ts-expect-error unknown placement value
    dialogElement({ placement: "nope", title: "t", children: "x" });
  });
});
