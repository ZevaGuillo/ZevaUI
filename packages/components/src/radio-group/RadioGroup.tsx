"use client";

import {
  RadioGroup as AriaRadioGroup,
  Label,
  RadioButton,
  RadioField,
} from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { radioGroupRecipe } from "./radio-group.recipe.js";
import type { RadioGroupProps } from "./radio-group.types.js";

/**
 * RAC's spelling for a state attribute that is present when set and absent when not — `"true"`
 * rather than `""`, matching what it puts on its own elements so the two never disagree in a
 * snapshot. Third local copy, kept local for the reason Switch gives: two lines duplicated is
 * cheaper than a shared module every future control would have to import.
 */
const stateAttribute = (isOn: boolean) => (isOn ? "true" : undefined);

/**
 * Built on `RadioField` + `RadioButton` rather than the flat `Radio`, because RAC 1.20 marks that
 * one `@deprecated Use RadioField + RadioButton instead`.
 *
 * The resemblance to `Switch` stops at the shape. `Switch` HAD to move off its flat component,
 * which omitted `isRequired`/`isInvalid` outright; here `RadioProps` and `RadioFieldProps` extend
 * the same `Omit<AriaRadioProps, 'children'>` and `RadioButtonRenderProps extends
 * RadioRenderProps`, so nothing is gained in capability. What is paid is one extra wrapper
 * element, and what is bought is not being deprecated. Said plainly rather than dressed up.
 */
export function RadioGroup({ label, options, size, orientation, ...behaviour }: RadioGroupProps) {
  // Every part gets an explicit className, for the reason Input gives: react-aria-components
  // stamps its own `react-aria-*` classes on any element rendered without one, and those would
  // ship as public API surface consumers could target. Here that is four of them —
  // `react-aria-RadioGroup`, `react-aria-Label`, `react-aria-RadioField`, `react-aria-RadioButton`.
  const classNames = slotRecipeClassNames(radioGroupRecipe, { size, orientation });

  return (
    <AriaRadioGroup {...behaviour} orientation={orientation} className={classNames.root}>
      <Label className={classNames.label}>{label}</Label>
      <div className={classNames.list}>
        {options.map((option) => (
          <RadioField
            key={option.value}
            value={option.value}
            isDisabled={option.isDisabled}
            className={classNames.option}
          >
            <RadioButton className={classNames.control}>
              {({ isSelected, isHovered, isFocusVisible, isDisabled, isInvalid }) => (
                <>
                  {/*
                    The marker is decoration: the radio's state and name already live on the real
                    input RAC renders and hides, so exposing this span would announce the option
                    twice.

                    The `data-*` below are what the recipe's `&[data-*]` rules hang off. They are
                    stamped here rather than read from an ancestor through a descendant selector,
                    because an unqualified `[data-hovered] .zui-radio-group__marker` matches ANY
                    hovered ancestor — a Menu row, a Card — and would light every radio inside it.
                    See the argument in radio-group.recipe.ts, inherited from checkbox.recipe.ts.
                  */}
                  <span
                    className={classNames.marker}
                    aria-hidden="true"
                    data-selected={stateAttribute(isSelected)}
                    data-hovered={stateAttribute(isHovered)}
                    data-focus-visible={stateAttribute(isFocusVisible)}
                    data-disabled={stateAttribute(isDisabled)}
                    data-invalid={stateAttribute(isInvalid)}
                  >
                    {/*
                      The dot carries `data-selected` of its own rather than being reached from
                      the marker's, so its reveal rule stays local and gate-checked. The
                      alternative would hardcode this slot's class name into a selector string on
                      the marker, which no gate reads — see radio-group.recipe.ts.
                    */}
                    <span className={classNames.dot} data-selected={stateAttribute(isSelected)} />
                  </span>
                  <span className={classNames.optionLabel}>{option.label}</span>
                </>
              )}
            </RadioButton>
          </RadioField>
        ))}
      </div>
    </AriaRadioGroup>
  );
}
