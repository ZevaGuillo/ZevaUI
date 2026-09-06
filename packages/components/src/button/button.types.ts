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
  /**
   * Decorative icon rendered before the label, inside a box the design system owns and spaces.
   *
   * A slot rather than something the caller puts in `children`, because `children` guarantees the
   * system neither order nor spacing: `<Button><Icon />Save</Button>` and
   * `<Button>Save<Icon /></Button>` both type-check and mean different things. Same rule `Dialog`
   * and `Menu` already follow — the caller supplies content, the system supplies structure.
   *
   * DECORATIVE, and enforced: the wrapper is `aria-hidden`, so an icon carrying its own title or
   * `aria-label` cannot append a second word to the button's accessible name. That name comes
   * from `children`, or from `aria-label` when the label alone is not descriptive enough.
   */
  readonly iconStart?: ReactNode;
  /** Decorative icon rendered after the label. Same contract as {@link ButtonProps.iconStart}. */
  readonly iconEnd?: ReactNode;
  readonly isDisabled?: boolean;
  readonly type?: "button" | "submit" | "reset";
  readonly onPress?: () => void;
  readonly "aria-label"?: string;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
