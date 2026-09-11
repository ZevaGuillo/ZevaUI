import type { selectRecipe } from "./select.recipe.js";

export type SelectSize = keyof typeof selectRecipe.variants.size;

/**
 * One option in the list, as data rather than as children.
 *
 * The same argument `MenuItemDescriptor` and `RadioOptionDescriptor` make: `role="listbox"` only
 * accepts `option` children, react-aria's collection needs a stable key per row, and the trigger
 * derives what it displays from the chosen row. Children composition would hand the consumer the
 * option element itself — structure, not content — and with it every way to break those three.
 *
 * Keyed by `value` rather than `id`, following `RadioOptionDescriptor`: both are form controls
 * that report a chosen value, and `Menu`'s `id` names a row to ACT on, which is a different job.
 */
export type SelectOptionDescriptor = {
  /** The value reported through `onChange` when this option is chosen. Unique within the list. */
  readonly value: string;
  /**
   * The option's visible text and its accessible name. Required, because an option without a real
   * name fails the blocking axe gate (ADR-0004).
   *
   * A plain `string`, and deliberately NOT the `ReactNode` that `RadioOptionDescriptor` allows:
   * the closed trigger has to render this same text through `SelectValue`, and react-aria derives
   * that from the row's `textValue`, which only a string can supply.
   */
  readonly label: string;
  /** Supporting copy under the label, inside the list only. Never shown on the closed trigger. */
  readonly description?: string;
  /** A disabled option is announced as such, skipped by arrow-key navigation, and never chosen. */
  readonly isDisabled?: boolean;
};

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types: the public surface is
 * this design system's contract, not RAC's, and re-exporting would leak `className`, `style` and
 * render props straight back to the consumer.
 *
 * Two omissions are deliberate and both are measured against react-aria-components 1.20, not
 * assumed (see `react-stately/dist/types/src/select/useSelectState.d.ts`):
 *
 *   * NO `isReadOnly`. RAC spells its own base as `Omit<InputBase, 'isReadOnly'>` — the omission
 *     is upstream and explicit. `Input`, `Textarea` and `RadioGroup` all ship the prop; this one
 *     does not, because there is nothing underneath to honour it and a prop that silently does
 *     nothing is worse than an absent one.
 *   * NO `selectionMode`. RAC 1.20 added `'single' | 'multiple'`; this component exposes single
 *     selection only, so `value` stays a `string` and the trigger always renders one option.
 *
 * The selection props below are RAC's LIVE spelling, not its deprecated one. `selectedKey`,
 * `defaultSelectedKey` and `onSelectionChange` are all marked `@deprecated` in 1.20; the
 * supported path is `ValueBase`, i.e. `value` / `defaultValue` / `onChange` — which is already
 * exactly what `Input` and `RadioGroup` expose, so nothing has to be translated at this boundary.
 */
export type SelectProps = {
  /**
   * Required, not optional: a select without a programmatic label fails the blocking
   * accessibility gate, so the type system refuses it rather than letting a story catch it later.
   */
  readonly label: string;
  /** The options, in the order they are listed. */
  readonly options: readonly SelectOptionDescriptor[];
  /** Wired to the control through aria-describedby by react-aria-components. */
  readonly description?: string;
  /**
   * Rendered only while the control is invalid, and announced through aria-describedby. Supplying
   * it does not by itself mark the control invalid — pass `isInvalid` for that.
   */
  readonly errorMessage?: string;
  /** Shown on the trigger until an option is chosen. RAC supplies a localized default. */
  readonly placeholder?: string;
  readonly size?: SelectSize;
  readonly name?: string;
  /** The chosen option's `value` (controlled). */
  readonly value?: string;
  /** The initially chosen option's `value` (uncontrolled). */
  readonly defaultValue?: string;
  readonly isDisabled?: boolean;
  readonly isRequired?: boolean;
  readonly isInvalid?: boolean;
  readonly isOpen?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
  /** Called with the chosen option's `value`. Disabled options never call it. */
  readonly onChange?: (value: string) => void;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
