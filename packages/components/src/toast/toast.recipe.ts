import type { SlotRecipeConfig } from "@pandacss/dev";

export const TOAST_RECIPE_KEY = "toast";

/**
 * A toast is an Alert that floats, and this recipe is deliberately its sibling rather than its
 * reimplementation: the same three tones, the same `text.default` on `{tone}.subtle`, the same
 * `radius.card` and `spacing.card.*` geometry. Four decisions are genuinely new, and every one of
 * them exists because the box is not in the document flow.
 *
 * 1. TEXT COLOUR IS FIXED ACROSS EVERY TONE, and this is inherited rather than re-derived. The
 *    conventional look — `{tone}.default` text on `{tone}.subtle` — was measured against the light
 *    theme's real OKLCH values when `Alert` shipped and FAILS the 4.5:1 AA floor in every tone
 *    (danger 3.90, success 2.93, warning 1.93). The tone is therefore a non-text accent only.
 *    Do not "fix" this to per-tone text; that reintroduces a measured accessibility failure.
 *
 * 2. `zIndex: 60`, ONE STEP ABOVE `Dialog`'s 50, and the step is the point. A toast is very often
 *    the ANSWER to something the user did in a dialog — "Changes saved" after a form submits —
 *    and a toast rendered under the modal that triggered it is a toast nobody reads. Both numbers
 *    are raw rather than tokens because no `zIndex` category is bridged in `panda.config.ts`, and
 *    inventing one for two values in the whole package would ripple through `@zevaui/tokens` for
 *    nothing. `Dialog` set that precedent; this follows it.
 *
 * 3. THE REGION IS FIXED, THE LIST IS THE COLUMN. react-aria-components renders two boxes here —
 *    a wrapper div it portals to the body, and an `<ol>` inside it — and each needs a class of its
 *    own, because a part rendered without one gets RAC's `react-aria-*` default stamped on it and
 *    that would ship as public API a consumer could target. Positioning lives on the region;
 *    stacking and rhythm live on the list. The `<li>` between them carries `display: contents`
 *    from RAC itself, so it is layout-transparent and needs no slot.
 *
 * 4. NO ENTRANCE ANIMATION, and its absence is a decision rather than an omission. A toast that
 *    slid or faded in would make every visual baseline a race against its own transition, and the
 *    Playwright context pins `reducedMotion: "reduce"` precisely so captures are deterministic.
 *    The state change is already announced through `role="alert"`; motion would add nothing a
 *    screen-reader user receives and would cost the visual gate its determinism.
 */
export const toastRecipe = {
  className: "zui-toast",
  slots: ["region", "list", "toast", "content", "title", "description", "close"],
  base: {
    region: {
      position: "fixed",
      // Bottom-end rather than top-end: the top of a viewport is where a page's own banners and
      // skip links live, and a toast that covers one takes away a control instead of adding a
      // message. Logical properties, so a right-to-left document moves the stack to the left.
      insetBlockEnd: "card.py",
      insetInlineEnd: "card.px",
      zIndex: 60,
    },
    list: {
      display: "flex",
      // `column-reverse` IS CALIBRATED AGAINST UPSTREAM'S DOM ORDER, which is newest-FIRST:
      // `ToastQueue.add` does `this.queue.unshift(toast)`, measured in react-stately's source
      // rather than assumed. Reversing the paint direction therefore sends the newest toast to the
      // END of the visual column — nearest the corner this region is anchored to — and pushes
      // older ones upward, which is where a reader's eye already is.
      //
      // The DOM order is left alone on purpose: it is what a screen-reader user navigates, and
      // meeting the most recent message first is right there too. Change either one without the
      // other and the newest toast quietly moves to the far end of the stack; `toast.test.ts`
      // pins both halves together.
      flexDirection: "column-reverse",
      gap: "card.py",
      // The list is an `<ol>`, so the user-agent's list styling has to be undone explicitly: a
      // marker and a padding inline-start would both be visible on a floating surface.
      listStyle: "none",
      margin: "0",
      padding: "0",
    },
    toast: {
      display: "flex",
      alignItems: "flex-start",
      gap: "card.px",
      // Wide enough to read, capped so a long description cannot span a desktop viewport. `min`
      // rather than a media query: on a narrow screen the toast takes the viewport minus its own
      // inset on both sides, and on a wide one it stops at a comfortable measure.
      inlineSize: "min(24rem, calc(100vw - {spacing.card.px} * 2))",
      borderRadius: "card",
      paddingInline: "card.px",
      paddingBlock: "card.py",
      borderInlineStartWidth: "4px",
      borderInlineStartStyle: "solid",
      // The floating surface's own elevation. `shadow.modal`, the deepest of the three bridged
      // shadows, because this box sits above every other layer the package renders — including
      // the modal that shadow is named for.
      boxShadow: "modal",
      color: "text.default",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      // RAC puts `tabIndex={0}` on the toast so the F6 landmark hotkey can land on it. A focus
      // ring is therefore not optional decoration: it is the only thing that tells a keyboard user
      // where they arrived.
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
    },
    content: {
      display: "flex",
      flexDirection: "column",
      // Takes the row's slack so the close button is pushed to the far edge rather than floating
      // beside the text.
      flexGrow: 1,
      // Without this a long unbroken word in a description would widen the flex item past the
      // toast's own `inlineSize`.
      minInlineSize: 0,
    },
    title: {
      fontWeight: "heading",
    },
    description: {
      // The description is rendered even when empty — RAC points `aria-describedby` at it
      // unconditionally, so omitting it would leave that attribute referencing an id nothing
      // owns. Measured: the axe gate does NOT catch that (see `ToastRegion.tsx`), so this rule is
      // what makes the always-rendered element free. `:empty` collapses the placeholder, and the
      // two cases are pixel-identical.
      "&:empty": {
        display: "none",
      },
    },
    close: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      // Never shrinks: the description is the flexible part of this row, not the dismiss control.
      flexShrink: 0,
      background: "none",
      borderWidth: "0",
      borderRadius: "button",
      padding: "0",
      color: "text.default",
      cursor: "pointer",
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
    },
  },
  variants: {
    /**
     * Styles the `toast` slot alone, so Panda emits `--tone_*` rules for that slot only and
     * `slotRecipeClassNames` must not stamp the axis onto the other six.
     *
     * REQUIRED, WITH NO DEFAULT, exactly as `Alert` argues: a toast without a stated tone is a
     * caller bug, and defaulting would silently pick a semantic meaning ("this message is a
     * warning") the caller never stated. `toast.types.ts` mirrors this by making `tone` required.
     *
     * NO `info` TONE. Verified against @zevaui/tokens: no `color-info-*` token exists in any of
     * the three themes, so an `info` tone would have nothing to bridge.
     */
    tone: {
      danger: {
        toast: {
          backgroundColor: "danger.subtle",
          borderInlineStartColor: "danger.default",
        },
      },
      success: {
        toast: {
          backgroundColor: "success.subtle",
          borderInlineStartColor: "success.default",
        },
      },
      warning: {
        toast: {
          backgroundColor: "warning.subtle",
          borderInlineStartColor: "warning.default",
        },
      },
    },
  },
} satisfies SlotRecipeConfig;
