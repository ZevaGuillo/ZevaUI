import type { ReactNode } from "react";
import type { checkboxRecipe } from "./checkbox.recipe.js";

export type CheckboxSize = keyof typeof checkboxRecipe.variants.size;

export type CheckboxProps = {
  /**
   * The label, and therefore the accessible name. Required for the same reason `Input`'s `label`
   * is: a control without a programmatic name fails the blocking accessibility gate, so the type
   * system refuses it rather than letting a story catch it later. A checkbox that must carry no
   * VISIBLE label — the select-all cell in a table header is the honest case — passes a
   * visually-hidden element here. That is a layout decision, not a reason to ship an unnamed
   * control.
   */
  readonly children: ReactNode;
  readonly size?: CheckboxSize;
  readonly name?: string;
  readonly value?: string;
  readonly isSelected?: boolean;
  readonly defaultSelected?: boolean;
  /**
   * The third state, for a checkbox that summarises others — a select-all whose group is
   * partially chosen. It is a PRESENTATION of the control, not a third value: the underlying
   * input still carries its own checked value, and this only adds the mixed appearance on top.
   *
   * Measured, not assumed: this sets the NATIVE `indeterminate` DOM property on the input, which
   * is what makes assistive tech announce "mixed". No `aria-checked` is involved — react-aria
   * sets none, and adding one would be redundant ARIA over a native control.
   */
  readonly isIndeterminate?: boolean;
  readonly isDisabled?: boolean;
  readonly isReadOnly?: boolean;
  readonly isRequired?: boolean;
  /**
   * Marks the control invalid and paints the box `danger`. This component renders no error text
   * of its own — a single checkbox has nowhere sensible to put it, and the message for "you must
   * accept the terms" belongs to the field that groups it. `CheckboxGroup` owns that, and does
   * not ship yet.
   */
  readonly isInvalid?: boolean;
  readonly onChange?: (isSelected: boolean) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
