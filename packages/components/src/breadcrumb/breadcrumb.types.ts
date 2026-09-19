/**
 * One ANCESTOR of the current page, described as data rather than composed as markup — the same
 * rule `MenuItemDescriptor` follows, and for the same reason: `<ol>` accepts only `<li>` children,
 * and children composition would hand the consumer the list item itself, which is structure rather
 * than content.
 *
 * `href` IS REQUIRED HERE, AND THAT IS THE HALF THE SPLIT BUYS. See `BreadcrumbProps.current`.
 */
export type BreadcrumbDescriptor = {
  /** Stable identity of the crumb. Used as the list key; never rendered. */
  readonly id: string;
  /** The crumb's visible text, and the link's accessible name. */
  readonly label: string;
  /** Where the crumb goes. Required, because an ancestor with nowhere to go is not a crumb. */
  readonly href: string;
};

/**
 * Hand-picked, never a re-export of react-aria-components' own prop types.
 *
 * THE ANCESTORS AND THE CURRENT PAGE ARE TWO SEPARATE PROPS, WHICH IS THE ONE DESIGN DECISION
 * WORTH READING THIS FILE FOR. The conventional shape is a single `items` array in which the last
 * entry is implicitly the current page — which is how react-aria-components models it, marking
 * that entry `[data-current]`. It also means the type permits two states that are always wrong: an
 * ancestor with no `href` (a crumb that goes nowhere) and a current page WITH one (a link to the
 * page you are already on, which screen readers announce as a link and sighted users click to no
 * effect).
 *
 * Splitting them makes both unrepresentable. `items` are ancestors and every one needs a
 * destination; `current` is a string because where you are is text, not a link. The position rule
 * disappears along with them — nothing here depends on "the last one is special", so nothing can
 * get that wrong.
 */
export type BreadcrumbProps = {
  /**
   * The ancestors, outermost first. May be empty: a top-level page has a trail of exactly one
   * crumb, itself.
   */
  readonly items: readonly BreadcrumbDescriptor[];
  /**
   * The current page's visible text, rendered as plain text carrying `aria-current="page"` — never
   * as a link. A breadcrumb linking to the page it is already on is the most common defect in
   * hand-rolled trails, and the type is what stops it here.
   */
  readonly current: string;
  /**
   * The landmark's accessible name. Defaults to "Breadcrumb"; override to localise, or to
   * distinguish two trails on one page.
   *
   * It names a `<nav>`, which is the whole reason this component renders one: a landmark is how
   * someone navigating by structure jumps to the trail, and an `<ol>` on its own is not one.
   * react-aria-components' `Breadcrumbs` renders only the list — the landmark is the caller's job
   * there, and it is the job most callers skip.
   */
  readonly label?: string;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
