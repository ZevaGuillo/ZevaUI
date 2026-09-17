"use client";

import type { ReactNode } from "react";
import { Button as AriaButton } from "react-aria-components";
import { recipeClassName } from "../internal/recipe-class.js";
import { Spinner } from "../spinner/Spinner.js";
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

/**
 * The busy indicator gets its OWN box, and the reason is the one thing a consumer could not have
 * worked around. `iconSlot` above is `aria-hidden` by contract, so a `Spinner` handed to
 * `iconStart` loses its accessible name and, with it, the announcement react-aria-components wires
 * through `ProgressBarContext` — the button would spin in silence. This box is deliberately not
 * hidden, which is what lets RAC's context reach the `ProgressBar` inside and name it.
 *
 * `size="sm"` is the ring at exactly one body font size, so it matches the cap height of the label
 * beside it rather than towering over it. The label stays at its default `hidden` visibility, which
 * is a VISUAL hiding only: the text is still in the accessibility tree — that is the whole point —
 * while the button draws one word rather than two and therefore does not resize under the pointer
 * that just pressed it.
 *
 * THE CONSEQUENCE IS THAT THE BUTTON'S OWN NAME GROWS, and it is spelled out here because the
 * opposite was assumed first and the code says otherwise. `AriaButton` has no `aria-label` of its
 * own, so its accessible name is computed from its CONTENT — and this span is content that is not
 * `aria-hidden`. Measured, not reasoned: a `<Button isPending pendingLabel="Saving">Save</Button>`
 * computes to **"Saving Save"**, the indicator's label first because it precedes `children` in the
 * DOM. `button.test.ts` pins that exact string.
 *
 * That is accepted rather than worked around. Isolating the name would mean giving the button an
 * `aria-labelledby` pointing at `children` alone, which buys a shorter announcement at the cost of
 * an id this component would have to mint and keep stable; and "Saving Save, button" tells a
 * screen-reader user both what the control is and that it is busy, which is what the state is for.
 * What matters is that the name is a CONTRACT now: change the markup order or the label's
 * visibility and the announcement changes with it.
 */
const pendingSlot = (label: string) => (
  <span data-zui-pending="">
    <Spinner label={label} size="sm" />
  </span>
);

export function Button(props: ButtonProps) {
  const { visual, size, width, iconStart, iconEnd, children, pendingLabel, ...behaviour } = props;

  return (
    // `behaviour` still carries `isPending`, which AriaButton consumes; `pendingLabel` is pulled
    // out above because it is this component's own prop and RAC would forward an unknown one
    // straight onto the DOM node.
    <AriaButton {...behaviour} className={recipeClassName(buttonRecipe, { visual, size, width })}>
      {/*
        The indicator takes the start slot's PLACE rather than sitting beside it. Two round things
        competing for the same spot widen the button under the pointer that just pressed it, which
        is the defect this whole state exists to avoid. `iconEnd` is left alone — it is not in the
        way. Narrowing on `props.isPending` rather than the destructured copy is what proves
        `pendingLabel` is a `string` here: truthiness eliminates the union branch where both are
        `undefined`.
      */}
      {props.isPending ? pendingSlot(props.pendingLabel) : iconSlot("start", iconStart)}
      {children}
      {iconSlot("end", iconEnd)}
    </AriaButton>
  );
}
