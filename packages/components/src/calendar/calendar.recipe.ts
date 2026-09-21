import type { SlotRecipeConfig } from "@pandacss/dev";
import { textFieldError } from "../internal/text-surface.js";

export const CALENDAR_RECIPE_KEY = "calendar";

// The first component in this package that renders a GRID OF CHOICES rather than a list of them.
// `Menu`, `Select` and `Tabs` all walk a one-dimensional collection; a month is two-dimensional,
// and that is the whole reason react-aria's calendar machinery is worth its weight here where the
// collection machinery was refused for Breadcrumb, Pagination and Table.
//
// State attributes were read from react-aria-components 1.20's `dist/types/src/Calendar.d.ts`
// rather than assumed. The cell carries: data-hovered, data-pressed, data-selected, data-focused,
// data-focus-visible, data-disabled, data-unavailable, data-today, data-outside-month,
// data-outside-visible-range, data-invalid.
//
// THE CONTRAST CONSTRAINT THAT SHAPED THIS RECIPE. RAC's own documentation states it in the type:
// unavailable dates remain FOCUSABLE, so they must still meet 4.5:1. That rules out the obvious
// implementation — dimming them with `opacity` or `text.muted` — because a focusable control the
// user can reach and read must stay legible. `text.danger` on the normal surface carries the
// meaning (this day is blocked) at a ratio @zevaui/constraints already validates, and the
// strikethrough carries it again without relying on colour at all.
export const calendarRecipe = {
  className: "zui-calendar",
  slots: [
    "root",
    "header",
    "heading",
    "navButton",
    "navIcon",
    "grid",
    "headerCell",
    "cell",
    "error",
  ],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box",
      // The calendar is a surface in its own right: it is shown standalone as well as inside a
      // popover, and a grid with no ground of its own would read as floating text.
      backgroundColor: "bg.surface",
      color: "text.default",
      borderRadius: "card",
      padding: "card.px",
      gap: "calc({spacing.card.py} * 0.5)",
      width: "fit-content",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "calc({spacing.card.px} * 0.5)",
    },
    heading: {
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "emphasis",
      lineHeight: "body",
      color: "text.default",
      // The month name changes length as the user pages ("May" against "September"), and a header
      // that reflows on every step makes the arrows move under the pointer. Centring in the
      // remaining space keeps them still.
      flex: "1",
      textAlign: "center",
      margin: "0",
    },
    navButton: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "none",
      boxSizing: "border-box",
      // Square, sized off the body scale, so it stays proportional at every theme's type size and
      // clears the 24px pointer-target floor at the default scale.
      inlineSize: "calc({fontSizes.body} * 2)",
      blockSize: "calc({fontSizes.body} * 2)",
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
      "&[data-disabled]": {
        cursor: "not-allowed",
        opacity: 0.5,
      },
    },
    // The paging arrow: a square with two borders, rotated — the same pure-CSS chevron
    // `select.recipe.ts` documents, for the same reasons. No asset, no font glyph, and it inherits
    // the button's colour through `currentcolor` so it can never drift from the control around it.
    //
    // It lives here rather than as an inline style on the element, which is where it was first
    // written. `Progress` is the one component that renders an inline style, and its excuse does
    // not transfer: that value is a RUNTIME number no class can express. A chevron is static, so
    // putting it inline would have moved real styling outside the system that owns styling.
    navIcon: {
      boxSizing: "border-box",
      inlineSize: "0.4em",
      blockSize: "0.4em",
      borderRightWidth: "2px",
      borderBottomWidth: "2px",
      borderRightStyle: "solid",
      borderBottomStyle: "solid",
      borderColor: "currentcolor",
      // The rotation moves the glyph's visual centre off the box centre by half a diagonal;
      // nudging it back is what keeps the two arrows optically level with the heading between
      // them. `next` is the base case and `previous` is the mirror, stamped by Calendar.tsx.
      transform: "rotate(-45deg)",
      marginInline: "-0.1em 0.1em",
      "&[data-direction='previous']": {
        transform: "rotate(135deg)",
        marginInline: "0.1em -0.1em",
      },
    },
    grid: {
      borderCollapse: "collapse",
      // A calendar grid is a real `<table>`, so the default cell spacing has to be taken out
      // explicitly or the days sit on an uneven rhythm.
      borderSpacing: "0",
    },
    headerCell: {
      fontFamily: "body",
      fontSize: "caption",
      fontWeight: "body",
      lineHeight: "body",
      // The weekday initials are a legend, not content: `text.secondary` separates them from the
      // numbers without dropping below the text floor.
      color: "text.secondary",
      paddingBlock: "calc({spacing.card.py} * 0.25)",
      textAlign: "center",
    },
    cell: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      // Square cells off the body scale: a month grid whose columns drift makes the week
      // structure unreadable, and a fixed pixel size would ignore the theme's type scale.
      inlineSize: "calc({fontSizes.body} * 2.25)",
      blockSize: "calc({fontSizes.body} * 2.25)",
      borderRadius: "button",
      fontFamily: "body",
      fontSize: "body",
      lineHeight: "body",
      // Tabular figures keep the columns aligned between "1" and "30".
      fontVariantNumeric: "tabular-nums",
      cursor: "pointer",
      outline: "none",
      "&[data-outside-month]": {
        // Days belonging to the neighbouring month are context, not choices.
        visibility: "hidden",
      },
      // `:not([data-selected])` is load-bearing here for the same reason `:not([data-invalid])`
      // is in text-surface.ts. Counted on the emitted selectors:
      //
      //   .zui-calendar__cell[data-hovered]:not([data-disabled])  -> (0,3,0)
      //   .zui-calendar__cell[data-selected]                      -> (0,2,0)
      //
      // Without the third clause, hovering the SELECTED day repaints it with the plain hover
      // background and the selection disappears under the pointer — the one moment the user is
      // looking straight at it. Review caught this shape twice on other components; it is written
      // correctly here the first time.
      "&[data-hovered]:not([data-disabled]):not([data-selected])": {
        backgroundColor: "bg.muted",
      },
      "&[data-pressed]:not([data-disabled]):not([data-selected])": {
        backgroundColor: "bg.subtle",
      },
      // Today is an anchor, not a selection: a ring rather than a fill, so the two states can be
      // told apart when today IS the selected day.
      "&[data-today]:not([data-selected])": {
        boxShadow: "inset 0 0 0 1px {colors.border.strong}",
      },
      // `accent.default` under `text.inverse` is the one inverse pair @zevaui/constraints
      // validates — the same pair Tooltip and DateField's focused segment use.
      "&[data-selected]": {
        backgroundColor: "accent.default",
        color: "text.inverse",
      },
      "&[data-focus-visible]": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
      // Unavailable days stay FOCUSABLE — react-aria keeps them in the roving tabindex so a
      // keyboard user can tell a blocked day from a missing one. That is why this is a colour the
      // contrast contract covers plus a line through the number, rather than the dim grey every
      // calendar reaches for first. See the note at the top of this file.
      "&[data-unavailable]": {
        color: "text.danger",
        textDecoration: "line-through",
        cursor: "not-allowed",
      },
      "&[data-disabled]:not([data-unavailable])": {
        color: "text.muted",
        cursor: "not-allowed",
      },
    },
    error: textFieldError,
  },
  // NO VARIANTS, declared explicitly rather than omitted — `slotRecipeClassNames` reads
  // `recipe.variants` unconditionally, so an absent key is a TypeError rather than an empty axis
  // set. `Tooltip` reached the same shape for the same reason.
  //
  // This is the honest outcome, not a gap. A month grid has one size: the cells are squares
  // derived from the body type scale, so a size axis would either desynchronise the grid from the
  // text beside it or duplicate what the theme's scale already says.
  variants: {},
} satisfies SlotRecipeConfig;
