import type { CssKeyframes, RecipeConfig } from "@pandacss/dev";

export const SKELETON_RECIPE_KEY = "skeleton";

/** The name of the keyframes the resting pulse runs. */
const SKELETON_PULSE_KEYFRAMES = "zui-skeleton-pulse";

/**
 * The package's SECOND `@keyframes`, declared beside the recipe that runs it and carried into
 * `panda.config.ts` through the registry's optional `keyframes` field — never hand-registered in
 * the config, for the reason registry.ts states: adding a component is one entry plus one
 * directory.
 *
 * `from`/`to` plus `animation-direction: alternate` rather than a three-stop `0%/50%/100%` list.
 * The two spellings render the same pulse, and this one stays inside the exact keyframe shape
 * `progressKeyframes` already established, so nothing here depends on how Panda emits a
 * multi-selector keyframe stop.
 *
 * OPACITY, NOT `background-color`. A colour animation interpolates between two token values and
 * would need a second placeholder token in all three themes to have anything to interpolate
 * TOWARDS; fading the one box the component already paints needs no token at all, and opacity is
 * the property a compositor can animate without laying anything out. The floor is `0.55` rather
 * than something dimmer because the box fades towards whatever the consumer's page is behind it,
 * and a placeholder that nearly vanishes at the bottom of every cycle reads as a flicker rather
 * than as content on its way.
 */
export const skeletonKeyframes = {
  [SKELETON_PULSE_KEYFRAMES]: {
    from: { opacity: "1" },
    to: { opacity: "0.55" },
  },
} satisfies CssKeyframes;

/**
 * Skeleton is single-part (a flat recipe, like Badge, Alert and Button): one styled box standing
 * in for content that has not arrived, never a composed structure, so it needs no slots and lands
 * in `theme.recipes` (see `isSlotRecipe` in src/registry.ts).
 *
 * SIZING IS THE WHOLE PROBLEM, AND IT IS THE PACKAGE'S OWN DOING. `className` and `style` are
 * `never` on every public component here, so the escape hatch every other skeleton library leans
 * on — `<Skeleton className="h-4 w-1/2" />`, or MUI's `width`/`height` props taking arbitrary CSS
 * lengths — does not exist. Two typed axes replace it, and they are deliberately not a length
 * scale in disguise:
 *
 *   `shape` decides the BLOCK extent and the corner, because those two always move together: a
 *   line of type is short and takes the small corner, a panel is tall and takes the card corner.
 *   Splitting them into a `height` axis and a `radius` axis would let a caller build a 6em-tall
 *   box with a text corner, which is not a shape anything in this design system renders.
 *
 *   `width` decides the INLINE extent as a fraction of whatever box the consumer put the skeleton
 *   in. Fractions rather than lengths because the consumer owns the container and the design
 *   system does not: a skeleton that stood in for a line of a paragraph at a fixed `12rem` would
 *   be wrong in every column that is not 12rem wide, while `half` is right in all of them. The
 *   four values exist to make a ragged paragraph — the single most common use — expressible
 *   without a per-line prop: three `full` lines and a `wide` or `half` last one.
 *
 * THE `block` SHAPE FILLS THE CONSUMER'S BOX INSTEAD OF NAMING A HEIGHT. `block-size: 100%` with
 * a `min-block-size` floor is the honest answer to "how tall is an image placeholder": the
 * consumer already owns the element that reserves the space, so the skeleton fills it, and the
 * floor only decides what happens in the case where nothing reserved any — an auto-height parent,
 * where a percentage height computes to `auto`.
 *
 * NO `circle` SHAPE, AND THAT ABSENCE IS DELIBERATE. An avatar placeholder is the obvious fourth
 * value and it is missing for two reasons, one mechanical and one about honesty. Mechanically, a
 * circle is `aspect-ratio: 1` with an auto inline size, which is precisely the one thing the
 * `width` axis exists to set — the two axes would contradict each other on the same property and
 * the winner would be decided by the order Panda happens to emit them in. And there is no
 * `Avatar` in this package yet (it is tanda 4), so a diameter scale would have to be invented
 * here and then MATCHED there; if the two ever drifted, the skeleton would reserve the wrong
 * space and the page would jump at the exact moment the real avatar arrived. `circle` ships when
 * the thing it stands in for ships.
 *
 * NO NEW TOKENS. `bg.muted` is the placeholder's fill and it is already bridged in
 * panda.config.ts (Progress paints its track with it), `radii.input` and `radii.card` are the two
 * corners this package already has, and every derived dimension is a multiple of the body type
 * metrics — the precedent `checkbox.recipe.ts` set and `progress.recipe.ts` reused. The plan's
 * prediction that a `radius.skeleton` token would be needed was checked against
 * `themes/light.json` and is false, the same way the equivalent prediction for the markable
 * controls turned out false.
 *
 * WHY A BOX WITH NO TEXT DECLARES TYPOGRAPHY. `font-size` is load-bearing: the `1em` in the two
 * line-shaped heights below resolves against it, so a theme that changes its type scale moves the
 * placeholder with the text it replaces. `font-family` and `color` are not — this component
 * renders no glyphs — and they are declared anyway because G11 in `__tests__/css-gates.test.ts`
 * is a package-wide law, not a rule with exemptions. The defect G11 exists for was a component
 * that silently deferred the whole question of its text to the consumer's page; a component that
 * establishes a font size but not a family or a colour is one `children` prop away from being
 * that same component, and the honest way to hold the line is to declare all of it rather than to
 * argue this one case out of the gate.
 */
export const skeletonRecipe = {
  className: "zui-skeleton",
  base: {
    // `display: block` on an element that is phrasing content by default (Skeleton.tsx renders a
    // `<span>`, see the argument there) — so it lays out as a block wherever it is put, without
    // being invalid markup inside a `<p>`.
    display: "block",
    backgroundColor: "bg.muted",
    fontFamily: "body",
    fontSize: "body",
    fontWeight: "body",
    lineHeight: "body",
    color: "text.default",
    animationName: SKELETON_PULSE_KEYFRAMES,
    animationDuration: "1.6s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    // `alternate`, so the box eases back up instead of snapping from the dim frame to the bright
    // one at the loop boundary.
    animationDirection: "alternate",
    // MANDATORY IN THIS REPO, AND WRITTEN HERE RATHER THAN BOLTED ON. Under a reduced-motion
    // preference the pulse is cancelled outright and the box parks at the BRIGHT end — the base
    // `opacity` is untouched, so it rests at 1 rather than at the 0.55 floor. Parking at the dim
    // frame would leave a permanently faded box that reads as disabled content rather than as
    // content still arriving, which is the reduced-motion equivalent of Progress's "a full accent
    // bar claims the operation finished".
    //
    // This branch is also what makes the visual baselines deterministic: the Playwright context
    // pins `reducedMotion: "reduce"` for every capture, so a skeleton with a live animation would
    // be screenshotted at an arbitrary frame.
    "@media (prefers-reduced-motion: reduce)": {
      animationName: "none",
    },
  },
  variants: {
    shape: {
      // One line of body copy: the type size times the line height, which is exactly the box a
      // line of text occupies. `1em` rather than `{fontSizes.body}` on purpose — the base sets
      // `font-size` to that token, so the two resolve identically, and the `em` spelling is what
      // makes that declaration load-bearing instead of decorative.
      text: {
        blockSize: "calc(1em * {lineHeights.body})",
        borderRadius: "input",
      },
      // A heading line. 1.5x body is a derived multiple, the same kind Badge and Progress derive
      // their own geometry from, and it has to be derived: `font.heading` exists in all three
      // themes as a family and a weight but carries NO size token, so there is nothing to alias.
      heading: {
        blockSize: "calc(1.5em * {lineHeights.body})",
        borderRadius: "input",
      },
      // A panel: an image, a chart, a card's worth of content. Fills the box the consumer
      // reserved; the floor applies only when the parent reserved no height at all, since a
      // percentage block size against an auto-height parent computes to `auto`.
      block: {
        blockSize: "100%",
        minBlockSize: "calc(6em * {lineHeights.body})",
        borderRadius: "card",
      },
    },
    width: {
      full: { inlineSize: "100%" },
      wide: { inlineSize: "75%" },
      half: { inlineSize: "50%" },
      narrow: { inlineSize: "25%" },
    },
  },
  defaultVariants: {
    // A single full-width line: the shape a skeleton takes when the caller has not said what it
    // stands in for. Unlike Alert's tone — where a default would invent a claim the caller never
    // made — a shape states nothing about meaning, so defaulting to the most common one is the
    // same kind of default Button's `visual: "solid"` is.
    shape: "text",
    width: "full",
  },
} satisfies RecipeConfig;
