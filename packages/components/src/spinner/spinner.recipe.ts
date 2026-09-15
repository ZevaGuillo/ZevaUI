import type { CssKeyframes, SlotRecipeConfig } from "@pandacss/dev";
import { progressSurfaceLabel, progressSurfaceRoot } from "../internal/progress-surface.js";

export const SPINNER_RECIPE_KEY = "spinner";

/** The name of the keyframes the ring rotates through. */
const SPINNER_ROTATE_KEYFRAMES = "zui-spinner-rotate";

/**
 * The package's SECOND `@keyframes`, declared beside the recipe that runs it and carried into
 * `panda.config.ts` through the registry's optional `keyframes` field — never hand-registered in
 * the config.
 *
 * Being the second one is worth a warning. `panda.config.ts` merges every entry's keyframes with
 * `Object.assign`, so two components declaring the SAME animation name would silently overwrite
 * one another and the loser would animate through the winner's frames. Nothing in Panda reports
 * that a collision happened. `spinner.test.ts` asserts the registry's keyframe names are unique,
 * which is the check that did not exist while only one component declared any.
 */
export const spinnerKeyframes = {
  [SPINNER_ROTATE_KEYFRAMES]: {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
  },
} satisfies CssKeyframes;

// A busy indicator: the same react-aria-components `ProgressBar` primitive `Progress` is built on,
// held permanently in its indeterminate state. Four decisions, and two of them deliberately land
// on the OPPOSITE answer from progress.recipe.ts — which is the whole reason these are two
// components rather than one recipe with an `appearance` axis.
//
// 1. THE RING IS ONE ELEMENT, NOT A TRACK PLUS A FILL. A circle whose four borders are drawn in
//    the track colour, with one edge repainted in the accent, IS the arc — no second box, no
//    clipping, no gradient. It reuses exactly the pair of tokens Progress uses (`bg.muted` for
//    what is not yet done, `accent.default` for what is happening), so the two read as the same
//    family without sharing a rule.
//
// 2. IT ROTATES WITH `transform`, AND THE RTL ARGUMENT PROGRESS MAKES DOES NOT TRANSFER.
//    progress.recipe.ts deliberately animates `inset-inline-start` rather than `translateX`,
//    because a sweep has a LEADING EDGE and a physical translation would run it backwards in a
//    right-to-left document. A rotation has no leading edge: it visits all four sides of the box
//    every cycle, so there is no direction for a writing mode to disagree with. That removes the
//    only reason to refuse the compositor-friendly spelling, and `transform` rotates without
//    laying out a box per frame — which matters more here, because unlike Progress's sweep this
//    animation runs for as long as the component is mounted.
//
//    The accent edge is `border-top-color`, physical, for the same reason: the edge it names is
//    arbitrary on something that rotates through all of them, and under reduced motion (below) a
//    frozen arc at the top is the same glyph in every writing mode.
//
// 3. NO TOKEN IS BRIDGED FOR THE CIRCLE. `radius.full` (9999px) exists in
//    `tokens/primitives/radius.json` and is deliberately NOT bridged in `panda.config.ts`, which
//    bridges only `button`, `card` and `input`. `border-radius: 50%` is used instead, and that is
//    the more honest declaration rather than a shortcut: `50%` is EXACTLY a circle on a square
//    box at any size, while a themeable radius token would advertise that a theme may make the
//    spinner less round — which it may not. A spinner's roundness is geometry, not a design
//    decision. Progress reached the same "no new token" conclusion by a different route.
//
// 4. UNDER `prefers-reduced-motion: reduce` THE ROTATION IS CANCELLED, and the ring parks with its
//    accent arc at the top. This is not optional in this repo, and a spinner is pure motion, so it
//    is the decision that needed the most argument:
//      * Motion is never the ONLY signal. The root is a `role="progressbar"` with no
//        `aria-valuenow`, which assistive tech announces as busy with no measurable extent, and
//        the required `label` names what is busy. Freezing the ring costs a sighted user the
//        animation and costs nobody the state.
//      * The frozen shape still reads. A ring with one arc in the accent colour is the loading
//        glyph itself — it is what the animation is animating — so a reduced-motion user sees a
//        recognisable indicator rather than an empty box. Compare Progress, which had to argue the
//        opposite way round: a parked sliver must stay PARTIAL because a full accent track would
//        claim the operation had finished. A ring cannot make that claim at all.
//      * It is also what makes the visual baselines deterministic: the Playwright context pins
//        `reducedMotion: "reduce"` for every capture, so a spinner that kept spinning would make
//        every screenshot of it a coin flip.
export const spinnerRecipe = {
  className: "zui-spinner",
  slots: ["root", "indicator", "label"],
  base: {
    root: {
      // `inline-flex`, not `flex`: a spinner is dropped INTO a line of content — beside a button's
      // text, inside a table cell, next to a sentence — so it must take the width of its ring plus
      // its label and no more. Progress does the opposite and fills its column, which is the
      // clearest single difference between a bar and a busy indicator.
      display: "inline-flex",
      // Centred, not baseline-aligned: the ring is a geometric shape with no baseline of its own,
      // so aligning it to one would hang it off the label's descender line.
      alignItems: "center",
      // The rhythm and the typography every ProgressBar-based root owns — see
      // internal/progress-surface.ts, extracted when this component made that pair real.
      ...progressSurfaceRoot,
    },
    indicator: {
      // Never shrinks. A circle squeezed by a long label beside it is an ellipse, and an ellipse
      // is a rendering bug the moment it rotates.
      flex: "none",
      // The border is drawn INSIDE the declared size, so the `size` axis below sets the ring's
      // outer diameter rather than its diameter plus two border widths.
      boxSizing: "border-box",
      borderRadius: "50%",
      borderStyle: "solid",
      borderColor: "bg.muted",
      borderTopColor: "accent.default",
      animationName: SPINNER_ROTATE_KEYFRAMES,
      // Fast enough to read as active, slow enough not to strobe. One turn well under a second is
      // the range every platform's busy indicator lives in.
      animationDuration: "0.8s",
      // Linear, not eased: an eased rotation accelerates and decelerates once per turn, which a
      // viewer reads as the operation stalling and restarting eight times a second.
      animationTimingFunction: "linear",
      animationIterationCount: "infinite",
      "@media (prefers-reduced-motion: reduce)": {
        animationName: "none",
      },
    },
    label: progressSurfaceLabel,
  },
  variants: {
    // Styles the `indicator` slot only, so Panda emits `--size_*` rules for that slot alone and
    // `slotRecipeClassNames` must not stamp the axis onto `root` or `label`.
    //
    // Derived from the body size rather than from fixed pixels, the same argument Progress's track
    // heights make: a spinner sits next to type, so it has to scale when a theme changes its type
    // scale. At the shipped 0.875rem body that is a 14 / 17.5 / 24.5px ring on a 1.75 / 2.1 / 2.8px
    // stroke — the stroke grows more slowly than the diameter on purpose, because a ring whose
    // stroke scaled linearly reads as heavier at `lg` than at `sm` rather than simply larger.
    size: {
      sm: {
        indicator: {
          blockSize: "calc({fontSizes.body} * 1)",
          inlineSize: "calc({fontSizes.body} * 1)",
          borderWidth: "calc({fontSizes.body} * 0.125)",
        },
      },
      md: {
        indicator: {
          blockSize: "calc({fontSizes.body} * 1.25)",
          inlineSize: "calc({fontSizes.body} * 1.25)",
          borderWidth: "calc({fontSizes.body} * 0.15)",
        },
      },
      lg: {
        indicator: {
          blockSize: "calc({fontSizes.body} * 1.75)",
          inlineSize: "calc({fontSizes.body} * 1.75)",
          borderWidth: "calc({fontSizes.body} * 0.2)",
        },
      },
    },
    // THE AXIS THAT EXISTS BECAUSE `className` IS `never`.
    //
    // A spinner's accessible name is required — an unnamed busy indicator fails the blocking
    // accessibility gate — but the overwhelmingly common spinner shows no text at all: it sits in
    // a button, in a cell, in the corner of a card. Every other component in this package answers
    // "I want the name without the text" by telling the consumer to wrap it in their own
    // visually-hidden element. That answer is fine for a field, whose label is normally visible
    // anyway. It is the wrong default for a spinner, and with no `className` escape hatch it would
    // make the common case the one that needs consumer CSS. So the hiding is a real typed prop,
    // which is the rule this package works under.
    //
    // `visible` declares nothing on purpose: the base IS the visible state, and a variant value
    // with no declarations emits no rule and therefore no class — which `slotRecipeClassNames`
    // already handles and `slot-recipe-class.test.ts` already pins. Adding an inert declaration
    // just to make the two branches look symmetrical would ship a rule that changes nothing.
    labelVisibility: {
      visible: {},
      hidden: {
        label: {
          // The clip-rect pattern, not `display: none` and not `visibility: hidden`: both of those
          // remove the element from the accessibility tree, and this element is the one
          // `aria-labelledby` points at — hiding it that way would leave the spinner unnamed,
          // which is the exact failure the required `label` prop exists to prevent.
          //
          // Both `clip` and `clip-path` are declared. `clip` is deprecated and `clip-path` is the
          // replacement, but the two are supported by different vintages of browser and neither
          // alone covers the range a design system ships into.
          position: "absolute",
          inlineSize: "1px",
          blockSize: "1px",
          padding: "0",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          // Without this a long name wraps inside its 1px box and grows the page's scroll height.
          whiteSpace: "nowrap",
          borderWidth: "0",
        },
      },
    },
  },
  defaultVariants: {
    size: "md",
    // The bare ring is the spinner people mean. See the axis comment above.
    labelVisibility: "hidden",
  },
} satisfies SlotRecipeConfig;
