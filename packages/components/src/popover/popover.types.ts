import type { ReactNode } from "react";
import type { popoverRecipe } from "./popover.recipe.js";

export type PopoverSize = keyof typeof popoverRecipe.variants.size;

/**
 * Which side of the trigger the panel is REQUESTED on. react-aria may resolve a different one when
 * there is no room, which is why the recipe animates off `[data-placement]` rather than off this
 * value. Same four logical sides `TooltipPlacement` narrows to, and for the same reasons.
 */
export type PopoverPlacement = "top" | "bottom" | "start" | "end";

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types.
 *
 * RF-07, the same way `Menu` reads it: this component owns its trigger AND its structure. The
 * consumer supplies a label, a title and a body; nothing they pass can change the rendered DOM
 * shape. `Tooltip` is the one component in this package that inverts that, and `tooltip.types.ts`
 * argues why — a tooltip decorates a control that already exists, while a popover is opened by a
 * button that exists only to open it.
 */
export type PopoverProps = {
  /**
   * Visible text of the trigger button.
   *
   * NOT the panel's accessible name, which is where this differs from `Menu`. react-aria names a
   * `role="menu"` from its trigger, but a `role="dialog"` is named by its own heading — so a
   * popover needs both, and they are usually different words: the trigger says what pressing it
   * does ("Filters"), the title says what the panel is ("Filter by status").
   */
  readonly label: string;
  /**
   * The panel's accessible name, rendered as its heading. Required and a plain string, because a
   * `role="dialog"` with no name fails the blocking axe gate — the same rule `Dialog.title`
   * follows.
   *
   * It is DRAWN rather than visually hidden on purpose. A hidden heading is a name only assistive
   * technology can check, and this package has no way to tell a caller their invisible name went
   * stale; a visible one is corrected by anyone who looks at the panel.
   */
  readonly title: string;
  /** The panel's content. */
  readonly children: ReactNode;
  readonly size?: PopoverSize;
  readonly placement?: PopoverPlacement;
  readonly isOpen?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** Disables the trigger, so the popover cannot be opened at all. */
  readonly isDisabled?: boolean;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
