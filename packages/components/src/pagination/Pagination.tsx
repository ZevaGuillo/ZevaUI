"use client";

import { paginationWindow } from "../internal/pagination-window.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { Link } from "../link/Link.js";
import { paginationRecipe } from "./pagination.recipe.js";
import type { PaginationProps } from "./pagination.types.js";

/**
 * The second collection in this package built WITHOUT react-aria-components' collection machinery,
 * after `Breadcrumb`, and for the same measured reason: what a collection buys is a keyboard
 * delegate — arrow keys that walk the items, skip disabled ones and wrap — and a row of links needs
 * none of that, because Tab already walks links. `Breadcrumb.tsx` holds the full argument and the
 * weight it saves.
 *
 * It is `clientOnly: true` by composition rather than by its own need: it renders this package's
 * `Link`, which is built on RAC's and therefore carries `import 'client-only'` transitively.
 *
 * NOTHING IS RENDERED FOR A SINGLE PAGE. A pagination control for one page tells the reader
 * something they can already see, and costs a landmark in the accessibility tree to say it. This is
 * the one case where returning `null` is the design rather than a guard.
 */
export function Pagination({
  page,
  total,
  href,
  siblings = 1,
  label = "Pagination",
  previousLabel = "Previous page",
  nextLabel = "Next page",
}: PaginationProps) {
  if (total <= 1) return null;

  const slots = slotRecipeClassNames(paginationRecipe, {});
  const items = paginationWindow(page, total, siblings);
  // Re-derived rather than trusting `page`, so the edge controls agree with the `aria-current` the
  // window computed: both are clamped by the same rule, in one place.
  const current = items.find((item) => item.type === "page" && item.page === page)
    ? page
    : Math.min(Math.max(Math.trunc(page), 1), total);

  return (
    <nav aria-label={label} className={slots.nav}>
      <ol className={slots.list}>
        <li className={slots.item}>{edge(current > 1, href(current - 1), previousLabel, "‹")}</li>

        {items.map((item, index) =>
          item.type === "gap" ? (
            // Keyed by position, which is the honest key here: a gap has no identity of its own —
            // it is the ABSENCE of pages — and two gaps in one trail are distinguished by nothing
            // except where they sit. `biome-ignore` rather than minting a fake id, because an id
            // that is really an index is the same key wearing a disguise.
            // biome-ignore lint/suspicious/noArrayIndexKey: a gap has no identity but its position
            <li key={`gap-${index}`} className={slots.item}>
              {/*
                A real element rather than a `::before`, so `aria-hidden` has a node to sit on —
                some screen readers announce CSS generated content, and a pseudo-element cannot be
                hidden from them. Same reasoning, same shape, as `Breadcrumb`'s separator.
              */}
              <span aria-hidden="true" className={slots.gap}>
                …
              </span>
            </li>
          ) : (
            <li key={item.page} className={slots.item}>
              {item.page === current ? (
                // `aria-current="page"` on plain text, never on a link. A link to the page you are
                // already on is announced as a link and clicks to no effect — the defect
                // `breadcrumb.types.ts` restructured its whole API to make unrepresentable.
                <span aria-current="page" className={slots.current}>
                  {item.page}
                </span>
              ) : (
                <Link href={href(item.page)} tone="neutral" underline="hover">
                  {item.page}
                </Link>
              )}
            </li>
          ),
        )}

        <li className={slots.item}>{edge(current < total, href(current + 1), nextLabel, "›")}</li>
      </ol>
    </nav>
  );
}

/**
 * One end of the trail: a real link when there is somewhere to go, and a silent placeholder when
 * there is not.
 *
 * A PLACEHOLDER RATHER THAN A DIMMED CONTROL, which is the opposite of what most pagination
 * components ship. A disabled "Previous" on page 1 announces as "Previous page, dimmed" — a control
 * offered and then withdrawn, on every single first page, to everyone navigating by keyboard or by
 * screen reader. The fact it conveys is "you are at the start", and `aria-current="page"` on the
 * first number already says exactly that, in the place a reader is already looking.
 *
 * So the cell is reserved visually — the row must not shift when you reach either end — and left
 * out of the accessibility tree entirely.
 *
 * THE GLYPH IS `aria-hidden` EVEN ON THE LIVE LINK, and the name comes from `previousLabel` /
 * `nextLabel` instead. A link whose only content is `‹` computes its accessible name from that
 * character, and "single left-pointing angle quotation mark" is not what the control does.
 */
function edge(available: boolean, destination: string, name: string, glyph: string) {
  const slots = slotRecipeClassNames(paginationRecipe, {});

  if (!available) {
    return (
      <span aria-hidden="true" className={slots.edge}>
        {glyph}
      </span>
    );
  }

  return (
    <Link href={destination} tone="neutral" underline="hover" aria-label={name}>
      <span aria-hidden="true">{glyph}</span>
    </Link>
  );
}
