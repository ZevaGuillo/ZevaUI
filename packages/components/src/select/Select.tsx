"use client";

import {
  Select as AriaSelect,
  Button,
  FieldError,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  SelectValue,
  Text,
} from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { selectRecipe } from "./select.recipe.js";
import type { SelectOptionDescriptor, SelectProps } from "./select.types.js";

/**
 * The trigger, the surface and the rows are all part of the component, not something the consumer
 * supplies. RF-07: there is no prop that changes the rendered DOM shape, no `children`, and no way
 * to reach the markup.
 *
 * `onChange` is narrowed from RAC's `(key: Key | null) => void` to `(value: string) => void`. The
 * `null` arm exists in RAC's type because the same state powers multiple selection, where clearing
 * is reachable; with `selectionMode` fixed to single and no clear affordance rendered, a chosen
 * option can only ever be replaced by another. The guard below is therefore unreachable in
 * practice and is kept anyway, because silently widening the public callback to `string | null`
 * for a case the component cannot produce would be a worse contract than dropping it.
 */
export function Select({
  label,
  options,
  description,
  errorMessage,
  placeholder,
  size,
  onChange,
  ...behaviour
}: SelectProps) {
  // Every slot gets an explicit className. This is not cosmetic: react-aria-components applies its
  // own default classes (react-aria-Select, react-aria-ListBox, ...) when className is omitted,
  // and those would ship as public API surface consumers could target.
  const slots = slotRecipeClassNames(selectRecipe, { size });

  return (
    <AriaSelect
      {...behaviour}
      className={slots.root}
      placeholder={placeholder}
      onChange={(key) => {
        if (key !== null) onChange?.(String(key));
      }}
    >
      {/*
        The render-prop form is load-bearing, not a style. `Select` puts `data-open` and
        `data-invalid` on its ROOT, and the trigger is a RAC `Button` that carries neither. Reading
        them back down with an ancestor-conditioned selector is the approach `checkbox.recipe.ts`
        rejected — the attribute is unqualified, so any ancestor carrying it matches. Stamping them
        onto the parts that need them keeps every rule in select.recipe.ts a local `&[data-*]`.
      */}
      {({ isOpen, isInvalid }) => (
        <>
          <Label className={slots.label}>{label}</Label>
          {/*
            NO `aria-invalid` HERE, AND IT IS NOT AN OVERSIGHT. Measured on the rendered 1.20
            output: react-aria-components sets `aria-invalid` nowhere for a Select — not on the
            trigger, not on the hidden native select — and passing one in does not survive either,
            because RAC's `Button` filters its DOM props through an allowlist that carries
            `data-*` and the labelling ARIA attributes but not `aria-invalid`. `Input` and
            `Textarea` both announce the state, so this control announces strictly less than they
            do, and the gap is upstream rather than in this recipe.

            It is acceptable for the same reason ADR-0006 D3 accepts its measured 1.4.11 gap: the
            invalid state is not carried by colour alone. `FieldError` renders real text and RAC
            wires it into the trigger's `aria-describedby`, so a screen reader user still hears
            what is wrong — they just do not hear that the field IS invalid as a state.
            `select.test.ts` pins the absence, so the day RAC adds it the test says so.
          */}
          <Button
            className={slots.trigger}
            data-open={isOpen || undefined}
            data-invalid={isInvalid || undefined}
          >
            {/*
              RAC's default `SelectValue` children render the chosen row's FULL content, which for
              an option with supporting copy would drag that copy onto the closed trigger. Measured
              in the 1.20 dist: `defaultChildren` is `rendered[0]` for single selection. Rendering
              `selectedText` instead — the row's `textValue` — keeps the trigger to the label,
              while `defaultChildren` is still used for the empty state so RAC's own localized
              placeholder survives when the consumer supplies none.
            */}
            <SelectValue className={slots.value}>
              {({ isPlaceholder, selectedText, defaultChildren }) =>
                isPlaceholder ? defaultChildren : selectedText
              }
            </SelectValue>
            <span className={slots.icon} aria-hidden="true" data-open={isOpen || undefined} />
          </Button>
          {description !== undefined && (
            <Text slot="description" className={slots.description}>
              {description}
            </Text>
          )}
          {/* Renders nothing at all while the control is valid — verified against RAC's DOM
              output, so no empty element occupies layout in the common case. */}
          <FieldError className={slots.error}>{errorMessage}</FieldError>
          <Popover className={slots.popover}>
            <ListBox className={slots.listbox} items={options}>
              {(option: SelectOptionDescriptor) => (
                <ListBoxItem
                  id={option.value}
                  className={slots.item}
                  textValue={option.label}
                  isDisabled={option.isDisabled}
                >
                  {/*
                    `Text slot="label"` is not decoration: react-aria points the row's
                    `aria-labelledby` at the id it hands to that slot, so a bare string child would
                    leave the row with a dangling reference and no accessible name at all.
                  */}
                  <Text slot="label" className={slots.itemLabel}>
                    {option.label}
                  </Text>
                  {option.description === undefined ? null : (
                    <Text slot="description" className={slots.itemDescription}>
                      {option.description}
                    </Text>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </>
      )}
    </AriaSelect>
  );
}
