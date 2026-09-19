import type { ReactNode } from "react";
import type { linkRecipe } from "./link.recipe.js";

export type LinkTone = keyof typeof linkRecipe.variants.tone;
export type LinkUnderline = keyof typeof linkRecipe.variants.underline;

/**
 * Where a link opens. Narrowed to the four browsing-context keywords rather than the `string` the
 * DOM allows, because the open-ended half of `target` is a NAMED window ("compare", "preview") —
 * a feature for multi-window applications that also silently lets a typo create a new window
 * nobody ever focuses again. The four keywords cover what a design-system link is for; a caller
 * who genuinely needs a named window is building window management, not a link.
 */
export type LinkTarget = "_self" | "_blank" | "_parent" | "_top";

/**
 * Hand-picked, never a re-export of `LinkProps` from react-aria-components — the same rule
 * `button.types.ts` follows. Re-exporting would drag `className` and `style` back into the public
 * API as functions-or-strings, and this package types both as `never`.
 */
export type LinkProps = {
  /**
   * REQUIRED, unlike react-aria-components' own `href`. Upstream, a link with no destination is
   * still rendered — as an `<a role="link">` with no `href`, driven by `onPress` alone — and that
   * shape is a button wearing a link's clothes: no middle-click, no "open in new tab", no status
   * bar preview, nothing to copy. If the interaction has no URL behind it, it is a `Button`.
   *
   * Client-side routing does NOT need the prop relaxed: react-aria's `RouterProvider` intercepts
   * the navigation and hands the `href` to your router, so the markup stays a real link and the
   * browser affordances survive.
   */
  readonly href: string;
  readonly children: ReactNode;
  readonly tone?: LinkTone;
  readonly underline?: LinkUnderline;
  readonly target?: LinkTarget;
  /**
   * The `rel` attribute, and the one prop here with a DEFAULT THAT DEPENDS ON ANOTHER PROP:
   * `target="_blank"` with no `rel` of its own gets `noopener noreferrer`. See `Link.tsx` for why
   * that is applied rather than merely documented. Supplying `rel` replaces it entirely — an
   * opinion is not a lock, and `rel="me"` or `rel="license"` on a `_blank` link is a legitimate
   * thing to want.
   */
  readonly rel?: string;
  /**
   * Whether the destination is currently unavailable.
   *
   * MEASURED ON REACT-ARIA-COMPONENTS 1.20, BECAUSE THE OBVIOUS GUESS IS WRONG: it does not keep
   * the `<a>` and drop the `href`. A disabled link is rendered as a `<span role="link">` with
   * `aria-disabled="true"` and no `tabindex`, so it leaves the tab order and has nothing to
   * navigate to, while still announcing itself as a link rather than falling silent. The `href` is
   * forwarded onto that span, where it is inert.
   *
   * The element swap is worth knowing about: a consumer stylesheet or test selecting `a[href]`
   * will not match a disabled link. `link.test.ts` pins the whole shape so a change upstream
   * surfaces here first.
   */
  readonly isDisabled?: boolean;
  /**
   * Fires on the navigation, for analytics or for a router that wants the event. It does NOT
   * replace the navigation: `href` still governs where the browser goes.
   */
  readonly onPress?: () => void;
  /**
   * The accessible name, when the link text alone is not descriptive enough out of context —
   * "Read more" repeated eleven times down a page is eleven identical announcements in a screen
   * reader's link list.
   */
  readonly "aria-label"?: string;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};
