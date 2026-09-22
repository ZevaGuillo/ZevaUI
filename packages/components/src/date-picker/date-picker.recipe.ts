import type { SlotRecipeConfig } from "@pandacss/dev";
import {
  dateSegment,
  textFieldDescription,
  textFieldError,
  textFieldLabel,
  textFieldRoot,
  textSurfaceBase,
  textSurfacePadding,
} from "../internal/text-surface.js";

export const DATE_PICKER_RECIPE_KEY = "datePicker";

// THE FIRST COMPONENT HERE THAT IS A FIELD AND AN OVERLAY AND A COLLECTION AT ONCE. `Select` was a
// field and an overlay; this adds the two-dimensional grid `Calendar` brought, and it is the first
// entry assembled almost entirely out of parts that already existed:
//
//   root/label/description/error -> internal/text-surface.ts  (the shared field chrome)
//   segment                      -> internal/text-surface.ts  (shared with DateField, by identity)
//   group                        -> internal/text-surface.ts  (textSurfaceBase, see below)
//   the month grid               -> this package's own `Calendar`, rendered by DatePicker.tsx
//
// What is left for this recipe to own is genuinely only what is new: the boxed ROW that holds the
// segments beside a trigger, that trigger, its glyph, and the raised surface the calendar sits on.
//
// WHY `textSurfaceBase` LANDS ON A `Group`, measured rather than assumed. The box here is a RAC
// `Group`, not a `DateInput`, so the attribute contract had to be re-checked the way
// date-field.recipe.ts checked `DateInput` against `Input`. Read from
// react-aria-components 1.20's `dist/types/src/Group.d.ts`:
//
//   Input     -> data-hovered, data-focused,      data-focus-visible, data-disabled, data-invalid
//   DateInput -> data-hovered, data-focus-within, data-focus-visible, data-disabled, data-invalid
//   Group     -> data-hovered, data-focus-within, data-focus-visible, data-disabled, data-invalid
//
// `Group` and `DateInput` agree exactly, and `textSurfaceBase` keys on four of those five
// (hovered, focus-visible, invalid, disabled), so every rule it exports lands correctly here. That
// is why the box is shared rather than re-derived — and re-deriving it is how `Textarea` inherited
// a bug from `Input`.
//
// THE SEGMENTS ARE IN A `Group`, NOT IN THE `DateInput`, and that is not cosmetic. The trigger has
// to live INSIDE the control's boundary — a button floating outside the box would read as a
// separate control that happens to sit nearby — and a `DateInput` may only contain segments. The
// `Group` is what react-aria gives a composite control for exactly this shape, and it is what
// carries the field's accessible name, its border and its focus ring.
export const datePickerRecipe = {
  className: "zui-date-picker",
  slots: [
    "root",
    "label",
    "group",
    "input",
    "segment",
    "trigger",
    "triggerIcon",
    "description",
    "error",
    "popover",
    "dialog",
  ],
  base: {
    root: textFieldRoot,
    label: textFieldLabel,
    group: {
      display: "flex",
      alignItems: "center",
      // The segments take the room and the trigger sits at the end, the same arrangement
      // select.recipe.ts gives its chevron and for the same reason: the affordance must not be
      // pushed out of the box by its own content.
      justifyContent: "space-between",
      gap: "calc({fontSizes.body} * 0.5)",
      // `fit-content` rather than `100%`, exactly as DateField's box is: a date is always the same
      // number of characters, and a field stretched across a form column would leave the segments
      // stranded at its left edge.
      width: "fit-content",
      ...textSurfaceBase,
    },
    input: {
      // Inside the box the `DateInput` is only a row of segments: the border, the background and
      // the padding all belong to the `group` around it, so this slot declares the content model
      // and nothing else.
      display: "flex",
      whiteSpace: "nowrap",
    },
    segment: dateSegment,
    trigger: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "none",
      boxSizing: "border-box",
      // Square and sized off the body scale, the same construction calendar.recipe.ts uses for its
      // paging arrows, so the control stays proportional at every theme's type size and clears the
      // 24px pointer-target floor at the default scale.
      inlineSize: "calc({fontSizes.body} * 1.5)",
      blockSize: "calc({fontSizes.body} * 1.5)",
      padding: "0",
      borderWidth: "0",
      borderRadius: "button",
      backgroundColor: "transparent",
      color: "text.default",
      cursor: "pointer",
      "&[data-hovered]:not([data-disabled])": {
        backgroundColor: "bg.muted",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      // No `opacity` here, unlike `textSurfaceBase`'s disabled rule: the box around this button
      // already dims the whole control, and dimming a child of something dimmed multiplies the two
      // and drops the glyph below the contrast floor.
      "&[data-disabled]": {
        cursor: "not-allowed",
      },
    },
    // A pure-CSS chevron — a square with two borders, rotated — the same construction
    // `select.recipe.ts` and `calendar.recipe.ts` document. No SVG asset and no font glyph, and it
    // inherits the trigger's colour through `currentcolor` so it can never drift from the control
    // around it.
    //
    // A CHEVRON RATHER THAN A CALENDAR GLYPH, and that is a decision rather than a shortcut. A
    // calendar icon would need an asset or an icon font, neither of which this package ships, and
    // drawing one in CSS takes four boxes to say what the chevron says in one: a panel opens below.
    // `Select`'s trigger makes the same promise with the same shape, so the two read as one family.
    triggerIcon: {
      boxSizing: "border-box",
      inlineSize: "0.4em",
      blockSize: "0.4em",
      borderRightWidth: "2px",
      borderBottomWidth: "2px",
      borderRightStyle: "solid",
      borderBottomStyle: "solid",
      borderColor: "currentcolor",
      // The rotation moves the glyph's visual centre off the box centre by half a diagonal;
      // nudging it back up is what keeps it optically centred inside the square.
      transform: "translateY(-0.1em) rotate(45deg)",
      transitionProperty: "transform",
      transitionDuration: "120ms",
      transitionTimingFunction: "ease-out",
      // Stamped by DatePicker.tsx off the root's render prop, the same way Select.tsx stamps its
      // chevron: `[data-open]` lands on the ROOT in RAC 1.20, not on the button.
      "&[data-open]": {
        transform: "translateY(0.1em) rotate(225deg)",
      },
      "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
    },
    description: textFieldDescription,
    error: textFieldError,
    popover: {
      boxSizing: "border-box",
      // NO BACKGROUND AND NO PADDING, unlike `popover.recipe.ts`'s surface, because the thing
      // inside it is this package's `Calendar` — and a calendar is already a surface in its own
      // right (`bg.surface`, `radius.card`, `card.px`; see calendar.recipe.ts). Painting a second
      // one here would double the padding and stack two grounds. All this slot adds is the DEPTH
      // that says the panel floats, and the radius so the shadow follows the calendar's corners.
      borderRadius: "card",
      // `shadow.dropdown`, not `shadow.modal`: the page behind this stays readable and clickable,
      // which is the distinction popover.recipe.ts draws between the two elevations.
      boxShadow: "dropdown",
      // ONLY `top` AND `bottom` ARE REACHABLE, which is why there are two rules here and not the
      // eight `popover.recipe.ts` carries. This component exposes no `placement` prop — see
      // date-picker.types.ts for why a calendar belonging to the field above it does not need one
      // — so react-aria anchors the panel below the field and flips it above only when there is no
      // room. Writing the `left`/`right` pair as well would have shipped two rules no state can
      // ever match, which is the reason this block is NOT extracted into a shared module: the
      // honest need here is a subset, not the same block a third time.
      transitionProperty: "transform",
      transitionDuration: "120ms",
      transitionTimingFunction: "ease-out",
      '&[data-placement="bottom"][data-entering]': { transform: "translateY(-0.25rem)" },
      '&[data-placement="bottom"][data-exiting]': { transform: "translateY(-0.25rem)" },
      '&[data-placement="top"][data-entering]': { transform: "translateY(0.25rem)" },
      '&[data-placement="top"][data-exiting]': { transform: "translateY(0.25rem)" },
      // No `opacity` anywhere and only `transform` animates — the rule every overlay here follows,
      // so no ancestor can dim the text inside one mid-transition.
      "@media (prefers-reduced-motion: reduce)": { transitionProperty: "none" },
    },
    dialog: {
      display: "flex",
      // react-aria moves focus into the dialog when it opens, and a ring drawn on this container
      // would frame the whole panel for something the user never targeted. The calendar inside
      // draws its own.
      outline: "none",
    },
  },
  variants: {
    // Styles the `group` slot only — the BOX — exactly as DateField's axis styles its `input`, so
    // a picker and a field stand at the same height in one form column. Panda emits `--size_*`
    // rules for that slot alone, which is why `slotRecipeClassNames` filters per slot.
    //
    // The trigger deliberately takes no step: it is a square derived from the type scale, so it
    // already grows with the text, and a second scale on top of that one would make the glyph
    // outgrow the box it sits in.
    size: {
      sm: { group: textSurfacePadding.sm },
      md: { group: textSurfacePadding.md },
      lg: { group: textSurfacePadding.lg },
    },
  },
  defaultVariants: {
    size: "md",
  },
} satisfies SlotRecipeConfig;
