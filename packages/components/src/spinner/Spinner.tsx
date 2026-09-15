"use client";

import { ProgressBar as AriaProgressBar, Label } from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { spinnerRecipe } from "./spinner.recipe.js";
import type { SpinnerProps } from "./spinner.types.js";

/**
 * A busy indicator: an operation is under way and nothing can be said about how far along it is.
 *
 * Built on the SAME react-aria-components primitive as `Progress`, because that is what a spinner
 * is — measured, not assumed: RAC 1.20 ships no `Spinner` at all (only `ProgressBar/` and
 * `Meter/`), and an indeterminate `ProgressBar` already publishes exactly the contract a busy
 * indicator owes: `role="progressbar"` with `aria-valuenow` and `aria-valuetext` ABSENT, which is
 * the state RAC's own `:not([aria-valuenow])` selector keys off.
 *
 * Two components over one primitive rather than one component with an `appearance` axis, and the
 * reason is the API rather than the CSS: a single recipe would carry four crossed designs (bar or
 * circle × measured or indeterminate), and the case a UI library is asked for most often would end
 * up with the longest spelling — `<Progress appearance="circle" isIndeterminate />` instead of
 * `<Spinner />`. Everything the two genuinely share lives in `internal/progress-surface.ts`.
 *
 * There is no `value`, no `minValue`/`maxValue`, no `formatOptions` and no `isIndeterminate`
 * escape hatch, and their absence is the point: this component cannot be talked into claiming
 * progress it does not know about. A caller who HAS a number wants `Progress`.
 *
 * The label goes through RAC's `<Label>` rather than a `label` prop, because there is no such
 * prop — see the measured contract in `internal/progress-surface.ts`. The element RAC renders it
 * into is a `<span>`, not a `<label>`, for the reason react-aria states in its own source: a
 * progress bar is not an HTML input element, so a real `<label>` here would be a label for no
 * control at all.
 */
export function Spinner({ label, labelVisibility, size }: SpinnerProps) {
  // Every slot gets an explicit className, for the reason Input gives: react-aria-components
  // stamps its own `react-aria-*` classes on any part rendered without one, and those would ship
  // as public API surface consumers could target.
  const classNames = slotRecipeClassNames(spinnerRecipe, { labelVisibility, size });

  return (
    // `isIndeterminate` is hard-coded rather than exposed. A busy indicator with a value would be
    // a progress bar drawn as a circle, and this package already has the component for that.
    <AriaProgressBar isIndeterminate className={classNames.root}>
      {/*
        The ring is decoration: the state and the name both live on the root RAC renders with
        `role="progressbar"`, so exposing this box would describe the control twice. It carries no
        state attribute of its own either — unlike Progress's fill, which has two states to tell
        apart; this one only ever has the one.
      */}
      <div className={classNames.indicator} aria-hidden="true" />
      {/*
        Always rendered, whatever `labelVisibility` says: this is the element `aria-labelledby`
        points at. Hiding it is done in the recipe with the clip-rect pattern, which keeps it in
        the accessibility tree — `display: none` would take the spinner's name away with it.
      */}
      <Label className={classNames.label}>{label}</Label>
    </AriaProgressBar>
  );
}
