/**
 * One entry in a rendered pagination trail: either a page you can go to, or a gap standing in for
 * several you cannot see.
 */
export type PaginationItem =
  | { readonly type: "page"; readonly page: number }
  | { readonly type: "gap" };

/**
 * Which page numbers a trail of `total` pages shows when you are on `page`.
 *
 * IN `internal/` AND UNIT-TESTED DIRECTLY, WHICH IS A LESSON RATHER THAN A HABIT. `Avatar`'s CSS
 * escaper was first tested through a rendered DOM, and that test turned out to be worthless —
 * jsdom refused to parse the value and the assertion passed identically for an implementation that
 * did the right thing and one that did nothing. This is the same shape of problem: the interesting
 * behaviour is arithmetic over edge cases, and asserting it through eleven rendered `<li>` elements
 * would test the renderer far more than the rule.
 *
 * THE WINDOW: the first page, the last page, and `siblings` pages either side of the current one.
 * Everything between those groups collapses into a gap.
 *
 * A GAP NEVER HIDES A SINGLE PAGE, and that is the one rule here that is not obvious. The naive
 * condition — "insert a gap wherever consecutive kept pages are more than one apart" — produces
 * `1 … 3 4 5` on page 4, where the ellipsis stands in for page 2 alone. That is strictly worse than
 * `1 2 3 4 5`: it occupies the same width, costs a click, and tells the reader less. So a gap of
 * exactly one page is rendered as that page instead.
 */
export function paginationWindow(
  page: number,
  total: number,
  siblings: number,
): readonly PaginationItem[] {
  if (total < 1) return [];

  // Clamped rather than trusted. `page` comes from a URL or a query string in every real call site,
  // so `?page=0` and `?page=999` are user input rather than caller bugs, and a trail that renders
  // nothing (or renders a current page that is not in the list) is a worse answer than one that
  // shows the nearest real page. The caller still decides what the REQUEST does; this decides only
  // what the control looks like.
  const current = Math.min(Math.max(Math.trunc(page), 1), total);
  const reach = Math.max(Math.trunc(siblings), 0);

  const kept = new Set<number>([1, total]);
  for (let p = current - reach; p <= current + reach; p += 1) {
    if (p >= 1 && p <= total) kept.add(p);
  }

  const items: PaginationItem[] = [];
  let previous = 0;

  for (const p of [...kept].sort((a, b) => a - b)) {
    const skipped = p - previous - 1;
    // `previous === 0` on the first iteration, so the first page never counts as skipping anything.
    if (previous > 0 && skipped === 1) items.push({ type: "page", page: previous + 1 });
    else if (previous > 0 && skipped > 1) items.push({ type: "gap" });

    items.push({ type: "page", page: p });
    previous = p;
  }

  return items;
}
