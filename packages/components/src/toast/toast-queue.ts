import { UNSTABLE_ToastQueue as AriaToastQueue } from "react-aria-components";
import type { ToastApi, ToastOptions } from "./toast.types.js";

/**
 * What the queue stores per toast. `timeout` is deliberately NOT in here: react-aria-components
 * takes it as a queue OPTION rather than as content, because the queue owns the timer. Splitting
 * the caller's single object into the two shapes RAC wants is this module's whole job — the
 * alternative, exposing RAC's two-argument shape, would leak an upstream API this package has
 * committed to wrapping.
 */
export type QueuedToastContent = Omit<ToastOptions, "timeout" | "className" | "style">;

/**
 * ONE QUEUE FOR THE WHOLE APPLICATION, constructed at module scope.
 *
 * That is not a shortcut around a provider — it is the shape react-aria-components designed for.
 * `ToastQueue` is a plain class with a `subscribe` method precisely so it can live outside React,
 * and `useToastQueue` exists to subscribe a component to one. The reason it matters is the call
 * site: `toast.show()` has to work from a submit handler, an interceptor, or a `catch` block, and
 * none of those can read a context.
 *
 * `maxVisibleToasts: 3` is a floor on usability rather than a style choice. Every visible toast
 * covers part of the page, and a stack tall enough to reach the top of a short viewport is a
 * modal nobody asked for. Overflow is not dropped — RAC holds the rest in the queue and promotes
 * them as the visible ones close.
 */
const queue = new AriaToastQueue<QueuedToastContent>({ maxVisibleToasts: 3 });

/** Internal: the object `ToastRegion` subscribes to. Not part of the public API. */
export const toastQueue = queue;

export const toast: ToastApi = {
  show({ timeout, ...content }: ToastOptions): string {
    // `timeout` is passed through only when the caller set one. Handing RAC an explicit
    // `undefined` would be equivalent today, but it also spells "no timeout" as a value rather
    // than as an absence, and the two read differently the next time someone changes this.
    return queue.add(content, timeout === undefined ? undefined : { timeout });
  },
  dismiss(key: string): void {
    queue.close(key);
  },
  clear(): void {
    queue.clear();
  },
};
