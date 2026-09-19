import type { SlotRecipeConfig } from "@pandacss/dev";
import { AVATAR_DIAMETER } from "../internal/avatar-diameter.js";

export const AVATAR_RECIPE_KEY = "avatar";

/**
 * One size's geometry, derived from its diameter rather than written out beside it.
 *
 * A FUNCTION RATHER THAN THREE LITERAL BLOCKS, and it earns that twice over. The three sizes
 * differ in exactly one value, so spelling them out meant three near-identical blocks — which
 * SonarCloud's duplication gate flagged on this PR at 3.1% against a 3% ceiling, and which is the
 * shape a `lg` avatar with `md` initials eventually comes out of.
 *
 * The font size is derived here rather than listed as a fourth token because two letters centred
 * in a circle want to be a fixed fraction of it at every size. Writing the diameter and the type
 * scale apart is precisely how they drift; written this way they cannot.
 *
 * Called three times with literal keys rather than mapped over `AVATAR_DIAMETER` with
 * `Object.fromEntries`, because that would widen the variant map to `Record<string, …>` and
 * `avatar.types.ts` derives `AvatarSize` from `keyof typeof avatarRecipe.variants.size`. The
 * literal keys are load-bearing.
 */
const geometryFor = (diameter: string) => ({
  root: {
    inlineSize: diameter,
    blockSize: diameter,
    fontSize: `calc(${diameter} * 0.4)`,
  },
});

/**
 * Avatar is multi-part, so it is a Panda SLOT recipe, routed to `theme.slotRecipes` off the
 * presence of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> element:
 *   root     -> <span role="img" aria-label>  the circle, and the only thing with a name
 *   initials -> <span aria-hidden>            the fallback, always rendered
 *   image    -> <span aria-hidden>            a BACKGROUND-IMAGE layer over the initials
 *
 * THE FALLBACK IS ALWAYS IN THE DOM, UNDERNEATH THE PHOTOGRAPH, AND THAT IS WHAT KEEPS THIS
 * COMPONENT SERVER-RENDERABLE. Every other design system solves the broken-avatar problem with
 * state: an `onError` handler that swaps the image for initials, which makes the component
 * stateful and therefore client-only. An avatar appears in server-rendered lists of people more
 * than almost anything else in this package, so paying a `"use client"` boundary per row is a real
 * cost.
 *
 * THE PHOTOGRAPH IS A `background-image` ON A `<span>`, NOT AN `<img>`, AND THAT IS A CORRECTION
 * RATHER THAN A PREFERENCE — the `<img>` version was built first, measured, and found broken.
 *
 * The original reasoning was that an `<img alt="">` whose source fails paints nothing, so the
 * initials underneath would show through. `Avatar.stories.tsx > BrokenImage` was written to hold
 * that claim, and the very first baseline it produced refuted it: Chromium draws its
 * broken-image indicator — a small torn-page glyph — in the top-left of the content box, directly
 * over the monogram. `alt=""` suppresses the alt TEXT, not the indicator.
 *
 * A `background-image` has no such failure rendering, and that is not an engine behaviour that
 * could change: there is no replaced element, so there is nothing for a user agent to draw a
 * placeholder FOR. A URL that does not resolve simply paints nothing and the layer stays
 * transparent. It is a stronger guarantee than the one the `<img>` version was claiming, not a
 * weaker substitute for it.
 *
 * WHAT IT COSTS, STATED PLAINLY: no `srcset`, no `sizes`, no `loading="lazy"` and no `decoding`
 * hint, because none of those exist for a background. For a box between 28 and 49 CSS pixels that
 * is an acceptable trade; for a hero image it would not be, which is why this reasoning lives here
 * and not in a shared helper somebody could reach for elsewhere.
 *
 * NO BORDER AND NO RING. The circle is separated from the page by its own fill, and a ring would
 * need a non-text contrast pair per surface it sits on — the same reasoning `badge.recipe.ts`
 * applied when it shipped without one. A "presence" dot or a status ring is a composition on top
 * of this, not an axis inside it.
 */
export const avatarRecipe = {
  className: "zui-avatar",
  slots: ["root", "initials", "image"],
  base: {
    root: {
      position: "relative",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      // An avatar in a flex row is an ordinary flex item, and a circle that shrinks is an ellipse.
      // Same declaration, same reason, as the one `separator.recipe.ts` leans on.
      flexShrink: 0,
      overflow: "hidden",
      boxSizing: "border-box",
      backgroundColor: "bg.muted",
      /**
       * `text.default` on `bg.muted`, and that pair sits in a MEASURED CONTRACT GAP rather than
       * an unnoticed one. `@zevaui/constraints` validates `color-text-default` against
       * `color-bg-canvas` and `color-bg-surface`, and `contract.test.ts` asserts BY NAME that no
       * text pair references `color-bg-subtle` or `color-bg-muted` — widening it would constrain
       * tokens ADR-0020 depends on being free.
       *
       * So this is covered the way `Menu`'s hovered row and `Badge`'s `neutral` tone already are:
       * by axe's `color-contrast` rule over real stories in a real Chromium, in all three themes.
       * That makes `Avatar.stories.tsx` load-bearing rather than illustrative — an avatar whose
       * initials are never rendered in a story is an avatar with no contrast evidence.
       *
       * `text.default` rather than the conventional `text.secondary`: the initials ARE the
       * fallback identity, not an annotation on it, and the muted fill is already low-contrast
       * enough without dimming the glyphs on top of it too.
       */
      color: "text.default",
      fontFamily: "body",
      // `heading` weight, because two letters at this size need the stroke to read as a monogram
      // rather than as body text that happens to be short.
      fontWeight: "heading",
      // `1` rather than the body line height: the box is a fixed circle, so leading would only
      // push the glyphs off centre.
      lineHeight: "1",
      // The initials are not text to be read or copied — they are a picture of a name. Selecting
      // them mid-drag through a list of people is noise.
      userSelect: "none",
    },
    initials: {
      // Deliberately empty of colour and family: both are inherited from `root`, which is where
      // G11 finds them, and duplicating them here would be two places to change one decision.
      // The slot exists so the fallback has a stable structural hook and so the image has
      // something to be layered OVER.
      textTransform: "uppercase",
    },
    image: {
      // Painted OVER the initials rather than beside them: a loaded photograph hides the monogram,
      // a URL that does not resolve leaves this layer transparent and the monogram shows through.
      // No state, no effect, no `onError`.
      position: "absolute",
      inset: "0",
      // Photographs are not square and avatars are. `cover` crops the overflow rather than
      // squashing a face, which `contain` or a default `auto` would do.
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      // The URL itself is the one thing NOT declared here — `Avatar.tsx` puts it in an inline
      // style, because it is a datum rather than a style. `Progress` set the same precedent with
      // its fill width.
    },
  },
  variants: {
    /**
     * THE DIAMETER IS NOT DECLARED HERE. It comes from `internal/avatar-diameter.ts`, which
     * `skeleton.recipe.ts` also reads for its `circle` shape — the two components must reserve
     * exactly the same space, or the page jumps at the moment the real avatar replaces its
     * placeholder. That hazard is named in skeleton.recipe.ts's own comment, and a shared
     * constant is what makes it impossible rather than merely unlikely.
     *
     * Each value is `geometryFor` applied to its own diameter — see that helper for why the three
     * are not written out, and why the font size is derived rather than listed.
     */
    size: {
      sm: geometryFor(AVATAR_DIAMETER.sm),
      md: geometryFor(AVATAR_DIAMETER.md),
      lg: geometryFor(AVATAR_DIAMETER.lg),
    },
    /**
     * `50%` IS A LITERAL, NOT A TOKEN, AND THAT IS THE ONE PLACE THIS PACKAGE'S RADIUS RULE BENDS.
     * `badge.recipe.ts` refused a hardcoded pill on the grounds that it would be the only geometry
     * here ignoring the theme's radius scale. The difference is that a badge's corner is a STYLE
     * choice a theme may legitimately want to restate, while an avatar's circularity is the
     * identity of the object — a theme that squared every avatar would not be theming this
     * component, it would be replacing it. `rounded` exists for the systems that genuinely want
     * squared-off avatars (organisations and teams, conventionally), and it takes `radius.card`,
     * which IS a theme token.
     */
    shape: {
      circle: { root: { borderRadius: "50%" } },
      rounded: { root: { borderRadius: "card" } },
    },
  },
  defaultVariants: {
    size: "md",
    shape: "circle",
  },
} satisfies SlotRecipeConfig;
