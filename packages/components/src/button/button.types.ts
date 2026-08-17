import type { ReactNode } from "react";
import type { buttonRecipe } from "./button.recipe.js";

export type ButtonVisual = keyof typeof buttonRecipe.variants.visual;
export type ButtonSize = keyof typeof buttonRecipe.variants.size;

export type ButtonProps = {
  readonly children: ReactNode;
  readonly visual?: ButtonVisual;
  readonly size?: ButtonSize;
  readonly isDisabled?: boolean;
  readonly type?: "button" | "submit" | "reset";
  readonly onPress?: () => void;
  readonly "aria-label"?: string;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
