import type { inputRecipe } from "./input.recipe.js";

export type InputSize = keyof typeof inputRecipe.variants.size;

export type InputType = "text" | "email" | "password" | "search" | "tel" | "url";

export type InputProps = {
  /**
   * Required, not optional: a text field without a programmatic label fails the blocking
   * accessibility gate, so the type system refuses it rather than letting a story catch it later.
   * Use a visually-hidden pattern at the consumer level if a visible label is unwanted — that is
   * a layout decision, not a reason to ship an unlabelled control.
   */
  readonly label: string;
  /** Wired to the input through aria-describedby by react-aria-components. */
  readonly description?: string;
  /**
   * Rendered only while the field is invalid, and announced through aria-describedby. Supplying
   * it does not by itself mark the field invalid — pass `isInvalid` for that.
   */
  readonly errorMessage?: string;
  readonly size?: InputSize;
  readonly type?: InputType;
  readonly name?: string;
  readonly placeholder?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly isDisabled?: boolean;
  readonly isRequired?: boolean;
  readonly isInvalid?: boolean;
  readonly isReadOnly?: boolean;
  readonly autoComplete?: string;
  readonly onChange?: (value: string) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
