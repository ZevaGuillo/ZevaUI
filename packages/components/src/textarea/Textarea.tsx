"use client";

import { FieldError, Label, Text, TextArea, TextField } from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { textareaRecipe } from "./textarea.recipe.js";
import type { TextareaProps } from "./textarea.types.js";

export function Textarea({
  label,
  description,
  errorMessage,
  size,
  resize,
  rows,
  placeholder,
  ...behaviour
}: TextareaProps) {
  // Every slot gets an explicit className. This is not cosmetic: react-aria-components applies
  // its own default classes (react-aria-TextField, react-aria-TextArea, ...) when className is
  // omitted, and those would ship as public API surface consumers could target.
  const classNames = slotRecipeClassNames(textareaRecipe, { size, resize });

  return (
    // The same `TextField` Input wraps: in RAC 1.20 it is the field-level owner of label,
    // description, validation and the for/id wiring for BOTH text surfaces, and neither it nor
    // `TextArea` is deprecated — checked in dist/types/src, not assumed.
    <TextField {...behaviour} className={classNames.root}>
      <Label className={classNames.label}>{label}</Label>
      <TextArea className={classNames.textarea} rows={rows} placeholder={placeholder} />
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
