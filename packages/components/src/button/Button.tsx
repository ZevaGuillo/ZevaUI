"use client";

import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";
import { recipeClassName } from "../internal/recipe-class.js";
import { buttonRecipe } from "./button.recipe.js";
import type { ButtonProps } from "./button.types.js";

/**
 * The icon box is `data-zui-icon`, not a class, and that is forced rather than preferred. `G5
 * (reverse)` in __tests__/css-gates.test.ts fails any emitted `zui-button__*` class no registered
 * recipe declares, and only a SLOT recipe derives `__slot` classes — Button's is flat. Converting
 * it would rename `.zui-button` to `.zui-button__root`, breaking every consumer stylesheet and
 * `Menu`, which renders a `Button`. The attribute needs no class-contract change and matches the
 * `&[data-disabled]` hooks the recipe already styles against.
 *
 * `aria-hidden` on the box is the decorative contract from `button.types.ts`, applied where the
 * consumer cannot forget it: the accessible name stays the label's.
 */

/**
 * Whether React would render nothing at all for this node.
 *
 * `undefined` is NOT the only way a caller says "no icon", and testing only for it is a real bug
 * rather than a pedantic one: `iconStart={isSaving && <Spinner />}` evaluates to `false`, and
 * `iconStart={icon ?? null}` to `null`. React renders nothing for `null`, `undefined` and either
 * boolean, so guarding on `undefined` alone would wrap NOTHING in a box that is still a flex item
 * — and, because `gap` sits on the button, that empty box would push the label sideways by a full
 * gap with nothing visible in it. The empty string is included for the same reason: it renders no
 * glyph but still creates the flex item.
 *
 * `0` is deliberately absent. React renders `0` as the text "0", so a box around it is correct;
 * a caller who wrote `iconStart={count && <Icon />}` with `count === 0` has a bug in their own
 * expression, and silently swallowing it here would hide it.
 */
const rendersNothing = (icon: ReactNode): boolean =>
  icon === undefined || icon === null || typeof icon === "boolean" || icon === "";

const iconSlot = (position: "start" | "end", icon: ReactNode) =>
  rendersNothing(icon) ? null : (
    <span data-zui-icon={position} aria-hidden="true">
      {icon}
    </span>
  );

export function Button({
  visual,
  size,
  width,
  iconStart,
  iconEnd,
  children,
  ...behaviour
}: ButtonProps) {
  return (
    <AriaButton {...behaviour} className={recipeClassName(buttonRecipe, { visual, size, width })}>
      {iconSlot("start", iconStart)}
      {children}
      {iconSlot("end", iconEnd)}
    </AriaButton>
  );
}
