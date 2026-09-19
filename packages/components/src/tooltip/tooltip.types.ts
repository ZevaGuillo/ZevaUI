import type { ReactElement } from "react";

/**
 * Which side of the trigger the bubble is REQUESTED on. react-aria may resolve a different one
 * when there is no room, which is why the recipe animates off `[data-placement]` rather than off
 * this value.
 *
 * Four logical sides, not the twelve react-aria accepts. `start`/`end` rather than `left`/`right`
 * so a right-to-left page flips them without the caller doing anything; the eight corner-anchored
 * spellings (`top left`, `bottom end`, …) are omitted because a tooltip is centred on the control
 * it explains, and a caller reaching for a corner is usually working around a layout problem that
 * a tooltip cannot fix.
 */
export type TooltipPlacement = "top" | "bottom" | "start" | "end";

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types.
 *
 * `children` HERE IS THE TRIGGER, NOT THE CONTENT, AND THAT INVERTS WHAT EVERY OTHER COMPONENT IN
 * THIS PACKAGE DOES. `Dialog` and `Menu` take content and own their structure; RF-07 exists so a
 * consumer can never reach the markup. A tooltip cannot work that way, and the reason is not
 * stylistic: a tooltip EXPLAINS AN EXISTING CONTROL. A tooltip that rendered its own trigger — the
 * way `Menu` renders its own `Button` — would be a tooltip you can never attach to the icon button,
 * the link or the disabled control that actually needed one. So the trigger is passed in, and what
 * this component owns is the bubble, its behaviour and the wiring between the two.
 *
 * The concession is narrow and worth naming precisely: the consumer controls ONE element, and only
 * as a child that this component hands to react-aria's `TooltipTrigger`. Nothing about the bubble
 * itself is reachable — no `className`, no `style`, no render prop.
 */
export type TooltipProps = {
  /**
   * What the tooltip says. A plain string, not a `ReactNode`, and that is the same call
   * `MenuItemDescriptor.label` makes: a tooltip holds a short phrase, and the moment it holds
   * markup it holds something a user may want to select, click or read at their own pace — none
   * of which a tooltip supports, because it disappears the instant the pointer leaves.
   */
  readonly content: string;
  /**
   * The control the tooltip explains. Must be a focusable component from this package — `Button`
   * or `Link` — because react-aria's `TooltipTrigger` wires itself through focus and hover context
   * that a plain `<button>` or a `<div>` does not consume.
   *
   * THE TYPE CANNOT ENFORCE THAT, and pretending otherwise would be worse than saying so. JSX
   * produces `ReactElement<any>`, which is assignable to any narrower element type, so a
   * `children: ReactElement<ButtonProps>` annotation would reject nothing while reading as though
   * it rejected something. `ReactElement` at least refuses a bare string, an array and `undefined`,
   * which are the mistakes that produce a silently tooltip-less control.
   */
  readonly children: ReactElement;
  readonly placement?: TooltipPlacement;
  /**
   * Milliseconds the pointer must rest on the trigger before the bubble appears. Defaults to
   * react-aria's own 1500ms warmup, which is deliberately long: a tooltip that fires instantly
   * turns a sweep across a toolbar into a sequence of flashes.
   *
   * Keyboard focus is unaffected — a focused trigger shows its tooltip immediately, because
   * someone tabbing to a control has already committed to it.
   */
  readonly delay?: number;
  /**
   * Suppresses the tooltip without unmounting the trigger. For a control whose explanation is only
   * relevant in some states, so a caller does not have to swap the element out and lose its focus.
   */
  readonly isDisabled?: boolean;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
