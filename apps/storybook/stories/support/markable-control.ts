import { expect, within } from "storybook/test";

/**
 * The shared browser-side assertions every markable control needs, in one place.
 *
 * `Checkbox` and `Switch` each have to prove the same property about their emitted CSS, and
 * `RadioGroup` will make three. The story bodies had been copied between them, which is worse
 * than ordinary duplication: what they measure is a SPECIFICITY interaction, and a copy that
 * drifts stops testing the thing it was written for while still passing.
 */

/**
 * Hovering an invalid control must not repaint its boundary.
 *
 * THE BUG THIS PINS IS REAL, and was caught by review on `Checkbox` rather than by its author.
 * Counted on the emitted selectors:
 *
 *   .zui-x__part[data-hovered]:not([data-disabled])  -> (0,3,0)
 *   .zui-x__part[data-invalid]                       -> (0,2,0)
 *
 * A `:not()` argument carries its own specificity weight, so the hover tint outranked the invalid
 * border no matter the source order, and an invalid control turned from red back to accent the
 * moment the pointer touched it — the one moment the user is looking straight at it.
 * `aria-invalid` never changed, so a screen reader was unaffected and only sighted users lost the
 * signal, which is why nothing else would have caught it.
 *
 * THE HOVER IS SET DIRECTLY, NOT SIMULATED, and that is measured rather than a shortcut.
 * `userEvent.hover` does not drive react-aria's hover state in this runner: `data-hovered` stayed
 * null after hovering both the styled part and the root element react-aria actually listens on.
 * Asserting through a stimulus that never arrives would produce a test that passes for the wrong
 * reason. `data-hovered` on the styled part is not react-aria's attribute anyway — each component
 * stamps it from the render prop, precisely so its recipe rules stay local — so setting it here
 * exercises exactly the contract in question: given a part carrying both `data-hovered` and
 * `data-invalid`, which rule wins the cascade. The stimulus is synthetic; the measurement is not,
 * since `getComputedStyle` resolves the real stylesheet in a real browser, which is the only
 * place a specificity bug is ever visible.
 *
 * @param canvasElement the story's canvas, as handed to `play`
 * @param role the ARIA role the control's input reports — `"checkbox"`, `"switch"`, ...
 * @param partSelector the class selector of the part whose border carries the invalid signal
 * @param names accessible names of the three controls the story renders: `hoveredInvalid` and
 *        `restingInvalid` are both invalid, and only the first is hovered; `hoveredValid` is the
 *        valid control the hovered-invalid one is compared against
 */
export const assertHoverDoesNotOutrankInvalid = (
  canvasElement: HTMLElement,
  role: string,
  partSelector: string,
  names: { hoveredInvalid: string; restingInvalid: string; hoveredValid: string },
) => {
  const canvas = within(canvasElement);
  // Resolved, then CHECKED, rather than cast. The optional chain can legitimately yield null —
  // the control may have no `label` ancestor, or `partSelector` may stop matching — and casting
  // that away would defer the failure to the `dataset` write below, which throws a TypeError
  // naming only `null` from inside a helper two components now share. Since extraction
  // concentrated the failure point, it has to say WHAT it could not find, which is why the throw
  // here carries the selector and the accessible name. Named by review as the cost of sharing.
  const partOf = (name: string): HTMLElement => {
    const part = canvas.getByRole(role, { name }).closest("label")?.querySelector(partSelector);
    if (!(part instanceof HTMLElement)) {
      throw new TypeError(
        `No element matching "${partSelector}" inside the <label> of the ${role} named "${name}". ` +
          `The control's DOM structure or its part class changed.`,
      );
    }
    return part;
  };

  const hoveredInvalid = partOf(names.hoveredInvalid);
  const restingInvalid = partOf(names.restingInvalid);
  const hoveredValid = partOf(names.hoveredValid);

  hoveredInvalid.dataset.hovered = "true";
  hoveredValid.dataset.hovered = "true";

  expect(restingInvalid).not.toHaveAttribute("data-hovered");

  const borderOf = (element: HTMLElement) => getComputedStyle(element).borderColor;

  // Compared against other rendered controls rather than a colour literal: the tokens differ per
  // theme, so any hard-coded expectation would be wrong in two of the three theme runs.
  expect(borderOf(hoveredInvalid)).toBe(borderOf(restingInvalid));
  expect(borderOf(hoveredInvalid)).not.toBe(borderOf(hoveredValid));
};
