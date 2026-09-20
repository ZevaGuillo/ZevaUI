import type { SlotRecipeConfig } from "@pandacss/dev";

export const TABLE_RECIPE_KEY = "table";

/**
 * Table is multi-part, so it is a Panda SLOT recipe, routed to `theme.slotRecipes` off the presence
 * of `slots` alone (see `isSlotRecipe` in src/registry.ts).
 *
 * Slot -> element:
 *   scroller -> <div role="region" tabindex="0">  the horizontal scroll container
 *   table    -> <table>
 *   caption  -> <caption>   the table's accessible name, drawn
 *   head     -> <thead>
 *   headCell -> <th scope="col">
 *   body     -> <tbody>
 *   row      -> <tr>
 *   cell     -> <td> / <th scope="row">
 *   empty    -> the single cell shown when there are no rows
 *
 * ALIGNMENT IS AN ATTRIBUTE, NOT A VARIANT, and that is forced rather than preferred. A Panda
 * variant applies to the whole component, and alignment is a per-COLUMN decision — numbers want to
 * end-align while the labels beside them start-align, in the same table. So `Table.tsx` stamps
 * `data-zui-align` on the cells of a column that asked for it and the rules live here, the same
 * shape `button.recipe.ts` uses for its icon boxes and for the same reason: an attribute costs no
 * class-contract change.
 *
 * NO ZEBRA STRIPING, AND NO `density` AXIS. Both are the obvious first variants and both are
 * deferred rather than forgotten. Striping needs a second surface colour that reads as "still a
 * row" rather than "selected" — this package has `bg.subtle`, which `Menu` already spends on hover,
 * so a striped row and a hovered row would be the same colour and the hover would stop meaning
 * anything. Density is a real axis and wants a real measurement of what the compact value should be
 * against a row of real data, which is a thing to do with a table in front of you rather than in a
 * recipe.
 *
 * THE BORDERS ARE HORIZONTAL ONLY. A full grid of rules reads as a spreadsheet and fights the
 * alignment that is already doing the work; a rule under each row is what separates records without
 * claiming each cell is a box. `border.default` rather than `border.strong` for the reason
 * `separator.recipe.ts` gives: WCAG 1.4.11 measures the boundary that IDENTIFIES a component, and a
 * row rule identifies nothing.
 */
export const tableRecipe = {
  className: "zui-table",
  slots: ["scroller", "table", "caption", "head", "headCell", "body", "row", "cell", "empty"],
  base: {
    scroller: {
      // The whole reason this element exists. A table is the one thing in a layout whose width is
      // its content's rather than its container's, so a wide one has to scroll inside its own box
      // instead of pushing the page sideways. `Table.tsx` makes it focusable and names it — see
      // there for why that is a WCAG requirement rather than a nicety.
      overflowX: "auto",
      "&:focus-visible": {
        outlineWidth: "2px",
        outlineStyle: "solid",
        outlineColor: "focusRing",
        outlineOffset: "2px",
      },
    },
    table: {
      // `collapse`, so the row rules below meet rather than doubling up between adjacent rows.
      borderCollapse: "collapse",
      // A table narrower than its container should still fill it — a 3-column table floating at
      // 200px in a 900px page reads as broken rather than as compact.
      inlineSize: "100%",
      fontFamily: "body",
      fontSize: "body",
      fontWeight: "body",
      lineHeight: "body",
      color: "text.default",
    },
    caption: {
      // Drawn, not hidden. `table.types.ts` argues why the name is visible; this places it above
      // the table, which is where `<caption>` renders by default and where a heading belongs.
      textAlign: "start",
      fontWeight: "heading",
      color: "text.default",
      paddingBlockEnd: "calc({spacing.card.py} * 0.5)",
    },
    head: {
      // No background of its own: the header is distinguished by weight and by the rule beneath it,
      // not by a fill. A tinted header would need a surface this package does not have spare — see
      // the note about striping above.
      borderBlockEndWidth: "1px",
      borderBlockEndStyle: "solid",
      borderBlockEndColor: "border.default",
    },
    headCell: {
      textAlign: "start",
      verticalAlign: "bottom",
      fontWeight: "heading",
      color: "text.default",
      paddingInline: "calc({spacing.card.px} * 0.5)",
      paddingBlock: "button.py",
      // Column labels are short by construction and a wrapped header makes every row below it move.
      whiteSpace: "nowrap",
      "&[data-zui-align='end']": { textAlign: "end" },
    },
    body: {},
    row: {
      borderBlockEndWidth: "1px",
      borderBlockEndStyle: "solid",
      borderBlockEndColor: "border.default",
      // The last row's rule would draw a line under the whole table with nothing beneath it, which
      // reads as a border the table does not have.
      "&:last-of-type": { borderBlockEndStyle: "none" },
    },
    cell: {
      textAlign: "start",
      verticalAlign: "top",
      paddingInline: "calc({spacing.card.px} * 0.5)",
      paddingBlock: "button.py",
      "&[data-zui-align='end']": { textAlign: "end" },
    },
    empty: {
      textAlign: "center",
      color: "text.secondary",
      paddingInline: "calc({spacing.card.px} * 0.5)",
      paddingBlock: "calc({spacing.card.py} * 1.5)",
    },
  },
  variants: {},
  defaultVariants: {},
} satisfies SlotRecipeConfig;
