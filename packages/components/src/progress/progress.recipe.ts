import type { CssKeyframes, SlotRecipeConfig } from "@pandacss/dev";

export const PROGRESS_RECIPE_KEY = "progress";

/** The name of the keyframes the indeterminate sweep runs. */
const PROGRESS_INDETERMINATE_KEYFRAMES = "zui-progress-indeterminate";

/**
 * The package's FIRST `@keyframes`, declared beside the recipe that runs it and carried into
 * `panda.config.ts` through the registry's optional `keyframes` field — never hand-registered in
 * the config, which would break registry.ts's own doctrine that adding a component is one entry
 * plus one directory.
 *
 * The sweep runs `-40%` -> `100%` on `inset-inline-start`, which walks a 40%-wide sliver from
 * fully off the leading edge to fully off the trailing one. The percentages resolve against the
 * track, which is why the track is the positioned containing block.
 */
export const progressKeyframes = {
  [PROGRESS_INDETERMINATE_KEYFRAMES]: {
    from: { insetInlineStart: "-40%" },
    to: { insetInlineStart: "100%" },
  },
} satisfies CssKeyframes;

// The first component in this package whose appearance is driven by a RUNTIME NUMBER, and the
// first with a looping animation. Four decisions follow from those two firsts.
//
// 1. THE FILL WIDTH IS NOT IN THIS FILE, AND CANNOT BE. A percentage that changes on every render
//    has no class to hang off, so `Progress.tsx` sets `inline-size` inline — the only inline style
//    in the package. Everything else about the fill is declared here, and the test asserts that
//    inline style carries exactly one declaration, so "just add it to the style object" stays a
//    failing change rather than a habit.
//
// 2. NO NEW TOKEN FOR THE TRACK'S CORNER. `radii.input` is reused instead of bridging
//    `radius.full`, and the reason is measured rather than aesthetic: body size is
//    `font.body.size` = `fontSize.sm` = 0.875rem = 14px, so the three declared track heights are
//    3.5px, 5.25px and 7px, and `radius.input` = `radius.md` = 4px is at least half of every one
//    of them. A corner radius at or above half the height IS a pill, so the pill shape falls out
//    of a token this package already bridges. A theme that RAISES `radius.input` only rounds it
//    further, and `overflow: hidden` on the track keeps the fill inside that shape either way.
//
// 3. THE TRACK AND FILL CARRY THEIR OWN `data-indeterminate`, for the reason checkbox.recipe.ts
//    argues at length: react-aria-components puts the state on the ROOT (as the absence of
//    `aria-valuenow` — its documented selector is `:not([aria-valuenow])`), and repainting a
//    descendant from an ancestor's state needs a bare `[data-indeterminate] .zui-progress__fill`,
//    which matches ANY ancestor carrying that attribute. So `Progress.tsx` stamps the flag onto
//    the two parts that react to it and every rule below is a LOCAL `&[data-indeterminate]`.
//
// 4. THE INDETERMINATE SWEEP ANIMATES `inset-inline-start`, NOT `transform`. `translateX` is the
//    compositor-friendly spelling and it is also PHYSICAL: in a right-to-left document the sweep
//    would run backwards, against the direction the surrounding text reads. `inset-inline-start`
//    is logical, so it follows the writing mode, and the cost is laying out one 40%-wide box per
//    frame — which is not a cost worth buying a direction bug with. Under
//    `prefers-reduced-motion: reduce` the animation is cancelled and the sliver parks at the
//    start: deliberately NOT a full track, because a full accent bar would claim the operation
//    had finished. That branch is also what makes the visual baselines deterministic — the
//    Playwright context pins `reducedMotion: "reduce"` for every capture.
export const progressRecipe = {
  className: "zui-progress",
  slots: ["root", "header", "label", "valueText", "track", "fill"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      // Derived from the body size rather than a `space.*` value, the same argument Checkbox
      // makes for its own gap: the distance between a label and the bar it describes is a
      // typographic measure, so it has to move when a theme changes its type scale.
      gap: "calc({fontSizes.body} * 0.375)",
      inlineSize: "100%",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
    },
    header: {
      display: "flex",
      // Baseline, not center: the label and the value text are two runs of type on one line, and
      // aligning their boxes instead of their baselines would make them look off by a hair
      // whenever the two ever differ in size.
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: "calc({fontSizes.body} * 0.5)",
    },
    label: {
      // No colour or family of its own: it inherits the root's, which is the single place this
      // component's typography is declared.
      minWidth: "0",
    },
    valueText: {
      flex: "none",
      color: "text.secondary",
      // The value is a number that changes every frame of an upload. Proportional digits differ
      // in width, so "8%" -> "88%" would shove the label sideways; tabular figures keep the run
      // a fixed width and the row still.
      fontVariantNumeric: "tabular-nums",
    },
    track: {
      // The containing block the indeterminate sweep is positioned against.
      position: "relative",
      inlineSize: "100%",
      // Clips the fill to the track's corners, so the fill needs no corner of its own at the
      // leading edge and cannot spill past the trailing one.
      overflow: "hidden",
      backgroundColor: "bg.muted",
      borderRadius: "input",
    },
    fill: {
      blockSize: "100%",
      backgroundColor: "accent.default",
      borderRadius: "input",
      // Only the width animates, and only BETWEEN DETERMINATE VALUES — the indeterminate branch
      // below cancels it. That second half is not tidiness: entering the indeterminate state also
      // changes `inline-size` (whatever the value was, to the 40% sliver), so leaving the
      // transition on would slide the bar to a new width for 150ms before the sweep starts, which
      // reads as one last progress update that never happened.
      transitionProperty: "inline-size",
      transitionDuration: "150ms",
      transitionTimingFunction: "ease-out",
      "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
      "&[data-indeterminate]": {
        transitionProperty: "none",
        position: "absolute",
        insetBlock: "0",
        insetInlineStart: "0",
        // A sliver rather than the whole track: the sweep has to be visibly PARTIAL, or a viewer
        // reads a full accent bar as "finished".
        inlineSize: "40%",
        animationName: PROGRESS_INDETERMINATE_KEYFRAMES,
        animationDuration: "1.4s",
        animationTimingFunction: "ease-in-out",
        animationIterationCount: "infinite",
        "@media (prefers-reduced-motion: reduce)": {
          animationName: "none",
        },
      },
    },
  },
  variants: {
    // Styles the `track` slot only. Panda therefore emits `--size_*` rules for that slot alone,
    // which is why `slotRecipeClassNames` filters per slot instead of stamping every axis onto
    // every slot — the other five slots must NOT pick up a size class.
    size: {
      sm: { track: { blockSize: "calc({fontSizes.body} * 0.25)" } },
      md: { track: { blockSize: "calc({fontSizes.body} * 0.375)" } },
      lg: { track: { blockSize: "calc({fontSizes.body} * 0.5)" } },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
