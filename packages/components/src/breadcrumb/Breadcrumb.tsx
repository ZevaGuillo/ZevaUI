"use client";

import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { Link } from "../link/Link.js";
import { breadcrumbRecipe } from "./breadcrumb.recipe.js";
import type { BreadcrumbProps } from "./breadcrumb.types.js";

/**
 * IT DOES NOT USE `Breadcrumbs` FROM REACT-ARIA-COMPONENTS, AND THAT IS THE DECISION THIS FILE
 * EXISTS TO JUSTIFY — because every other collection in this package (`Menu`, `Select`, `Tabs`)
 * does, so the departure is the surprising part.
 *
 * Measured against the installed 1.20 types rather than assumed. `Breadcrumbs` gives four things:
 * an `<ol>`, a `CollectionProps` render pipeline, `onAction(key)`, and an `isCurrent` flag on the
 * last item surfaced as `[data-current]`.
 *
 * The first is one line of JSX. The third is what `href` already does, better — a real link is
 * middle-clickable, copyable and previewable in the status bar, and `onAction` is none of those.
 * The fourth is `index === length - 1`, which `breadcrumb.types.ts` encodes in the TYPE instead,
 * by taking the current page as its own prop; a rule enforced by the compiler beats the same rule
 * enforced by a data attribute nobody can see.
 *
 * Which leaves the collection, and that is the one worth paying for elsewhere and not here.
 * `Menu` and `Tabs` need it because they need a keyboard delegate — arrow keys that walk the rows,
 * skip the disabled ones and wrap. A breadcrumb has no such behaviour: it is a list of links, and
 * Tab already walks links. Paying for a collection here would buy a render pipeline and nothing
 * else.
 *
 * THE PRICE IS MEASURED TOO, and it is why this was worth an hour rather than a shrug: `Tabs`
 * costs 31,730 B gzipped, most of it that machinery, while this component is `Link` plus a list.
 * The barrel had 2,448 B of headroom against its ceiling when `Popover` landed. Taking the
 * collection would not have fit.
 *
 * The `<nav>` is rendered here, not inherited: `Breadcrumbs` emits only the `<ol>`, so the
 * landmark is the caller's job upstream — and it is the job most callers skip. See
 * `BreadcrumbProps.label`.
 */
export function Breadcrumb({ items, current, label = "Breadcrumb" }: BreadcrumbProps) {
  const slots = slotRecipeClassNames(breadcrumbRecipe, {});

  return (
    <nav aria-label={label} className={slots.nav}>
      <ol className={slots.list}>
        {items.map((item) => (
          <li key={item.id} className={slots.item}>
            {/*
              `tone="neutral"` with `underline="hover"` — the exact pair `link.recipe.ts` documents
              as correct in a navigation structure and a WCAG 1.4.1 failure inside prose. A trail
              in which every crumb is blue and underlined makes the colour carry no information,
              because there is nothing there that is not a link.
            */}
            <Link href={item.href} tone="neutral" underline="hover">
              {item.label}
            </Link>
            {/*
              A real element rather than a `::before`, so `aria-hidden` has a node to sit on: some
              screen readers announce CSS generated content, and a pseudo-element cannot be hidden
              from them. See breadcrumb.recipe.ts.
            */}
            <span aria-hidden="true" className={slots.separator}>
              /
            </span>
          </li>
        ))}
        <li className={slots.item}>
          {/*
            `aria-current="page"` on plain text, never on a link. This is the crumb a hand-rolled
            trail almost always gets wrong by linking to the page the user is already on.
          */}
          <span aria-current="page" className={slots.current}>
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
