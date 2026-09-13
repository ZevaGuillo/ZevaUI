"use client";

import { ProgressBar as AriaProgressBar, Label } from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { progressRecipe } from "./progress.recipe.js";
import type { ProgressProps } from "./progress.types.js";

/**
 * RAC's spelling for a state attribute that is present when set and absent when not — `"true"`
 * rather than `""`, matching what it puts on its own roots, so the two never disagree.
 */
const stateAttribute = (isOn: boolean) => (isOn ? "true" : undefined);

/**
 * The label goes through RAC's `<Label>` rather than a `label` prop, because there is no such
 * prop: `ProgressBarProps` is declared as `Omit<AriaProgressBarProps, 'label'>` in 1.20, and the
 * component instead publishes `LabelContext` to its children with `elementType: 'span'`. That
 * span — not a `<label>` — is what `aria-labelledby` points at, and react-aria's own comment gives
 * the reason: a progress bar is not an HTML input element, so a real `<label>` here would be a
 * label for no control at all.
 */
export function Progress({ label, size, ...behaviour }: ProgressProps) {
  // Every slot gets an explicit className, for the reason Input gives: react-aria-components
  // stamps its own `react-aria-*` classes on any part rendered without one, and those would ship
  // as public API surface consumers could target.
  const classNames = slotRecipeClassNames(progressRecipe, { size });

  return (
    <AriaProgressBar {...behaviour} className={classNames.root}>
      {({ percentage, valueText, isIndeterminate }) => (
        <>
          <div className={classNames.header}>
            <Label className={classNames.label}>{label}</Label>
            {/*
              Rendered only when there is a value to render: RAC drops `aria-valuetext` while
              indeterminate, so `valueText` is `undefined` there and an empty span would leave a
              gap in the header for text that does not exist.

              `aria-hidden` because the progressbar role already announces this exact string
              through `aria-valuetext`. Without it the value is announced twice — once as the
              widget's value and once as its content. Same argument as Checkbox's decorative box.
            */}
            {valueText === undefined ? null : (
              <span className={classNames.valueText} aria-hidden="true">
                {valueText}
              </span>
            )}
          </div>
          {/*
            The bar is decoration: the value and the name already live on the root RAC renders
            with `role="progressbar"`, so exposing this subtree would describe the control twice.

            The track carries NO `data-indeterminate` of its own: nothing about it changes between
            the two states, and an attribute no rule reads is markup shipped for nobody. The flag
            goes on the fill alone, which is the part that actually repaints — and it is stamped
            there rather than read from the root through a descendant selector, because an
            unqualified `[data-indeterminate] .zui-progress__fill` matches ANY ancestor carrying
            that attribute. See the argument in progress.recipe.ts.
          */}
          <div className={classNames.track} aria-hidden="true">
            <div
              className={classNames.fill}
              data-indeterminate={stateAttribute(isIndeterminate)}
              // THE ONE INLINE STYLE IN THIS PACKAGE, and the reason is structural rather than a
              // shortcut: a percentage that changes on every render has no class to hang off, and
              // a static stylesheet cannot name it. Everything else about the fill — colour,
              // corner, height, the sweep — is in the recipe, and progress.test.ts asserts this
              // object never grows a second declaration.
              style={percentage === undefined ? undefined : { inlineSize: `${percentage}%` }}
            />
          </div>
        </>
      )}
    </AriaProgressBar>
  );
}
