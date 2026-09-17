"use client";

import {
  Button as AriaButton,
  UNSTABLE_Toast as AriaToast,
  UNSTABLE_ToastContent as AriaToastContent,
  UNSTABLE_ToastList as AriaToastList,
  UNSTABLE_ToastRegion as AriaToastRegion,
  Text,
} from "react-aria-components";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { toastRecipe } from "./toast.recipe.js";
import { type QueuedToastContent, toastQueue } from "./toast-queue.js";

/**
 * The one component a consumer renders for toasts, and the only one — everything else is the
 * imperative `toast` object in `toast-queue.ts`. Mount it once, near the application root.
 *
 * BUILT ON UNSTABLE UPSTREAM EXPORTS, KNOWINGLY. Every runtime toast export in
 * react-aria-components carries the `UNSTABLE_` prefix, in the installed 1.20.0 and in 1.21.1
 * alike — measured in the real `.d.ts`, not assumed. `G13` in `__tests__/upstream-gates.test.ts`
 * holds that risk in two places: it fails loudly if any of these names disappears, and it refuses
 * an open-ended dependency range so a consumer cannot silently resolve a future minor that dropped
 * them. What a consumer sees is this component and `toast`, neither of which mentions RAC.
 *
 * RENDERS NOTHING UNTIL A TOAST EXISTS. RAC gates the whole subtree on
 * `visibleToasts.length > 0` and portals it to the document body. That is why mounting this is
 * cheap, and why a landmark region is not announced on a page that never toasts.
 *
 * EVERY PART GETS AN EXPLICIT className, for the reason `Input` and `Spinner` give: RAC stamps its
 * own `react-aria-*` class on any part rendered without one, and those would ship as public API
 * surface consumers could target. `ToastList` is spelled out for this reason alone — passing a
 * render function straight to `ToastRegion` makes RAC render the `<ol>` itself, with its default
 * class and no way to replace it.
 */
export function ToastRegion() {
  const classNames = slotRecipeClassNames(toastRecipe, {});

  return (
    <AriaToastRegion queue={toastQueue} className={classNames.region}>
      {/*
        The generic is SPELLED OUT rather than inferred, and it has to be: `ToastRegion` learns the
        content type from the `queue` prop, but `ToastList` takes no queue — it reads the state off
        a context — so there is nothing for TypeScript to infer from and `toast.content` would
        arrive as `unknown` at every use below.
      */}
      <AriaToastList<QueuedToastContent> className={classNames.list}>
        {({ toast }) => (
          // The tone axis is resolved per toast, because it travels with the message rather than
          // with the region: one stack can hold a success and a danger at the same time.
          <AriaToast
            toast={toast}
            className={slotRecipeClassNames(toastRecipe, { tone: toast.content.tone }).toast}
          >
            {/*
              This is the element that ANNOUNCES. RAC puts `role="alert"` and `aria-atomic` here,
              on the content rather than on the dialog, so assistive tech reads the message when it
              appears while the dialog itself stays the thing F6 navigates to.
            */}
            <AriaToastContent className={classNames.content}>
              {/*
                `Text` with a slot, not a bare element: RAC hands `titleProps`/`descriptionProps`
                down by slot, and those carry the ids `aria-labelledby` and `aria-describedby`
                point at. A plain <div> here would render the same pixels and name nothing.
              */}
              <Text slot="title" className={classNames.title}>
                {toast.content.title}
              </Text>
              {/*
                ALWAYS RENDERED, even with no description. RAC sets `aria-describedby` on the
                dialog unconditionally, so omitting this element would leave that attribute
                pointing at an id nothing owns.

                THE AXE GATE DOES NOT CATCH THAT — measured, and worth recording because the
                opposite was assumed first. Making this element conditional and running the full
                Storybook suite left all 594 tests green: `aria-valid-attr-value` did not fire on
                the dangling reference. So this is not gate-driven; it is here because a reference
                to an id nothing owns is invalid regardless of who checks, and `toast.test.ts`
                pins it precisely because the blocking gate will not.

                The recipe collapses the element with `&:empty`, so an absent description costs no
                space and the two cases look identical.
              */}
              <Text slot="description" className={classNames.description}>
                {toast.content.description}
              </Text>
            </AriaToastContent>
            {/*
              RAC's own Button, not this package's. It needs `slot="close"` to receive the
              `closeButtonProps` RAC provides — a localized `aria-label` and the handler that
              closes this specific toast — and `ButtonProps` here does not carry a `slot`. Adding
              one to the public Button for this single internal use would widen that component's
              API for a caller who has no reason to reach it.
            */}
            <AriaButton slot="close" className={classNames.close}>
              {/*
                Decorative: the button's accessible name is the localized one RAC supplies, so this
                glyph must not append a second word to it.
              */}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" />
              </svg>
            </AriaButton>
          </AriaToast>
        )}
      </AriaToastList>
    </AriaToastRegion>
  );
}
