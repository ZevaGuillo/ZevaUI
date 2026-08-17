import type { ReactNode } from "react";
import type { dialogRecipe } from "./dialog.recipe.js";

export type DialogSize = keyof typeof dialogRecipe.variants.size;
export type DialogPlacement = keyof typeof dialogRecipe.variants.placement;

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types: the public surface is
 * this design system's contract, not RAC's, and re-exporting would leak `className`, `style` and
 * render props straight back to the consumer.
 *
 * RF-07: composition happens through typed `ReactNode` content slots only. There is no prop that
 * changes the rendered DOM shape, and no way to reach the markup — a consumer supplies content,
 * the design system owns structure and styling.
 */
export type DialogProps = {
  /**
   * The dialog's accessible name, rendered as its level-2 heading. Required and a plain string,
   * because a modal without a real name fails the blocking axe gate (ADR-0004).
   */
  readonly title: string;
  /** The dialog body. */
  readonly children: ReactNode;
  /** Supporting copy under the title. Wired to the dialog's `aria-describedby` when present. */
  readonly description?: ReactNode;
  /** Action area, pinned to the end of the dialog. Typically `Button`s. */
  readonly footer?: ReactNode;
  /** Visible label of the close control. Defaults to "Close"; override to localise. */
  readonly closeLabel?: string;
  readonly size?: DialogSize;
  readonly placement?: DialogPlacement;
  readonly isOpen?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** Whether clicking the scrim closes the dialog. Escape always closes. */
  readonly isDismissable?: boolean;
  readonly isKeyboardDismissDisabled?: boolean;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
