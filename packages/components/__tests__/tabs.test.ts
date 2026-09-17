// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin, exactly as `dialog.test.ts`
// explains. `React.createElement` gives the same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { slotRecipeClassNames } from "../src/internal/slot-recipe-class.js";
import { Tabs } from "../src/tabs/Tabs.js";
import { tabsRecipe } from "../src/tabs/tabs.recipe.js";
import type { TabDescriptor, TabsProps } from "../src/tabs/tabs.types.js";
import { emittedStylesheet, ruleBody } from "./support/emitted-css.js";

const css = emittedStylesheet();

// The same shim `menu.test.ts` installs, for the same measured reason: jsdom ships no global
// `CSS` object, and react-aria 3.51.0 calls `CSS.escape` when it resolves the DOM node of the
// focused collection item — which every arrow-key move goes through. That is a gap in the TEST
// ENVIRONMENT, not in the component; Chromium ships `CSS.escape` and the stories drive the same
// path with no shim. Without it the arrow-key tests below die with
// "Cannot read properties of undefined (reading 'escape')", which is how this was found.
const globalWithCss = globalThis as unknown as { CSS?: { escape: (value: string) => string } };
globalWithCss.CSS ??= {
  escape: (value: string) => value.replace(/[^\w-]/g, (character) => `\\${character}`),
};

afterEach(cleanup);

const TABS: readonly TabDescriptor[] = [
  { id: "overview", label: "Overview", content: "What it does" },
  { id: "usage", label: "Usage", content: "How to call it" },
  { id: "api", label: "API", content: "Every prop" },
];

const renderTabs = (props: Partial<TabsProps> = {}) =>
  render(createElement(Tabs, { label: "Sections", tabs: TABS, ...props }));

const tabNames = () => screen.getAllByRole("tab").map((tab) => tab.textContent);
const selectedTabName = () =>
  screen.getAllByRole("tab").find((tab) => tab.getAttribute("aria-selected") === "true")
    ?.textContent ?? null;

describe("Tabs", () => {
  it("names the strip for assistive tech without drawing the name", () => {
    renderTabs();
    const list = screen.getByRole("tablist");
    expect(list.getAttribute("aria-label")).toBe("Sections");
    // The name is an attribute, never text: a rendered heading would add a line of chrome above
    // every tab set in the system.
    expect(list.textContent).toBe("OverviewUsageAPI");
  });

  it("renders one tab per descriptor, in the order given", () => {
    renderTabs();
    expect(tabNames()).toEqual(["Overview", "Usage", "API"]);
  });

  // ONLY THE SELECTED PANEL IS IN THE DOM. Asserting the count rather than the content is what
  // catches the opposite mistake — a component that force-mounted every panel would still show
  // the right text while shipping two hidden copies of the other two, which a screen-reader user
  // navigating by heading would walk straight into.
  it("mounts only the selected tab's panel", () => {
    renderTabs();
    const panels = screen.getAllByRole("tabpanel");
    expect(panels).toHaveLength(1);
    expect(panels[0]?.textContent).toBe("What it does");
  });

  // Each tab's `aria-controls` has to point at an element that EXISTS. This is the wiring a
  // children-composition API would have handed to the consumer to get wrong, and it is the reason
  // `Tabs.tsx` renders one `TabPanel` per tab rather than one shared panel.
  it("points every tab's aria-controls at a real element", () => {
    renderTabs();
    const selected = screen.getByRole("tab", { name: "Overview" });
    const controls = selected.getAttribute("aria-controls") ?? "";
    expect({ controls, resolves: document.getElementById(controls) !== null }).toEqual({
      controls,
      resolves: true,
    });
  });

  it("starts on the first tab, and honours an explicit default", () => {
    renderTabs();
    expect(selectedTabName()).toBe("Overview");
    cleanup();
    renderTabs({ defaultSelectedKey: "api" });
    expect(selectedTabName()).toBe("API");
  });

  it("obeys a controlled selectedKey", () => {
    renderTabs({ selectedKey: "usage" });
    expect(selectedTabName()).toBe("Usage");
    expect(screen.getByRole("tabpanel").textContent).toBe("How to call it");
  });

  it("reports the newly selected tab's id", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTabs({ onSelectionChange });

    await user.click(screen.getByRole("tab", { name: "API" }));

    expect(onSelectionChange.mock.calls.flat()).toEqual(["api"]);
    expect(screen.getByRole("tabpanel").textContent).toBe("Every prop");
  });

  // THE THREE NON-EVENTS, each pinned separately because each has its own upstream cause and a
  // regression in any one of them is a spurious navigation in a consumer's router.
  //
  // Raw react-aria 3.51.0 fires `onSelectionChange` on ALL of these — measured by counting calls:
  // `useTabListState` commits the default key through `setSelectedKey` in its first effect, and
  // the selection manager re-commits the current key on any press inside the tablist. `Tabs.tsx`
  // gates the callback on the id actually moving, which is what makes the prop's name true.
  it("stays silent on mount, when nothing has been selected yet", () => {
    const onSelectionChange = vi.fn();
    renderTabs({ onSelectionChange });
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("stays silent when the already-selected tab is clicked again", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTabs({ onSelectionChange });

    await user.click(screen.getByRole("tab", { name: "Overview" }));

    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(selectedTabName()).toBe("Overview");
  });

  it("reports each change once, and only the changes", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTabs({ onSelectionChange });

    await user.click(screen.getByRole("tab", { name: "Usage" }));
    await user.click(screen.getByRole("tab", { name: "Usage" }));
    await user.click(screen.getByRole("tab", { name: "API" }));

    expect(onSelectionChange.mock.calls.flat()).toEqual(["usage", "api"]);
  });

  // CONTROLLED MODE IS A DIFFERENT PATH THROUGH THE SAME GATE, and it is the one that broke.
  //
  // The gate's first version tracked only its own ref and swallowed the first emission outright,
  // on the reasoning that the first emission is always react-aria's mount commit. That holds only
  // when this component owns the state. Controlled, react-aria does NOT emit on mount — so the ref
  // was still `undefined` when the user's first click arrived, the first-emission rule ate it, and
  // a controlled tab set ignored its first interaction completely: no callback, no panel change.
  //
  // The gate now compares against `selectedKey` whenever the caller supplies one. These three
  // tests are the ones that would have caught it.
  it("reports the first click when the caller controls the selection", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTabs({ selectedKey: "overview", onSelectionChange });

    await user.click(screen.getByRole("tab", { name: "API" }));

    expect(onSelectionChange.mock.calls.flat()).toEqual(["api"]);
  });

  it("stays silent when a controlled caller clicks the tab it already selected", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTabs({ selectedKey: "usage", onSelectionChange });

    await user.click(screen.getByRole("tab", { name: "Usage" }));

    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  // The round trip a real controlled consumer makes: it owns the state and only ever moves it
  // from this callback. Every click has to land, including the first.
  it("drives a controlled consumer through consecutive selections", async () => {
    const user = userEvent.setup();
    const seen: string[] = [];

    const Controlled = () => {
      const [key, setKey] = useState("overview");
      return createElement(Tabs, {
        label: "Sections",
        tabs: TABS,
        selectedKey: key,
        onSelectionChange: (id: string) => {
          seen.push(id);
          setKey(id);
        },
      });
    };

    render(createElement(Controlled));

    await user.click(screen.getByRole("tab", { name: "API" }));
    expect(selectedTabName()).toBe("API");
    expect(screen.getByRole("tabpanel").textContent).toBe("Every prop");

    await user.click(screen.getByRole("tab", { name: "Usage" }));
    expect(selectedTabName()).toBe("Usage");

    expect(seen).toEqual(["api", "usage"]);
  });

  it("swaps the panel when the selection changes", async () => {
    const user = userEvent.setup();
    renderTabs();
    expect(screen.getByRole("tabpanel").textContent).toBe("What it does");

    await user.click(screen.getByRole("tab", { name: "Usage" }));

    // Still exactly one panel: the old one is unmounted rather than hidden.
    expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
    expect(screen.getByRole("tabpanel").textContent).toBe("How to call it");
  });
});

// DISABLED IS DECLARED PER TAB, and the `Menu` precedent deliberately does NOT apply — the whole
// point of this block. Menu has to route disabling through the collection because `useMenuItem`
// reads `props.isDisabled ?? selectionManager.isDisabled(key)`, so its per-item prop paints a row
// the keyboard still walks into. Tabs resolve it with `||` in all three places that matter, so
// the per-tab flag is enough. These tests are what prove that rather than the source reading.
describe("Tabs disabled", () => {
  const WITH_DISABLED: readonly TabDescriptor[] = [
    { id: "overview", label: "Overview", content: "What it does" },
    { id: "usage", label: "Usage", content: "How to call it", isDisabled: true },
    { id: "api", label: "API", content: "Every prop" },
  ];

  it("announces the disabled tab as disabled", () => {
    renderTabs({ tabs: WITH_DISABLED });
    const usage = screen.getByRole("tab", { name: "Usage" });
    expect(usage.getAttribute("aria-disabled")).toBe("true");
    expect(usage.hasAttribute("data-disabled")).toBe(true);
  });

  // The selection does not move, and the callback does not fire. The second half is not free:
  // raw react-aria re-commits the CURRENT key when the press lands on a disabled row, so without
  // the change gate in `Tabs.tsx` a consumer would see `onSelectionChange("overview")` fire from
  // a click on a tab named Usage — a callback that reports neither what was clicked nor a change.
  it("refuses to select a disabled tab, and reports nothing", async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    renderTabs({ tabs: WITH_DISABLED, onSelectionChange });

    await user.click(screen.getByRole("tab", { name: "Usage" }));

    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(selectedTabName()).toBe("Overview");
    expect(screen.getByRole("tabpanel").textContent).toBe("What it does");
  });

  // THE HALF THE ATTRIBUTE ALONE DOES NOT PROVE. A tab that merely carried `aria-disabled` while
  // the arrow keys still stopped on it would be the Menu defect exactly: announced as
  // unavailable, yet in the keyboard path. `TabsKeyboardDelegate.getNextKey` loops past it, and
  // this is the assertion that holds that.
  it("skips the disabled tab with the arrow keys", async () => {
    const user = userEvent.setup();
    renderTabs({ tabs: WITH_DISABLED });

    screen.getByRole("tab", { name: "Overview" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(document.activeElement?.textContent).toBe("API");
  });

  // A disabled FIRST tab must not start selected: react-aria walks forward to the first enabled
  // one. Without this the component would open showing a panel whose tab announces itself as
  // unavailable.
  it("does not start on a disabled first tab", () => {
    renderTabs({
      tabs: [
        { id: "overview", label: "Overview", content: "What it does", isDisabled: true },
        { id: "usage", label: "Usage", content: "How to call it" },
      ],
    });
    expect(selectedTabName()).toBe("Usage");
    expect(screen.getByRole("tabpanel").textContent).toBe("How to call it");
  });
});

// ORIENTATION IS AN ATTRIBUTE, NOT A VARIANT — see the header of `tabs.recipe.ts`. These tests
// pin both halves of that decision: the attribute is present everywhere the CSS needs it, and no
// orientation CLASS is ever emitted onto the DOM.
describe("Tabs orientation", () => {
  it("defaults to horizontal and reports it to assistive tech", () => {
    renderTabs();
    const list = screen.getByRole("tablist");
    expect(list.getAttribute("aria-orientation")).toBe("horizontal");
    expect(list.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("carries vertical through to the list's ARIA and data attributes", () => {
    renderTabs({ orientation: "vertical" });
    const list = screen.getByRole("tablist");
    expect(list.getAttribute("aria-orientation")).toBe("vertical");
    expect(list.getAttribute("data-orientation")).toBe("vertical");
  });

  // THE STAMP THE RECIPE DEPENDS ON. RAC puts `data-orientation` on `Tabs` and `TabList` but NOT
  // on a `Tab` — measured in the 1.20 types. `Tabs.tsx` adds it so every vertical rule stays a
  // local `&[data-orientation="vertical"]` instead of an ancestor-conditioned selector. If this
  // ever stops rendering, the vertical layout silently reverts to the horizontal one.
  it("stamps the orientation onto every tab, which RAC does not do", () => {
    renderTabs({ orientation: "vertical" });
    expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("data-orientation"))).toEqual([
      "vertical",
      "vertical",
      "vertical",
    ]);
  });

  it("never encodes the orientation as a class", () => {
    renderTabs({ orientation: "vertical" });
    const rendered = [
      screen.getByRole("tablist").className,
      ...screen.getAllByRole("tab").map((tab) => tab.className),
    ].join(" ");
    expect(rendered).not.toMatch(/orientation/);
  });
});

describe("Tabs class contract", () => {
  it("renders exactly the slot classes the recipe derives", () => {
    renderTabs({ size: "lg" });
    const expected = slotRecipeClassNames(tabsRecipe, { size: "lg" });
    expect(screen.getByRole("tablist").className).toBe(expected.list);
    expect(screen.getByRole("tab", { name: "Overview" }).className).toBe(expected.tab);
    expect(screen.getByRole("tabpanel").className).toBe(expected.panel);
  });

  // The per-slot filter in `slotRecipeClassNames`, exercised on a real component: `size` styles
  // only `tab` and `panel`, so stamping it onto `list` would hand the DOM a class matching no
  // rule. Panda's own generated runtime does exactly that; this package deliberately does not.
  it("keeps the size axis off the slots it does not style", () => {
    renderTabs({ size: "sm" });
    expect(screen.getByRole("tablist").className).not.toMatch(/size_/);
    expect(screen.getByRole("tab", { name: "Overview" }).className).toMatch(/--size_sm/);
  });
});

describe("Tabs emitted CSS", () => {
  // SELECTION MOVES A COLOUR, NEVER A BOX. Every tab reserves the accent edge transparently, so
  // the selected rule only recolours it. A selected rule that added the border width instead
  // would reflow the strip under the pointer that just clicked it.
  it("reserves the accent edge on every tab and only recolours it when selected", () => {
    const base = ruleBody(css, "zui-tabs__tab");
    expect(base).toMatch(/border-block-end-width:\s*2px/);
    expect(base).toMatch(/border-color:\s*transparent/);

    const selected = ruleBody(css, "zui-tabs__tab") + css;
    expect(selected).toMatch(/\.zui-tabs__tab\[data-selected\]/);
    const selectedRule = css.match(/\.zui-tabs__tab\[data-selected\][^{]*\{([^}]*)\}/)?.[1] ?? "";
    expect(selectedRule).toMatch(/border-color/);
    expect(selectedRule).not.toMatch(/border-block-end-width/);
  });

  it("emits the vertical rules off the tab's own attribute, never an ancestor's", () => {
    const verticalTabSelectors = css
      .split("}")
      .map((rule) => rule.split("{")[0] ?? "")
      .filter((selector) => selector.includes("zui-tabs__tab") && selector.includes("vertical"));

    expect(verticalTabSelectors.length).toBeGreaterThan(0);
    // Every one of them starts at the tab's own class: no `.zui-tabs__list[...] .zui-tabs__tab`.
    for (const selector of verticalTabSelectors) {
      expect(selector.trim().startsWith(".zui-tabs__tab")).toBe(true);
    }
  });

  it("gives the panel a focus ring, because RAC makes it focusable", () => {
    const panelFocus =
      css.match(/\.zui-tabs__panel\[data-focus-visible\][^{]*\{([^}]*)\}/)?.[1] ?? "";
    expect(panelFocus).toMatch(/outline-color/);
  });
});

describe("Tabs public API surface (type-level)", () => {
  it("rejects styling props, an unknown size and a missing label", () => {
    const constructed = [
      // @ts-expect-error styling is owned by the design system
      createElement(Tabs, { label: "x", tabs: TABS, className: "x" }),
      // @ts-expect-error unknown size
      createElement(Tabs, { label: "x", tabs: TABS, size: "xl" }),
      // @ts-expect-error label is required — the tablist would have no accessible name
      createElement(Tabs, { tabs: TABS }),
      createElement(Tabs, { label: "x", tabs: TABS }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });

  it("rejects a tab descriptor with no label", () => {
    const rejected = [
      // @ts-expect-error label is required — it is the tab's accessible name
      { id: "a", content: "body" } satisfies TabDescriptor,
      // @ts-expect-error id is required — it is the key the panel is matched by
      { label: "A", content: "body" } satisfies TabDescriptor,
    ];
    expect(rejected).toHaveLength(2);
  });
});
