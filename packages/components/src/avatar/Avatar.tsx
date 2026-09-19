import { cssUrl } from "../internal/css-url.js";
import { slotRecipeClassNames } from "../internal/slot-recipe-class.js";
import { avatarRecipe } from "./avatar.recipe.js";
import type { AvatarProps } from "./avatar.types.js";

/**
 * The sixth server-renderable component, after Card, Alert, Badge, Skeleton and Separator — and
 * the one where that property was hardest to keep, because the obvious implementation throws it
 * away.
 *
 * Every other design system handles a broken avatar with state: an `onError` handler that swaps
 * the image for initials. That makes the component stateful and therefore client-only, and an
 * avatar appears in server-rendered lists of people more than almost anything else here, so the
 * cost is a `"use client"` boundary per row. `avatar.recipe.ts` holds the layered alternative and
 * the measurement behind it.
 *
 * THE NAME IS ON THE ROOT AND NOWHERE ELSE. `role="img"` with `aria-label` makes the whole circle
 * one graphic called "Ana Beltrán", which is what it is. Both the initials and the photograph are
 * hidden from assistive tech, because they are two renderings of the same name and announcing
 * either would say it twice or, worse, say "AB".
 */
export function Avatar({ name, src, size, shape }: AvatarProps) {
  const slots = slotRecipeClassNames(avatarRecipe, { size, shape });

  return (
    <span role="img" aria-label={name} className={slots.root}>
      {/*
        Always rendered, even when there is a src: it is what the photograph is layered OVER, so a
        source that fails to load reveals it with no state change and no flash. Conditionally
        rendering it would put the fallback back behind an `onError` handler, which is the whole
        thing this shape avoids.
      */}
      <span aria-hidden="true" className={slots.initials}>
        {initialsOf(name)}
      </span>
      {src === undefined ? null : (
        // A `<span>` with a background, never an `<img>`. The `<img>` version was built first and
        // refuted by its own baseline: Chromium draws a broken-image glyph over the monogram, which
        // `alt=""` does not suppress. A background that fails to load paints nothing, and that is
        // structural rather than an engine behaviour — there is no replaced element for a user
        // agent to draw a placeholder for. See avatar.recipe.ts.
        //
        // The URL is the only thing in this package's rendered output that comes from a caller and
        // lands in CSS, so it goes through `cssUrl` rather than into a template string.
        <span aria-hidden="true" className={slots.image} style={{ backgroundImage: cssUrl(src) }} />
      )}
    </span>
  );
}

/**
 * Up to two letters: the first of the first word and the first of the last.
 *
 * ITERATED BY CODE POINT (`[...word]`), NEVER BY `charAt`. A name beginning with a character
 * outside the Basic Multilingual Plane — which includes every emoji and a great deal of CJK
 * extension — is TWO UTF-16 units, so `name[0]` hands back half a surrogate pair and the browser
 * draws a replacement glyph. Spreading a string iterates code points, which is one unit of the
 * thing a reader would call "the first letter" for almost every script.
 *
 * Almost, and the exception is named rather than hidden: a grapheme CLUSTER — a base letter plus
 * a combining mark, or a flag, or a family emoji — is several code points, so this takes only the
 * first of them. `Intl.Segmenter` is the correct tool and it is deliberately not used: it would
 * put an ICU-dependent result into server-rendered markup, and an engine whose segmenter data
 * differs from the browser's would produce a hydration mismatch on a component that appears
 * dozens of times per page. A slightly wrong monogram is a far cheaper failure than that.
 *
 * `toUpperCase()`, NOT `toLocaleUpperCase()`, AND THAT IS FORCED RATHER THAN PREFERRED. The
 * locale-aware form reads the HOST's locale, which differs between the server that renders this
 * and the browser that hydrates it — Turkish `i` uppercases to `İ` in one and `I` in the other,
 * and React reports the difference as a hydration error. The locale-independent form is the only
 * one that can appear in server-rendered markup at all.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";

  const first = [...words[0]][0] ?? "";
  const last = words.length > 1 ? ([...words[words.length - 1]][0] ?? "") : "";

  return `${first}${last}`.toUpperCase();
}
