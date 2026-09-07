"use client";

import { Checkbox as AriaCheckbox } from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { checkboxRecipe } from "./checkbox.recipe.js";
import type { CheckboxProps } from "./checkbox.types.js";

/**
 * The glyph inside the box, drawn rather than typed.
 *
 * An SVG path, not a "✓" character: a text checkmark renders in whatever font resolves, which is
 * the one thing this package cannot control on a consumer's page — the tick is a different shape
 * (or a missing-glyph box) depending on what the system substitutes. The path is the same two
 * strokes everywhere.
 *
 * The `viewBox` is a unitless 16-square, so the drawing scales with the box the `size` variant
 * gives it and needs no per-size artwork.
 *
 * The `<svg>` carries its own `aria-hidden`, which is redundant at runtime — the `control` span
 * already hides the whole subtree, and the accessible name comes from the label RAC associates
 * with the real input. It is declared anyway because it is the honest statement of intent for a
 * decorative graphic, and because `noSvgWithoutTitle` reads the element in isolation and cannot
 * see the parent. The alternative it would otherwise want, a `<title>`, would be worse: a title
 * on a graphic that duplicates the label is exactly the second announcement this component is
 * built to avoid.
 */
const CheckPath = () => <path d="M3.5 8.5 L6.5 11.5 L12.5 4.5" />;

const DashPath = () => <path d="M4 8 L12 8" />;

/**
 * RAC's spelling for a state attribute that is present when set and absent when not — `"true"`
 * rather than `""`, matching what it puts on the root, so the two never disagree in a snapshot.
 */
const stateAttribute = (isOn: boolean) => (isOn ? "true" : undefined);

export function Checkbox({ children, size, ...behaviour }: CheckboxProps) {
  // Every slot gets an explicit className, for the reason Input gives: react-aria-components
  // stamps its own `react-aria-*` classes on any part rendered without one, and those would ship
  // as public API surface consumers could target.
  const classNames = slotRecipeClassNames(checkboxRecipe, { size });

  return (
    <AriaCheckbox {...behaviour} className={classNames.root}>
      {({ isSelected, isIndeterminate, isHovered, isFocusVisible, isDisabled, isInvalid }) => (
        <>
          {/*
            The box is decoration: the checkbox's state and name already live on the real input
            RAC renders and hides, so exposing this span would announce the control twice.

            The `data-*` below are what the recipe's `&[data-*]` rules hang off. They are stamped
            here rather than read from the root through a descendant selector because an
            unqualified `[data-hovered] .zui-checkbox__control` matches ANY hovered ancestor —
            a Menu row, a Card — and would light every checkbox inside it. See the argument in
            checkbox.recipe.ts. They are inert to assistive tech, which never sees this span.
          */}
          <span
            className={classNames.control}
            aria-hidden="true"
            data-selected={stateAttribute(isSelected)}
            data-indeterminate={stateAttribute(isIndeterminate)}
            data-hovered={stateAttribute(isHovered)}
            data-focus-visible={stateAttribute(isFocusVisible)}
            data-disabled={stateAttribute(isDisabled)}
            data-invalid={stateAttribute(isInvalid)}
          >
            <svg className={classNames.indicator} viewBox="0 0 16 16" aria-hidden="true">
              {/*
                Indeterminate wins over selected, and that order is not arbitrary. Measured
                against RAC 1.20: with both flags set the input renders `checked === true` AND
                `indeterminate === true`, so testing `isSelected` first would draw a tick on a
                control that assistive tech announces as "mixed".
              */}
              {isIndeterminate ? <DashPath /> : isSelected ? <CheckPath /> : null}
            </svg>
          </span>
          <span className={classNames.label}>{children}</span>
        </>
      )}
    </AriaCheckbox>
  );
}
