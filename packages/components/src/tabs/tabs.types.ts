import type { ReactNode } from "react";
import type { tabsRecipe } from "./tabs.recipe.js";

export type TabsSize = keyof typeof tabsRecipe.variants.size;

/**
 * Which way the strip runs. Not derived from the recipe, because orientation is an ATTRIBUTE here
 * rather than a variant — see the header of `tabs.recipe.ts`. The two values are
 * react-aria-components' own `Orientation`, spelled out so this package's public type does not
 * re-export an upstream one.
 */
export type TabsOrientation = "horizontal" | "vertical";

/**
 * One tab and the panel it reveals, described as data rather than composed as markup.
 *
 * RF-07 forbids the consumer from varying the rendered structure, and tabs are a place that rule
 * earns its keep: `role="tablist"` accepts only `tab` children, each tab's `aria-controls` has to
 * point at its own panel, and react-aria's collection needs a stable key per tab. Children
 * composition would hand the consumer the `Tab`/`TabPanel` elements themselves — which is
 * structure, not content — and with it every way to break that wiring.
 *
 * `content` is the exception the shape forces, and it is worth naming as such: a panel holds
 * whatever the application puts in it, so it cannot be narrowed the way `label` is. `Dialog`'s
 * `children` is the same concession for the same reason. The tab's NAME is still a plain string,
 * which is the half that has to stay predictable.
 */
export type TabDescriptor = {
  /** Stable identity of the tab, reported back through `onSelectionChange`. */
  readonly id: string;
  /**
   * The tab's accessible name, rendered as its label. Required and a plain string: a tab with no
   * real name leaves a screen-reader user choosing between "tab 1 of 4" and nothing.
   */
  readonly label: string;
  /** What the panel shows while this tab is selected. */
  readonly content: ReactNode;
  /**
   * Disabled tabs are announced as such, are skipped by arrow-key navigation, and cannot be
   * selected. A disabled FIRST tab also does not start selected — react-aria walks forward to the
   * first enabled one.
   */
  readonly isDisabled?: boolean;
};

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types: the public surface is
 * this design system's contract, not RAC's, and re-exporting would leak `className`, `style` and
 * render props straight back to the consumer.
 *
 * RF-07: this component owns its strip, its tabs and its panel. There is no prop that changes the
 * rendered DOM shape, no `children`, and no way to reach the markup.
 */
export type TabsProps = {
  /**
   * The tab strip's accessible name, wired to `aria-label` on the `role="tablist"`.
   *
   * REQUIRED. A tablist is a navigation landmark in everything but name: a screen-reader user
   * meeting two unnamed strips on one page has no way to tell which is which, and nothing in the
   * tabs themselves supplies that — each tab names its own panel, not the set. It is not rendered.
   */
  readonly label: string;
  /** The tabs, in the order they are rendered. */
  readonly tabs: readonly TabDescriptor[];
  /**
   * The selected tab's `id`, for a caller that owns the state. Leave it out and the component
   * keeps its own, seeded by {@link TabsProps.defaultSelectedKey}.
   */
  readonly selectedKey?: string;
  /** Which tab starts selected when the component owns the state. Defaults to the first. */
  readonly defaultSelectedKey?: string;
  /**
   * Called with the `id` of the newly selected tab.
   *
   * CHANGES ONLY, which is narrower than react-aria's own callback and deliberately so. It does
   * not fire on mount for the tab that starts selected, it does not fire when the selected tab is
   * clicked again, and a click on a disabled tab reports nothing at all. Upstream fires in all
   * three cases; `Tabs.tsx` gates them, so this is safe to wire straight to a router or to
   * analytics without a guard of your own.
   */
  readonly onSelectionChange?: (id: string) => void;
  /**
   * Which way the strip runs. `vertical` puts it beside the panel instead of above it, and
   * react-aria swaps the arrow keys to match.
   */
  readonly orientation?: TabsOrientation;
  readonly size?: TabsSize;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
