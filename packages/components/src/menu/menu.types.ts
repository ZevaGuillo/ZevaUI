import type { menuRecipe } from "./menu.recipe.js";

export type MenuSize = keyof typeof menuRecipe.variants.size;
export type MenuWidth = keyof typeof menuRecipe.variants.width;

/**
 * One row of the menu, described as data rather than composed as markup.
 *
 * RF-07 forbids the consumer from varying the rendered structure, and a menu is where that rule
 * bites hardest: `role="menu"` only accepts `menuitem` children, and react-aria's collection
 * needs a stable key per row. Children composition would hand the consumer the `MenuItem`
 * element itself — which is structure, not content — and with it every way to break the
 * semantics. A typed descriptor keeps the DOM shape fixed and the accessible name mandatory.
 */
export type MenuItemDescriptor = {
  /** Stable identity of the row, reported back through `onAction`. */
  readonly id: string;
  /**
   * The row's accessible name, rendered as its label. Required and a plain string, because a
   * menu item without a real name fails the blocking axe gate (ADR-0004).
   */
  readonly label: string;
  /** Supporting copy under the label. Wired to the row's `aria-describedby` when present. */
  readonly description?: string;
  /** Disabled rows are announced as such, are skipped by arrow-key navigation, and never fire. */
  readonly isDisabled?: boolean;
};

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types: the public surface is
 * this design system's contract, not RAC's, and re-exporting would leak `className`, `style` and
 * render props straight back to the consumer.
 *
 * RF-07: this component owns its trigger AND its rows. There is no prop that changes the
 * rendered DOM shape, no `children`, and no way to reach the markup.
 */
export type MenuProps = {
  /**
   * Visible text of the trigger button. Doubles as the menu's accessible name, which react-aria
   * derives from the trigger.
   */
  readonly label: string;
  /** The rows, in the order they are rendered. */
  readonly items: readonly MenuItemDescriptor[];
  /** Called with the `id` of the activated row. Disabled rows never call it. */
  readonly onAction?: (id: string) => void;
  readonly size?: MenuSize;
  readonly width?: MenuWidth;
  readonly isOpen?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** Disables the trigger, so the menu cannot be opened at all. */
  readonly isDisabled?: boolean;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
