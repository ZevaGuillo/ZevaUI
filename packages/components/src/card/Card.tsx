import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { cardRecipe } from "./card.recipe.js";
import type { CardPartProps, CardProps } from "./card.types.js";

/**
 * The first server-renderable component in this package (the presentational half of ADR-0001
 * D3): Card needs no react-aria-components and no hooks, so it carries no "use client" directive.
 * Button, Input, Dialog and Menu are all client; Card is the first exercise of the other half.
 *
 * `Card.Header` / `Card.Body` / `Card.Footer` are plain dot-notation parts, attached below with
 * `Object.assign`. Each renders its own slot class independently — no React context, no
 * `Children.map`, no cloning, no ordering enforcement — because a card's zones are arbitrary
 * content a consumer cannot structurally break (see card.recipe.ts for the full reasoning on why
 * this differs from Dialog/Menu's typed-props composition).
 */
function CardRoot({ surface, children }: CardProps) {
  const slots = slotRecipeClassNames(cardRecipe, { surface });
  return <div className={slots.root}>{children}</div>;
}

function Header({ children }: CardPartProps) {
  const slots = slotRecipeClassNames(cardRecipe, {});
  return <div className={slots.header}>{children}</div>;
}

function Body({ children }: CardPartProps) {
  const slots = slotRecipeClassNames(cardRecipe, {});
  return <div className={slots.body}>{children}</div>;
}

function Footer({ children }: CardPartProps) {
  const slots = slotRecipeClassNames(cardRecipe, {});
  return <div className={slots.footer}>{children}</div>;
}

export const Card = Object.assign(CardRoot, { Header, Body, Footer });
