import type { textareaRecipe } from "./textarea.recipe.js";

export type TextareaSize = keyof typeof textareaRecipe.variants.size;

export type TextareaResize = keyof typeof textareaRecipe.variants.resize;

export type TextareaProps = {
  /**
   * Required, not optional: a text field without a programmatic label fails the blocking
   * accessibility gate, so the type system refuses it rather than letting a story catch it later.
   * Use a visually-hidden pattern at the consumer level if a visible label is unwanted — that is
   * a layout decision, not a reason to ship an unlabelled control.
   */
  readonly label: string;
  /** Wired to the textarea through aria-describedby by react-aria-components. */
  readonly description?: string;
  /**
   * Rendered only while the field is invalid, and announced through aria-describedby. Supplying
   * it does not by itself mark the field invalid — pass `isInvalid` for that.
   */
  readonly errorMessage?: string;
  readonly size?: TextareaSize;
  /**
   * How the user may resize the field. Defaults to `vertical`; `none` fixes the height at `rows`.
   * The browser's own default, `both`, is not offered: horizontal resize drags the field out of
   * its container, and with `className` typed `never` there would be no way back out of it.
   */
  readonly resize?: TextareaResize;
  /**
   * Visible lines, forwarded to the native `rows` attribute. This is the initial height, not a
   * maximum — content beyond it scrolls, and `resize="vertical"` still lets the user grow the box.
   */
  readonly rows?: number;
  readonly name?: string;
  readonly placeholder?: string;
  readonly value?: string;
  readonly defaultValue?: string;
  readonly isDisabled?: boolean;
  readonly isRequired?: boolean;
  readonly isInvalid?: boolean;
  readonly isReadOnly?: boolean;
  readonly onChange?: (value: string) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
