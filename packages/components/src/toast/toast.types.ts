import type { toastRecipe } from "./toast.recipe.js";

export type ToastTone = keyof typeof toastRecipe.variants.tone;

/**
 * What a caller hands `toast.show()`. A typed object rather than a `ReactNode`, and that is the
 * same rule `Dialog` and `Menu` already follow (ADR-0005 D4): the caller supplies content, the
 * system supplies structure. Here it is also forced by the markup — the title and the description
 * are separate elements because react-aria-components points `aria-labelledby` at one and
 * `aria-describedby` at the other, so a single opaque `ReactNode` could not be wired to either.
 */
export type ToastOptions = {
  /**
   * The message. REQUIRED, and not merely for style: react-aria-components renders each toast as
   * a `role="alertdialog"` whose `aria-labelledby` points at this element, so a toast without a
   * title is a dialog with no accessible name — which fails the blocking accessibility gate.
   *
   * `string`, not `ReactNode`, for the reason `Spinner`'s `label` gives: it becomes an accessible
   * name, and a name assembled from arbitrary markup is a name nobody can predict.
   */
  readonly title: string;
  /**
   * The tone, which selects the accent and nothing else — the text colour is `text.default` in all
   * three, a measured decision inherited from `Alert` (see `toast.recipe.ts`).
   *
   * REQUIRED, with no default, for the reason `Alert`'s is: defaulting would silently pick a
   * semantic meaning the caller never stated.
   */
  readonly tone: ToastTone;
  /**
   * Optional second line, wired as the dialog's `aria-describedby`. Keep it to the detail the
   * title cannot carry — a toast is not a place to put something the user must read.
   */
  readonly description?: string;
  /**
   * Milliseconds after which the toast dismisses itself. OMITTED MEANS IT STAYS until the user
   * dismisses it or `dismiss`/`clear` is called, which is the right default for anything the user
   * may need to act on: a message that removes itself on a timer is a message someone can miss.
   *
   * When a timeout is set, react-aria-components pauses it while the region is hovered or holds
   * focus, so reading a toast cannot race its own countdown.
   */
  readonly timeout?: number;
  /** Styling is owned by the design system. Theme with --zui-* custom properties instead. */
  readonly className?: never;
  readonly style?: never;
};

/**
 * The imperative half of this component, and the reason it is a module singleton rather than a
 * hook or a context: `show()` has to be callable from a submit handler, a router guard, or a
 * `catch` block — places with no React context to read. react-aria-components is built for exactly
 * this shape, which is why `ToastQueue` is a class you construct outside the tree and
 * `useToastQueue` subscribes to it.
 */
export type ToastApi = {
  /** Queues a toast and returns the key that {@link ToastApi.dismiss} closes. */
  show(options: ToastOptions): string;
  /** Closes one toast by the key `show` returned. Closing an already-closed key does nothing. */
  dismiss(key: string): void;
  /**
   * Closes every visible toast at once. Public API rather than a test affordance: a route change
   * or a sign-out should not leave the previous screen's toast floating over the new one.
   */
  clear(): void;
};
