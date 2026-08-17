"use client";

import { Input as AriaInput, FieldError, Label, Text, TextField } from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { inputRecipe } from "./input.recipe.js";
import type { InputProps } from "./input.types.js";

export function Input({
  label,
  description,
  errorMessage,
  size,
  type = "text",
  placeholder,
  autoComplete,
  ...behaviour
}: InputProps) {
  // Every slot gets an explicit className. This is not cosmetic: react-aria-components applies
  // its own default classes (react-aria-TextField, react-aria-Input, ...) when className is
  // omitted, and those would ship as public API surface consumers could target.
  const classNames = slotRecipeClassNames(inputRecipe, { size });

  return (
    <TextField {...behaviour} className={classNames.root}>
      <Label className={classNames.label}>{label}</Label>
      <AriaInput
        className={classNames.input}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      {description !== undefined && (
        <Text slot="description" className={classNames.description}>
          {description}
        </Text>
      )}
      {/* Renders nothing at all while the field is valid — verified against RAC's DOM output,
          so no empty element occupies layout in the common case. */}
      <FieldError className={classNames.error}>{errorMessage}</FieldError>
    </TextField>
  );
}
