import type { ReactNode } from "react";
import type { switchRecipe } from "./switch.recipe.js";

export type SwitchSize = keyof typeof switchRecipe.variants.size;

export type SwitchProps = {
  /**
   * The label, and therefore the accessible name. Required for the same reason `Checkbox`'s and
   * `Input`'s are: a control without a programmatic name fails the blocking accessibility gate,
   * so the type system refuses it rather than letting a story catch it later.
   */
  readonly children: ReactNode;
  readonly size?: SwitchSize;
  readonly name?: string;
  readonly value?: string;
  readonly isSelected?: boolean;
  readonly defaultSelected?: boolean;
  readonly isDisabled?: boolean;
  readonly isReadOnly?: boolean;
  /**
   * Available here only because this component is built on `SwitchField` + `SwitchButton`. The
   * flat `Switch` that RAC 1.20 deprecates OMITS `isRequired` from its props outright, so a
   * switch built on it could not have offered this at all.
   */
  readonly isRequired?: boolean;
  /**
   * Marks the control invalid and paints the track `danger`. Same upstream story as
   * `isRequired`: the deprecated flat `Switch` omits `isInvalid`, and only the field API carries
   * it.
   *
   * This component renders no error text of its own, matching `Checkbox`: the message belongs to
   * the field that groups the control, and no grouping component ships yet.
   */
  readonly isInvalid?: boolean;
  readonly onChange?: (isSelected: boolean) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
