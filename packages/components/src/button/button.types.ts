import type { ReactNode } from "react";
import type { buttonRecipe } from "./button.recipe.js";

export type ButtonVisual = keyof typeof buttonRecipe.variants.visual;
export type ButtonSize = keyof typeof buttonRecipe.variants.size;
export type ButtonWidth = keyof typeof buttonRecipe.variants.width;

/**
 * The pending pair, spelled as a union so the two props cannot be supplied apart.
 *
 * `pendingLabel` is REQUIRED whenever `isPending` is, for the reason `spinner.types.ts` already
 * argues about its own `label`: the indicator this renders is a `role="progressbar"`, a control
 * with no programmatic name fails the blocking accessibility gate, and this package refuses to
 * invent one — a busy indicator that names itself says the same thing on every page, which is the
 * same as saying nothing. A second optional prop would have let the broken call compile and left a
 * story to catch it; a union makes the compiler refuse it.
 *
 * The second branch spells both props as optional `undefined` rather than omitting them, so the
 * key set matches across the union. That is what lets a caller write `isPending={saving}` with an
 * ordinary `boolean` — truthiness alone eliminates this branch — instead of needing a literal
 * `true` the way a conventional discriminant would demand.
 */
type ButtonPendingProps =
  | {
      /**
       * Whether the action this button started is still running. RAC keeps the button FOCUSABLE
       * while it is — `aria-disabled`, never the `disabled` attribute — because the user's focus
       * is already here and removing it mid-operation sends a keyboard user back to the top of the
       * document. Presses are suppressed, hover is frozen, and a `type="submit"` button is
       * downgraded to `type="button"` so implicit form submission cannot slip past the suppressed
       * press handler.
       *
       * NOT `isDisabled`. That prop says "you may not do this", a judgement about permission;
       * pending says "you already did, wait". They also look different on purpose — see the
       * `[data-pending]` rule in `button.recipe.ts`.
       */
      readonly isPending: boolean;
      /**
       * What is busy, and therefore the busy indicator's accessible name. Rendered into a
       * {@link Spinner} the button owns rather than one the caller composes — see
       * {@link ButtonProps.iconStart} for why the icon slots cannot carry it.
       */
      readonly pendingLabel: string;
    }
  | {
      readonly isPending?: undefined;
      readonly pendingLabel?: undefined;
    };

type ButtonOwnProps = {
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
   *
   * That enforcement is also why a busy indicator MUST NOT be put here. `aria-hidden` would strip
   * the spinner's accessible name and silence the announcement react-aria-components builds on
   * `ProgressBarContext` — the button would spin and say nothing. Use {@link
   * ButtonPendingProps.isPending}, which renders the indicator in a box that is not hidden and
   * takes this slot's place while it runs.
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

export type ButtonProps = ButtonOwnProps & ButtonPendingProps;
