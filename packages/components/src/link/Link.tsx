"use client";

import { Link as AriaLink } from "react-aria-components";
import { recipeClassName } from "../internal/recipe-class.js";
import { linkRecipe } from "./link.recipe.js";
import type { LinkProps } from "./link.types.js";

/**
 * What a `target="_blank"` link gets when the caller names no `rel` of its own.
 *
 * `noopener` alone is what modern browsers already imply for `_blank`, so it is belt-and-braces
 * for the ones that do not. `noreferrer` is the half that is NOT implied anywhere and the half
 * that matters: without it the destination receives the full URL of the page that linked to it,
 * which on an authenticated page is a path, a query string and sometimes a token handed to a
 * third party the user only clicked through to.
 *
 * APPLIED RATHER THAN DOCUMENTED, and that is the point. Every guide that covers this writes it
 * as a rule for the author to remember; a rule you have to remember on every call site is a rule
 * that gets forgotten on the one page that mattered. It is a default, not a lock — see
 * `LinkProps.rel`.
 */
const BLANK_TARGET_REL = "noopener noreferrer";

export function Link(props: LinkProps) {
  const { tone, underline, children, target, rel, ...behaviour } = props;

  return (
    // `behaviour` carries `href`, `isDisabled`, `onPress` and `aria-label` — all of which RAC
    // consumes or forwards. `tone` and `underline` are pulled out because they are this package's
    // own axes and RAC would forward an unknown prop straight onto the `<a>` element.
    <AriaLink
      {...behaviour}
      target={target}
      // `rel ?? …` rather than a check on whether the key was passed: a caller writing
      // `rel={undefined}` means "I did not choose one", which is the same request as omitting it.
      rel={target === "_blank" ? (rel ?? BLANK_TARGET_REL) : rel}
      className={recipeClassName(linkRecipe, { tone, underline })}
    >
      {children}
    </AriaLink>
  );
}
