import type { ReactNode } from "react";
import type { buttonRecipe } from "./button.recipe.js";

export type ButtonVisual = keyof typeof buttonRecipe.variants.visual;
export type ButtonSize = keyof typeof buttonRecipe.variants.size;
export type ButtonWidth = keyof typeof buttonRecipe.variants.width;

export type ButtonProps = {
  readonly children: ReactNode;
  readonly visual?: ButtonVisual;
  readonly size?: ButtonSize;
  /**
   * How the button sizes itself against its container. `auto` (the default) shrink-wraps the
   * label; `full` spans the container. This is the supported way to stretch a button — there is
   * no `className` to reach for, by design (see the README's "No `className`, no `style`").
   */
  readonly width?: ButtonWidth;
  readonly isDisabled?: boolean;
  readonly type?: "button" | "submit" | "reset";
  readonly onPress?: () => void;
  readonly "aria-label"?: string;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
