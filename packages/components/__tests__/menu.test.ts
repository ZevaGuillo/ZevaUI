// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, exactly as `dialog.test.ts`
// explains. `React.createElement` gives the same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buttonRecipe } from "../src/button/button.recipe.js";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { recipeClassName } from "../src/internal/recipe-class.js";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Menu } from "../src/menu/Menu.js";
import { menuRecipe } from "../src/menu/menu.recipe.js";
import type { MenuItemDescriptor, MenuProps } from "../src/menu/menu.types.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(packageRoot, "dist", "styles.css"), "utf8");

// jsdom ships no global `CSS` object, and react-aria 3.51.0 calls `CSS.escape` when it resolves
// the DOM node of the focused collection item (`getItemElement`, used by every arrow-key move and
// by activating a row). That is a gap in the TEST ENVIRONMENT, not in the component: every real
// browser ships `CSS.escape`, and apps/storybook/stories/Menu.stories.tsx drives the identical
// code path in Chromium with no shim at all. Backslash-escaping everything outside `[\w-]` is a
// valid CSS identifier escape, which is all `getItemElement` needs.
const globalWithCss = globalThis as unknown as { CSS?: { escape: (value: string) => string } };
globalWithCss.CSS ??= {
  escape: (value: string) => value.replace(/[^\w-]/g, (character) => `\\${character}`),
};

afterEach(() => {
  cleanup();
});

const TRIGGER_LABEL = "Project actions";

const ITEMS: readonly MenuItemDescriptor[] = [
  { id: "rename", label: "Rename project" },
  { id: "duplicate", label: "Duplicate project", description: "Copies every task and file." },
  { id: "archive", label: "Archive project", isDisabled: true },
];

function renderMenu(props: Omit<MenuProps, "label" | "items">) {
  return render(createElement(Menu, { ...props, label: TRIGGER_LABEL, items: ITEMS }));
}

function requireElement(element: Element | null, what: string): HTMLElement {
  if (element === null) throw new Error(`expected the menu to render a ${what}`);
  return element as HTMLElement;
}

/**
 * Walks the rendered tree structurally rather than by class name, so these tests pin the DOM
 * shape RF-07 promises (the consumer can never change it) at the same time as the class names.
 * `Popover` is portalled out of the render container, so the walk starts at the one element
 * carrying `role="menu"` and climbs to its popover surface.
 */
function menuParts() {
  const menu = screen.getByRole("menu");
  const popover = requireElement(menu.parentElement, "popover");
  const items = screen.getAllByRole("menuitem") as HTMLElement[];
  const [firstItem] = items;
  const item = requireElement(firstItem ?? null, "menu item");
  const withDescription = screen.getByRole("menuitem", { name: "Duplicate project" });
  const [itemLabel] = Array.from(item.children) as HTMLElement[];
  const [, itemDescription] = Array.from(withDescription.children) as HTMLElement[];
  return {
    popover,
    menu,
    items,
    item,
    itemLabel: requireElement(itemLabel ?? null, "item label"),
    itemDescription: requireElement(itemDescription ?? null, "item description"),
  };
}

describe("Menu", () => {
  it("renders only its own trigger button while closed", () => {
    renderMenu({});
    expect(screen.getByRole("button", { name: TRIGGER_LABEL })).toBeDefined();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByRole("menuitem")).toBeNull();
  });

  it("renders the trigger as this design system's Button, never a bare element", () => {
    renderMenu({});
    expect(screen.getByRole("button", { name: TRIGGER_LABEL }).className).toBe(
      recipeClassName(buttonRecipe, { visual: "subtle" }),
    );
  });

  it("opens the menu when the trigger is pressed", async () => {
    const user = userEvent.setup();
    renderMenu({});
    await user.click(screen.getByRole("button", { name: TRIGGER_LABEL }));
    expect(await screen.findByRole("menu")).toBeDefined();
  });

  it("renders one menuitem per item, in the given order, named by its label", () => {
    renderMenu({ defaultOpen: true });
    expect(menuParts().items.map((item) => item.getAttribute("aria-labelledby"))).toHaveLength(3);
    expect(
      ITEMS.map((item) => screen.getByRole("menuitem", { name: item.label }).textContent),
    ).toEqual([
      "Rename project",
      "Duplicate projectCopies every task and file.",
      "Archive project",
    ]);
  });

  it("names the menu after its trigger, so the popover is never anonymous", () => {
    renderMenu({ defaultOpen: true });
    const { menu } = menuParts();
    const labelledBy = menu.getAttribute("aria-labelledby");
    expect(labelledBy).not.toBeNull();
    expect(document.getElementById(labelledBy ?? "")?.textContent).toBe(TRIGGER_LABEL);
  });

  it("wires each item's description through aria-describedby", () => {
    renderMenu({ defaultOpen: true });
    const withDescription = screen.getByRole("menuitem", { name: "Duplicate project" });
    const { itemDescription } = menuParts();
    expect(itemDescription.textContent).toBe("Copies every task and file.");
    expect(withDescription.getAttribute("aria-describedby")).toContain(itemDescription.id);
  });

  it("renders no description element for an item that declares none", () => {
    renderMenu({ defaultOpen: true });
    expect(screen.getByRole("menuitem", { name: "Rename project" }).children).toHaveLength(1);
  });

  it("marks a disabled item aria-disabled and never fires its action", async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();
    renderMenu({ defaultOpen: true, onAction });
    const archive = screen.getByRole("menuitem", { name: "Archive project" });
    expect(archive.getAttribute("aria-disabled")).toBe("true");
    await user.click(archive);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("reports the selected item's id and closes the menu", async () => {
    const onAction = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderMenu({ defaultOpen: true, onAction, onOpenChange });
    await user.click(screen.getByRole("menuitem", { name: "Rename project" }));
    expect(onAction).toHaveBeenCalledWith("rename");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens from the keyboard and moves focus down the items, skipping the disabled one", async () => {
    const user = userEvent.setup();
    renderMenu({});
    await user.tab();
    await user.keyboard("{ArrowDown}");

    await screen.findByRole("menu");
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Rename project" }));
    });

    await user.keyboard("{ArrowDown}");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("menuitem", { name: "Duplicate project" }),
      );
    });

    // "Archive project" is disabled, so the next ArrowDown must not land on it.
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).not.toBe(
      screen.getByRole("menuitem", { name: "Archive project" }),
    );
  });

  it("closes on Escape without reporting an action", async () => {
    const onAction = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    renderMenu({ defaultOpen: true, onAction, onOpenChange });
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onAction).not.toHaveBeenCalled();
  });

  it("applies exactly the base and default variant classes to every slot", () => {
    renderMenu({ defaultOpen: true });
    const parts = menuParts();
    expect({
      popover: parts.popover.className,
      menu: parts.menu.className,
      item: parts.item.className,
      itemLabel: parts.itemLabel.className,
      itemDescription: parts.itemDescription.className,
    }).toEqual(slotRecipeClassNames(menuRecipe, {}));
  });

  it("applies exactly the size=sm width=trigger variant classes and no others", () => {
    renderMenu({ defaultOpen: true, size: "sm", width: "trigger" });
    const parts = menuParts();
    expect({
      popover: parts.popover.className,
      menu: parts.menu.className,
      item: parts.item.className,
      itemLabel: parts.itemLabel.className,
      itemDescription: parts.itemDescription.className,
    }).toEqual(slotRecipeClassNames(menuRecipe, { size: "sm", width: "trigger" }));
  });

  it("applies exactly the size=lg width=auto variant classes and no others", () => {
    renderMenu({ defaultOpen: true, size: "lg", width: "auto" });
    const parts = menuParts();
    expect({
      popover: parts.popover.className,
      menu: parts.menu.className,
      item: parts.item.className,
      itemLabel: parts.itemLabel.className,
      itemDescription: parts.itemDescription.className,
    }).toEqual(slotRecipeClassNames(menuRecipe, { size: "lg", width: "auto" }));
  });
});

// G6 (the "use client" boundary assertion) moved to __tests__/emit-gates.test.ts, where it is
// now one registry-driven gate covering every component instead of a hand-copied block per file.

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

// Selector texts of every emitted rule whose selector list satisfies `matches`.
function ruleSelectors(matches: (selectorText: string) => boolean): string[] {
  const selectors: string[] = [];
  for (const match of css.matchAll(/([^{}]*)\{/g)) {
    if (matches(match[1])) selectors.push(match[1]);
  }
  return selectors;
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

const anyMenuRule = (selectorText: string) => selectorText.includes(".zui-menu");
const popoverRule = (selectorText: string) =>
  classSelectorPattern("zui-menu__popover").test(selectorText);
const itemRule = (selectorText: string) =>
  classSelectorPattern("zui-menu__item").test(selectorText);

// The separation decision, asserted against the real emitted stylesheet rather than the recipe
// source. `color-border-strong` measurably fails WCAG 1.4.11 non-text contrast (2.49:1 light,
// 2.66:1 dark, against a 3.0 floor — see packages/constraints/README.md), so the dropdown is
// separated from the page by `shadow-dropdown` over an opaque `color-bg-surface`, exactly as
// Dialog separates its modal with `shadow-modal`.
describe("the dropdown surface is separated by a shadow, never by a weak border", () => {
  it("emits menu rules at all (sanity check)", () => {
    expect(ruleBodies(anyMenuRule).length).toBeGreaterThan(0);
    expect(ruleBodies(popoverRule).length).toBeGreaterThan(0);
    expect(ruleBodies(itemRule).length).toBeGreaterThan(0);
  });

  it("raises the popover with shadow-dropdown", () => {
    expect(declarationsOf(popoverRule)).toMatch(/box-shadow:\s*var\(--zuip-shadows-dropdown\)/);
  });

  it("keeps the popover surface fully opaque, so the page never shows through", () => {
    expect(declarationsOf(popoverRule)).toMatch(
      /background-color:\s*var\(--zuip-colors-bg-surface\)/,
    );
  });

  it("rounds the popover with radius-card, the only surface radius this system ships", () => {
    expect(declarationsOf(popoverRule)).toMatch(/border-radius:\s*var\(--zuip-radii-card\)/);
  });

  it("never uses color-border-strong as a boundary", () => {
    expect(declarationsOf(anyMenuRule)).not.toMatch(/border-strong/);
  });

  // G3 restated for the case an overlay invites: react-aria takes outside content out of the
  // accessibility tree in JavaScript, so nothing global may be shipped from this component.
  it("ships no global reset alongside the dropdown", () => {
    expect(css).not.toMatch(/(^|[\s,{}])body\s*\{/);
    expect(css).not.toMatch(/(^|[\s,{}])html\s*\{/);
  });
});

// Item state styling must use the data attributes react-aria-components 1.20.0 ACTUALLY emits on
// `MenuItem`. Measured against the installed dist (react-aria-components 1.20.0 /
// react-aria 3.51.0), `MenuItem` sets: data-disabled, data-hovered, data-focused,
// data-focus-visible, data-pressed, data-selected, data-selection-mode, data-has-submenu and
// data-open. This Menu exposes no selection and no submenus, so only the first five are styled.
describe("item state styling targets the RAC 1.20.0 data attributes", () => {
  const attributeIsStyled = (attribute: string) =>
    ruleSelectors(itemRule).some((selectorText) => selectorText.includes(`[${attribute}]`));

  it.each(["data-hovered", "data-focused", "data-pressed", "data-focus-visible", "data-disabled"])(
    "styles the item's %s state",
    (attribute) => {
      expect({ [attribute]: attributeIsStyled(attribute) }).toEqual({ [attribute]: true });
    },
  );

  it("never styles a state MenuItem cannot reach in this API", () => {
    expect(attributeIsStyled("data-selected")).toBe(false);
    expect(attributeIsStyled("data-has-submenu")).toBe(false);
  });

  // color-text-muted over color-bg-surface is one of the pairs @zevaui/constraints validates at
  // 4.5:1, so a disabled row stays readable. A hover/press background under that foreground
  // would leave the validated pairing, which is why those states exclude disabled rows.
  it("dims a disabled item with color-text-muted and gives it no background", () => {
    // Deliberately not `includes("[data-disabled]")`: the hover/press rules carry
    // `:not([data-disabled])`, and matching those here would test the opposite of the point.
    const disabledRules = ruleBodies((selectorText) =>
      /\.zui-menu__item\[data-disabled\]/.test(selectorText),
    );
    expect(disabledRules.length).toBeGreaterThan(0);
    expect(disabledRules.join("\n")).toMatch(/color:\s*var\(--zuip-colors-text-muted\)/);
    for (const body of disabledRules) {
      expect(body).not.toMatch(/background/);
    }
  });

  it("excludes disabled rows from every hover/press/focus background rule", () => {
    const backgroundStateSelectors = ruleSelectors(
      (selectorText) =>
        itemRule(selectorText) &&
        /\[data-(hovered|pressed|focused)\]/.test(selectorText) &&
        !selectorText.includes("focus-visible"),
    );
    expect(backgroundStateSelectors.length).toBeGreaterThan(0);
    for (const selectorText of backgroundStateSelectors) {
      expect(selectorText).toContain(":not([data-disabled])");
    }
  });
});

// Routed through a plain function typed as `MenuProps` (rather than a direct call to
// `createElement`) so the excess-property/type checks below still apply to a fresh object
// literal, and so `createElement`'s own overloads cannot widen anything away.
function menuElement(props: MenuProps) {
  return createElement(Menu, props);
}

describe("Menu public API surface (type-level)", () => {
  it("rejects className, style and unknown variant values at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the
    // typecheck the moment its error disappears. What runs here is the
    // runtime half of the contract — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      menuElement({ className: "x", label: "l", items: ITEMS }),
      // @ts-expect-error style is not part of the public API
      menuElement({ style: {}, label: "l", items: ITEMS }),
      // @ts-expect-error unknown size value
      menuElement({ size: "nope", label: "l", items: ITEMS }),
      // @ts-expect-error unknown width value
      menuElement({ width: "nope", label: "l", items: ITEMS }),
      // @ts-expect-error children would be structural variation, which RF-07 forbids
      menuElement({ children: "x", label: "l", items: ITEMS }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
