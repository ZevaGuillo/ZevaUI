"use client";

import { useRef } from "react";
import { Tabs as AriaTabs, type Key, Tab, TabList, TabPanel } from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { tabsRecipe } from "./tabs.recipe.js";
import type { TabDescriptor, TabsProps } from "./tabs.types.js";

/**
 * The strip, the tabs and the panel are all part of the component, not something the consumer
 * supplies. RF-07: there is no prop that changes the rendered DOM shape, no `children`, and no way
 * to reach the markup.
 *
 * ONLY THE SELECTED PANEL IS MOUNTED — measured, not assumed: rendering one `TabPanel` per tab
 * leaves exactly one `role="tabpanel"` in the document. `shouldForceMount` is deliberately not
 * exposed. It keeps every panel in the DOM and inert, which a panel holding a form mid-edit really
 * wants, but RAC's own docs say inert panels "must be styled appropriately so this is clear to the
 * user visually" — so exposing it would hand the consumer an axis whose accessibility cost this
 * package would then owe. It can be added against a real case; it cannot be taken back.
 */
export function Tabs({
  label,
  tabs,
  orientation = "horizontal",
  size,
  selectedKey,
  onSelectionChange,
  ...behaviour
}: TabsProps) {
  // Every slot gets an explicit className. This is not cosmetic: react-aria-components applies its
  // own default classes (react-aria-Tabs, react-aria-TabList, ...) when className is omitted, and
  // those would ship as public API surface consumers could target.
  const slots = slotRecipeClassNames(tabsRecipe, { size });

  /**
   * `onSelectionChange` REPORTS CHANGES, AND UPSTREAM ON ITS OWN DOES NOT. Measured on react-aria
   * 3.51.0 by counting calls rather than reasoning about them, because the raw behaviour is easy
   * to miss and impossible to un-ship once a consumer depends on it:
   *
   *   mount, no interaction        -> fires once with the initially selected id
   *   click the SELECTED tab       -> fires again with that same id
   *   click a DISABLED tab         -> fires with the id that was already selected
   *   click another tab            -> fires with the new id
   *
   * Three of those four are not a selection CHANGE. `useTabListState` commits the default key
   * through `setSelectedKey` during its first effect, which is where the mount call comes from,
   * and the selection manager re-commits the current key on any press inside the tablist. A
   * consumer wiring this to a router or to analytics would get a navigation on page load and a
   * duplicate on every re-click.
   *
   * So the callback is gated on the id actually moving, against WHATEVER CURRENTLY KNOWS the
   * selection. That distinction is the whole of the logic below and it was learned the hard way:
   * a first version tracked only the ref and suppressed its first emission outright, reasoning
   * that the first emission is always the mount commit. That is true only when this component
   * owns the state. **Controlled, react-aria does not emit on mount at all** — so the ref was
   * still `undefined` when the user's first click arrived, the "first emission" rule ate it, and
   * a controlled tab set ignored its first interaction entirely. Measured, and now pinned.
   *
   * `selectedKey` is therefore the authority whenever the caller supplies one, because a
   * controlled caller can move the selection without anything reaching this callback. The ref is
   * the fallback for the uncontrolled case, where the mount commit is real and is the one
   * emission worth swallowing — its value is the default the caller already chose.
   */
  const lastReported = useRef<string | undefined>(undefined);

  const reportSelection = (key: Key) => {
    const id = String(key);
    const known = selectedKey ?? lastReported.current;
    lastReported.current = id;
    // `undefined` is reachable only uncontrolled, and only for the mount commit.
    if (known === undefined || known === id) return;
    onSelectionChange?.(id);
  };

  return (
    <AriaTabs
      {...behaviour}
      selectedKey={selectedKey}
      orientation={orientation}
      className={slots.root}
      onSelectionChange={reportSelection}
    >
      {/*
        `aria-label` rather than a rendered heading: the strip's name exists for assistive tech,
        and drawing it would add a line of chrome above every tab set in the system. `label` is
        required in `tabs.types.ts` precisely so this attribute is never empty.
      */}
      <TabList className={slots.list} aria-label={label} items={tabs}>
        {(tab: TabDescriptor) => (
          /*
            DISABLED IS DECLARED PER TAB, AND THE MENU PRECEDENT DOES NOT APPLY HERE — which is
            worth writing down, because the opposite was assumed first and the analogy is
            seductive. `Menu` has to route disabling through the collection's `disabledKeys`,
            since `useMenuItem` reads `props.isDisabled ?? selectionManager.isDisabled(key)` and
            that `??` lets the per-item prop paint a row the keyboard still walks into.
            Tabs resolve it three different ways, and all three read BOTH forms — measured in
            react-aria 3.51.0 / react-stately 3.49.0 rather than inferred:
              * `useTab`: `propsDisabled || state.isDisabled || selectionManager.isDisabled(key)`
                — an `||`, not the `??` that made Menu's version paint-only.
              * `TabsKeyboardDelegate.isDisabled`: `disabledKeys.has(key) ||
                collection.getItem(key)?.props?.isDisabled` — so arrow keys skip either way.
              * `findDefaultSelectedKey`: the same disjunction, so a disabled FIRST tab does not
                start selected under either spelling.
            Both forms therefore behave identically, so this takes the simpler one: no derived
            array, no second pass over `tabs`, and the flag stays next to the tab it describes.

            `data-orientation` is stamped here because RAC does not put it on a Tab — measured in
            the 1.20 types, where `TabRenderProps` carries no orientation while `Tabs` and
            `TabList` both do. Without it the recipe's vertical rules would need an ancestor
            selector. `Select` stamps `data-open` onto its trigger for the same reason.
          */
          <Tab
            id={tab.id}
            className={slots.tab}
            isDisabled={tab.isDisabled}
            data-orientation={orientation}
          >
            {tab.label}
          </Tab>
        )}
      </TabList>
      {/*
        One `TabPanel` per tab rather than a single panel fed the selected content. RAC matches a
        panel to its tab by `id` and renders only the selected one, which is what wires each tab's
        `aria-controls` to a real element; a single shared panel would leave every tab but one
        pointing at an id nothing owns.
      */}
      {tabs.map((tab) => (
        <TabPanel key={tab.id} id={tab.id} className={slots.panel}>
          {tab.content}
        </TabPanel>
      ))}
    </AriaTabs>
  );
}
