/**
 * Hand-picked, never a re-export of react-aria-components' own prop types — this component imports
 * none of them.
 *
 * IT IS BUILT ON LINKS, NOT ON A CALLBACK, and that is the decision everything else follows from.
 * The conventional API is `onPageChange(page)`, which makes every page number a button. A page of
 * results has a URL; a button does not. `?page=3` can be bookmarked, shared, opened in a new tab,
 * middle-clicked, previewed in the status bar and reached with the back button, and a click handler
 * is none of those. This is the same reading `breadcrumb.types.ts` applies to `onAction`, and the
 * same reason `Link` requires an `href`.
 *
 * Wiring it to a client router costs nothing: react-aria's `RouterProvider` intercepts the
 * navigation and hands the `href` to your router, so the markup stays a real link.
 */
export type PaginationProps = {
  /**
   * The page being shown, counting from 1 — the way a page number reads to a person and the way it
   * appears in a URL.
   *
   * CLAMPED RATHER THAN TRUSTED. In every real call site this comes from a query string, so
   * `?page=0` and `?page=9999` are user input rather than caller bugs. A trail that rendered
   * nothing, or one whose `aria-current` pointed at a page not in the list, would be a worse answer
   * than one showing the nearest real page. What the REQUEST does with an out-of-range page is
   * still the caller's decision; this only decides what the control looks like.
   */
  readonly page: number;
  /**
   * How many pages there are. A `total` of 1 or less renders NOTHING — a pagination control for a
   * single page is chrome that tells the reader something they can already see, and it takes a
   * landmark in the accessibility tree to say it.
   */
  readonly total: number;
  /**
   * Where a page number goes, as a function of that number. Required: a page with no destination
   * is the callback API this component exists not to be.
   *
   * A function rather than a template string, because the shape of a URL is the application's, not
   * this package's — `/issues?page=3`, `/issues/page/3` and `/issues#3` are all somebody's scheme,
   * and a `{page}` placeholder would be a tiny templating language nobody asked for.
   */
  readonly href: (page: number) => string;
  /**
   * How many pages to show either side of the current one. Defaults to 1, which produces the
   * familiar five-cell core — `1 … 4 5 6 … 20`.
   *
   * BEHAVIOUR RATHER THAN APPEARANCE, which is why it is a prop and not a variant: it changes what
   * is rendered, not how it looks.
   */
  readonly siblings?: number;
  /**
   * The landmark's accessible name. Defaults to "Pagination"; override to localise, or to tell two
   * paginated lists on one page apart.
   */
  readonly label?: string;
  /**
   * The Previous control's accessible name. Defaults to "Previous page"; override to localise.
   *
   * A REAL NAME RATHER THAN THE ARROW IT DRAWS. The glyph is `aria-hidden`, because "left-pointing
   * triangle" is not what the control does.
   */
  readonly previousLabel?: string;
  /** The Next control's accessible name. Defaults to "Next page"; same contract as `previousLabel`. */
  readonly nextLabel?: string;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
