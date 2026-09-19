"use client";

import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";
import { recipeClassName } from "../internal/recipe-class.js";
import { tooltipRecipe } from "./tooltip.recipe.js";
import type { TooltipProps } from "./tooltip.types.js";

/**
 * A TOOLTIP DESCRIBES; IT NEVER NAMES. react-aria points the trigger's `aria-describedby` at this
 * bubble, never its `aria-labelledby`, and that is the correct wiring rather than a limitation to
 * work around. The consequence is a contract on the CALLER and it is the single most important
 * thing about this component:
 *
 *   An icon-only button still needs its own `aria-label`. The tooltip is not its name.
 *
 * Two independent reasons, both measurable rather than theoretical. First, a description is
 * announced after the name and many screen-reader configurations suppress it entirely, so a
 * control whose only name came from a tooltip announces as "button" and nothing else. Second,
 * A TOOLTIP DOES NOT EXIST ON TOUCH: there is no hover, and a tap activates the control instead of
 * revealing the bubble. On a phone, information that lives only in a tooltip is information that
 * does not exist. So a tooltip may repeat or expand on what the interface already says; it may
 * never be the only place something is said.
 *
 * The trigger is the consumer's own element and is passed straight through — see
 * `tooltip.types.ts` for why this one component inverts RF-07's usual direction. `TooltipTrigger`
 * needs exactly two children in this order (the trigger, then the tooltip) and wires them through
 * context; there is nothing here to configure about that shape, which is why it is not exposed.
 */
export function Tooltip({ content, children, placement, delay, isDisabled }: TooltipProps) {
  return (
    // `delay` is left undefined rather than defaulted to a number of this package's choosing, so
    // react-aria's own 1500ms warmup applies and stays the documented default in one place.
    <TooltipTrigger delay={delay} isDisabled={isDisabled}>
      {children}
      <AriaTooltip placement={placement} className={recipeClassName(tooltipRecipe, {})}>
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
