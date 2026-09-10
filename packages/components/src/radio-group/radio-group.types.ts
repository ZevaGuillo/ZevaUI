import type { ReactNode } from "react";
import type { radioGroupRecipe } from "./radio-group.recipe.js";

export type RadioGroupSize = keyof typeof radioGroupRecipe.variants.size;
export type RadioGroupOrientation = keyof typeof radioGroupRecipe.variants.orientation;

/**
 * One answer in the group, as data rather than as children.
 *
 * The same argument `MenuItemDescriptor` makes, and it applies harder here. Accepting children
 * would hand the consumer the option element itself — which is structure, not content — and with
 * it every way to break the semantics a radio group depends on: the shared `name`, the one-of-N
 * invariant, the label-to-input association. A typed descriptor keeps the DOM shape fixed and the
 * accessible name mandatory, and it is why this component can honestly type `className` as
 * `never`: there is no part for a consumer to reach.
 */
export type RadioOptionDescriptor = {
  /** The value reported through `onChange` when this option is chosen. Unique within the group. */
  readonly value: string;
  /**
   * The option's visible text and its accessible name. Required, because a radio without a real
   * name fails the blocking axe gate (ADR-0004).
   */
  readonly label: ReactNode;
  /** A disabled option is announced as such, skipped by arrow-key navigation, and never chosen. */
  readonly isDisabled?: boolean;
};

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types: the public surface is
 * this design system's contract, not RAC's, and re-exporting would leak `className`, `style` and
 * render props straight back to the consumer.
 */
export type RadioGroupProps = {
  /**
   * The question, and therefore the group's accessible name. Required for the same reason
   * `Checkbox`'s and `Input`'s labels are: a group without a programmatic name fails the blocking
   * accessibility gate, so the type system refuses it rather than letting a story catch it later.
   */
  readonly label: ReactNode;
  /** The answers, in the order they are read. */
  readonly options: readonly RadioOptionDescriptor[];
  readonly size?: RadioGroupSize;
  /**
   * Vertical by default, because a list of answers is read down a column and a horizontal group
   * truncates on a narrow viewport. Horizontal wraps rather than scrolls.
   */
  readonly orientation?: RadioGroupOrientation;
  readonly name?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly isDisabled?: boolean;
  readonly isReadOnly?: boolean;
  /**
   * Required, and INVALID, are properties of the GROUP rather than of any one option — which is
   * where RAC 1.20 puts them too, and it is the opposite of `Checkbox` and `Switch`, where the
   * control validates itself. A single radio has nothing to be required about; the question does.
   *
   * This component renders no error text of its own, matching the other two: the message belongs
   * to the field that groups the control, and no such component ships yet.
   */
  readonly isRequired?: boolean;
  readonly isInvalid?: boolean;
  readonly onChange?: (value: string) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
