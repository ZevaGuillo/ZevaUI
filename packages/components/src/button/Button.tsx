"use client";

import { Button as AriaButton } from "react-aria-components";
import { recipeClassName } from "../internal/recipe-class.js";
import { buttonRecipe } from "./button.recipe.js";
import type { ButtonProps } from "./button.types.js";

export function Button({ visual, size, children, ...behaviour }: ButtonProps) {
  return (
    <AriaButton {...behaviour} className={recipeClassName(buttonRecipe, { visual, size })}>
      {children}
    </AriaButton>
  );
}
