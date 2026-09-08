"use client";

import { SwitchButton, SwitchField } from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { switchRecipe } from "./switch.recipe.js";
import type { SwitchProps } from "./switch.types.js";

/**
 * RAC's spelling for a state attribute that is present when set and absent when not — `"true"`
 * rather than `""`, matching what it puts on its own elements so the two never disagree in a
 * snapshot. Same helper Checkbox uses, kept local rather than shared: two copies of four tokens
 * is cheaper than a shared module that would have to be imported by every future control.
 */
const stateAttribute = (isOn: boolean) => (isOn ? "true" : undefined);

/**
 * Built on `SwitchField` + `SwitchButton`, NOT on the flat `Switch`, and that is a correctness
 * decision rather than a stylistic one. Measured against react-aria-components 1.20:
 *
 *   * `Switch` is marked `@deprecated Use SwitchField + SwitchButton instead`.
 *   * `SwitchProps` OMITS `isRequired`, `isInvalid`, `validate`, `validationState` and
 *     `validationBehavior` from the props it inherits, and `SwitchRenderProps` declares neither
 *     `isInvalid` nor `isRequired`. A switch built on the flat component therefore could not
 *     offer the two states `Checkbox` already has — the gap is upstream, not a design choice
 *     this package would be free to make.
 *
 * The cost, named honestly: one extra wrapper element compared to `Checkbox`, whose root IS its
 * label. `Checkbox` still uses the flat (also deprecated) `Checkbox` component; aligning it is a
 * separate change, because it would re-render every one of its screenshot baselines.
 */
export function Switch({ children, size, ...behaviour }: SwitchProps) {
  // Every slot gets an explicit className, for the reason Input gives: react-aria-components
  // stamps its own `react-aria-*` classes on any part rendered without one, and those would ship
  // as public API surface consumers could target. Here that is both wrappers —
  // `react-aria-SwitchField` on the div and `react-aria-SwitchButton` on the label.
  const classNames = slotRecipeClassNames(switchRecipe, { size });

  return (
    <SwitchField {...behaviour} className={classNames.root}>
      <SwitchButton className={classNames.control}>
        {({ isSelected, isHovered, isFocusVisible, isDisabled, isInvalid }) => (
          <>
            {/*
              The track is decoration: the switch's state and name already live on the real input
              RAC renders and hides, so exposing this span would announce the control twice.

              The `data-*` below are what the recipe's `&[data-*]` rules hang off. They are
              stamped here rather than read from an ancestor through a descendant selector
              because an unqualified `[data-hovered] .zui-switch__track` matches ANY hovered
              ancestor — a Menu row, a Card — and would light every switch inside it. See the
              argument in switch.recipe.ts, inherited from checkbox.recipe.ts. They are inert to
              assistive tech, which never sees this span.
            */}
            <span
              className={classNames.track}
              aria-hidden="true"
              data-selected={stateAttribute(isSelected)}
              data-hovered={stateAttribute(isHovered)}
              data-focus-visible={stateAttribute(isFocusVisible)}
              data-disabled={stateAttribute(isDisabled)}
              data-invalid={stateAttribute(isInvalid)}
            >
              {/*
                The thumb carries no state of its own: it is moved by the track flipping
                `justifyContent`, so there is nothing here for a selector to key off.
              */}
              <span className={classNames.thumb} />
            </span>
            <span className={classNames.label}>{children}</span>
          </>
        )}
      </SwitchButton>
    </SwitchField>
  );
}
