// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin (`@vitejs/plugin-react` is not a
// dependency here, and adding it just for tests would be an extra build-pipeline dependency).
// `React.createElement` gives the exact same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on, without that extra dependency.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../src/button/Button.js";
import { buttonRecipe } from "../src/button/button.recipe.js";
import type { ButtonProps } from "../src/button/button.types.js";
import { recipeClassName, variantClassName } from "../src/internal/recipe-class.js";
import { emittedStylesheet, ruleBody } from "./support/emitted-css.js";

afterEach(() => {
  cleanup();
});

// `ButtonProps.children` is required, so it must live on the props object itself for
// `createElement`'s overload resolution (and the excess-property checks below) to see it.
//
// THE OMIT HAS TO DISTRIBUTE, and a plain `Omit` silently did not. `ButtonProps` became a union
// when `isPending`/`pendingLabel` arrived, and `Omit` over a union collapses it: `keyof` a union
// is the INTERSECTION of its keys, so the two branches fuse into one object with
// `isPending?: boolean` and `pendingLabel?: string` and the correlation between them is gone.
// That is not merely a compile error to route around — it would let this helper call a pending
// button with no label, which is the exact mistake the union exists to refuse.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function renderButton(props: DistributiveOmit<ButtonProps, "children">, children: ReactNode) {
  return render(createElement(Button, { ...props, children }));
}

describe("Button", () => {
  it('renders a native <button> with type="button" by default', () => {
    renderButton({}, "Click me");
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("applies exactly the base and default variant classes with no props", () => {
    renderButton({}, "Default");
    const button = screen.getByRole("button", { name: "Default" });
    expect(button.className).toBe(recipeClassName(buttonRecipe, {}));
  });

  it("applies exactly the visual=danger size=lg variant classes and no others", () => {
    renderButton({ visual: "danger", size: "lg" }, "Danger");
    const button = screen.getByRole("button", { name: "Danger" });
    expect(button.className).toBe(recipeClassName(buttonRecipe, { visual: "danger", size: "lg" }));
  });

  it("marks a disabled button with the disabled attribute and RAC's data-disabled", () => {
    renderButton({ isDisabled: true }, "Disabled");
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("data-disabled")).toBe("true");
  });

  it("suppresses onPress while disabled", () => {
    const onPress = vi.fn();
    renderButton({ isDisabled: true, onPress }, "Disabled");
    const button = screen.getByRole("button", { name: "Disabled" });
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("fires onPress exactly once for Enter", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    renderButton({ onPress }, "Press");
    const button = screen.getByRole("button", { name: "Press" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("fires onPress exactly once for Space", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    renderButton({ onPress }, "Press");
    const button = screen.getByRole("button", { name: "Press" });
    button.focus();
    await user.keyboard(" ");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders children inside the button", () => {
    renderButton({}, "Child text");
    expect(screen.getByRole("button").textContent).toBe("Child text");
  });
});

// The `width` axis exists because a full-width button was not merely awkward before it — it was
// impossible. `Button` is `inline-flex`, so it shrink-wraps its label, and the package types
// `className` and `style` as `never`, so a consumer has no way to stretch one. Measured in a bare
// consumer app: the only wrapper that worked was `display: grid`, which stretched a 54px button
// to its 600px container. `display: block` and both flex spellings left it at 54px. Making the
// contract depend on a consumer knowing that grid stretches its children — and only grid — is not
// a contract; hence a real prop.
//
// `width: auto | full`, not a `fullWidth` boolean, mirrors `Menu`'s existing `width: auto | trigger`
// axis. Two components with a width concern should spell it the same way, and an axis leaves room
// for a third value later where a boolean would have to be deprecated to grow one.
//
// `auto` carries an explicit `width: auto` rather than an empty style object. An empty variant
// value emits no rule at all, and `G5` in `css-gates.test.ts` fails any declared variant value the
// stylesheet has no rule for — correctly, since a class the component renders but nothing styles
// is a class that does nothing. The declaration is also honest: `auto` is the initial value this
// restores when a consumer sets the axis back.
describe("Button width axis", () => {
  it("defaults to width=auto, so an existing call site keeps shrink-wrapping", () => {
    renderButton({}, "Auto");
    const button = screen.getByRole("button", { name: "Auto" });
    expect(button.className).toBe(recipeClassName(buttonRecipe, { width: "auto" }));
  });

  it("applies exactly the width=full variant class and no others", () => {
    renderButton({ width: "full" }, "Full");
    const button = screen.getByRole("button", { name: "Full" });
    expect(button.className).toBe(recipeClassName(buttonRecipe, { width: "full" }));
  });

  it("composes with the other two axes rather than replacing them", () => {
    renderButton({ visual: "danger", size: "lg", width: "full" }, "All three");
    const button = screen.getByRole("button", { name: "All three" });
    expect(button.className).toBe(
      recipeClassName(buttonRecipe, { visual: "danger", size: "lg", width: "full" }),
    );
  });

  // Asserting the emitted declaration, not just that a rule exists. `G5` already proves a rule is
  // emitted per variant value; a rule that emitted the wrong width would satisfy it and still ship
  // a button that does not stretch.
  it("emits width:100% for full and width:auto for auto", () => {
    const css = emittedStylesheet();
    expect(ruleBody(css, variantClassName(buttonRecipe.className, "width", "full"))).toMatch(
      /width:\s*100%/,
    );
    expect(ruleBody(css, variantClassName(buttonRecipe.className, "width", "auto"))).toMatch(
      /width:\s*auto/,
    );
  });
});

// Icons arrive as typed slots (`iconStart`/`iconEnd`), not as `children` next to a `gap`. With
// `children` the system can guarantee neither order nor spacing — `<Button><Icon/>Save</Button>`
// and `<Button>Save<Icon/></Button>` both type-check and mean different things — and a design
// system that never receives the icon as a value cannot reason about it later. This is the rule
// `Dialog` and `Menu` already follow: the consumer supplies content, the system supplies
// structure.
//
// THE WRAPPER CARRIES `data-zui-icon`, NOT A CLASS, and that is a constraint rather than a taste
// call. `G5 (reverse)` in css-gates.test.ts fails any emitted `zui-button__*` class no registered
// recipe declares, and Button's recipe is flat: only a SLOT recipe derives `__slot` classes. The
// alternative — converting Button to a slot recipe — renames `.zui-button` to `.zui-button__root`,
// which breaks every consumer stylesheet and `Menu`, which renders a `Button`. An attribute hook
// costs no class-contract change and matches the `&[data-disabled]` selectors the recipe already
// uses. It also stays out of a consumer's reach on purpose: `className` is `never` here, so the
// icon box is structure the system owns, not a styling seam.
describe("Button icon slots", () => {
  const iconStart = createElement("svg", { "data-testid": "start-icon" });
  const iconEnd = createElement("svg", { "data-testid": "end-icon" });

  // `:scope >` restricts the match to the button's OWN icon boxes. A bare descendant query would
  // also count a `data-zui-icon` that happened to appear inside consumer-supplied icon content,
  // and would then report a wrapper the component never rendered.
  const iconSlots = (button: HTMLElement) =>
    [...button.querySelectorAll(":scope > [data-zui-icon]")].map((el) =>
      el.getAttribute("data-zui-icon"),
    );

  it("renders iconStart before the label and iconEnd after it", () => {
    renderButton({ iconStart, iconEnd }, "Save");
    const button = screen.getByRole("button", { name: "Save" });
    expect(iconSlots(button)).toEqual(["start", "end"]);
    expect(button.firstElementChild?.getAttribute("data-zui-icon")).toBe("start");
    expect(button.lastElementChild?.getAttribute("data-zui-icon")).toBe("end");
  });

  it("renders only the slot that was supplied", () => {
    renderButton({ iconEnd }, "One");
    expect(iconSlots(screen.getByRole("button", { name: "One" }))).toEqual(["end"]);
  });

  it("adds no wrapper element at all when neither slot is supplied", () => {
    renderButton({}, "Plain");
    expect(iconSlots(screen.getByRole("button", { name: "Plain" }))).toEqual([]);
  });

  // Omitting the prop is NOT the only way a caller says "no icon", and the difference is a real
  // defect rather than a technicality. `iconStart={isSaving && <Spinner />}` passes `false`, and
  // `iconStart={icon ?? null}` passes `null`. React renders nothing for either, so wrapping them
  // would put an empty flex item in the button — and because `gap` lives on the button, that
  // empty box shifts the label sideways by a full gap with nothing visible in it.
  it.each([
    ["false, from `cond && <Icon/>`", false],
    ["null, from `icon ?? null`", null],
    ["undefined, from an omitted prop", undefined],
    ["the empty string", ""],
  ])("renders no icon box for %s", (_label, value) => {
    renderButton({ iconStart: value, iconEnd: value }, "Nothing");
    expect(iconSlots(screen.getByRole("button", { name: "Nothing" }))).toEqual([]);
  });

  // The counterpart, so the guard above cannot be "fixed" into swallowing everything: `0` renders
  // the text "0" in React, so a box around it is correct and must survive.
  it("still renders a box for 0, which React renders as text", () => {
    renderButton({ iconStart: 0 }, "Zero");
    expect(iconSlots(screen.getByRole("button", { name: "Zero" }))).toEqual(["start"]);
  });

  // The icon is decoration: the accessible name comes from the label, and `aria-hidden` on the
  // wrapper keeps a consumer's icon — which may well carry its own title or aria-label — from
  // appending a second, duplicated word to that name. `getByRole` with an exact name is the
  // assertion; it would not match if the icon leaked into the computed name.
  it("keeps the accessible name coming from the label, never from the icon", () => {
    renderButton({ iconStart: createElement("svg", { "aria-label": "floppy disk" }) }, "Save");
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.querySelector("[data-zui-icon]")?.getAttribute("aria-hidden")).toBe("true");
  });

  // NOT a tautology against `recipeClassName`: it compares the class string one button renders
  // WITH icons against the string the SAME configuration renders without them. Icons are
  // structure, so the class contract must not move — the lesson from the `width` axis, where a
  // new default variant silently added a class to every button that already existed.
  it("leaves the rendered class string identical to the same button without icons", () => {
    renderButton({ visual: "danger", size: "lg" }, "Save");
    const plain = screen.getByRole("button", { name: "Save" }).className;
    cleanup();
    renderButton({ visual: "danger", size: "lg", iconStart, iconEnd }, "Save");
    expect(screen.getByRole("button", { name: "Save" }).className).toBe(plain);
  });

  // Every assertion above passes with no stylesheet at all, so none of them can tell a spaced
  // icon from one glued to the label. These two read what actually ships.
  // Reads the emitted RATIO per size, not merely that some `gap` exists. Presence alone would be
  // satisfied by a recipe regression that gave all three sizes one identical gap, which is exactly
  // the claim this axis makes — that the gap scales with the button — left unproved.
  it("emits a gap on every size, scaled by that size's own ratio", () => {
    const css = emittedStylesheet();
    const ratios: Record<string, string> = { sm: "0.375", md: "0.5", lg: "0.75" };
    for (const size of Object.keys(buttonRecipe.variants.size)) {
      const body = ruleBody(css, variantClassName(buttonRecipe.className, "size", size));
      // `subject.match(pattern)`, not the other spelling: identical for a non-global regex, and
      // `G12` in test-hygiene-gates.test.ts explains why the spelling is not free here.
      const emitted = body.match(/gap:\s*([^;]+)/)?.[1]?.trim() ?? "";
      expect({ [size]: emitted }).toEqual({
        [size]: `calc(var(--zuip-spacing-button-px) * ${ratios[size]})`,
      });
    }
  });

  // `flex-shrink: 0` is not decoration either: with `width="full"` and a long label the icon is a
  // flex item like any other, and would be squashed by the label without it.
  it("emits a rule that keeps the icon from being squashed by a long label", () => {
    expect(emittedStylesheet()).toMatch(
      /\.zui-button\s*>\s*\[data-zui-icon\][^{]*\{[^}]*flex-shrink:\s*0/,
    );
  });
});

// G6 (the "use client" boundary assertion) moved to __tests__/emit-gates.test.ts, where it is
// now one registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `ButtonProps` (rather than a direct call to
// `createElement`) so the excess-property/type checks below still apply to a fresh object
// literal, without tripping Biome's `noChildrenProp` rule on a raw `createElement` call.
function buttonElement(props: ButtonProps) {
  return createElement(Button, props);
}

describe("Button public API surface (type-level)", () => {
  it("rejects className, style and unknown variant values at compile time", () => {
    // tsc asserts the rejection itself: each @ts-expect-error fails the
    // typecheck the moment its error disappears. What runs here is the
    // runtime half of the contract — a rejected prop still constructs a
    // valid element rather than throwing.
    const constructed = [
      // @ts-expect-error className is not part of the public API
      buttonElement({ className: "x", children: "x" }),
      // @ts-expect-error style is not part of the public API
      buttonElement({ style: {}, children: "x" }),
      // @ts-expect-error unknown variant value
      buttonElement({ visual: "nope", children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});

// `isPending` closes the feedback set: it is the state a button is in between a press and the
// answer, and before this axis existed a consumer had exactly two ways to spell it, both wrong.
// `isDisabled` says "you may not do this" — a permanent judgement about permission — when the
// truth is "you already did, wait"; it also drops the button from the tab order mid-interaction,
// moving a keyboard user's focus to nowhere. The other spelling, swapping the label for a spinner
// in `children`, resizes the button under the pointer that just pressed it.
//
// THE SPINNER IS RENDERED BY THE SYSTEM, NOT COMPOSED BY THE CONSUMER, and that is forced rather
// than preferred. The obvious consumer spelling — `iconStart={<Spinner label="Saving" />}` — is
// SILENTLY BROKEN: `iconSlot` wraps the start slot in `aria-hidden="true"` because icons there are
// decorative, which strips the spinner's accessible name and, with it, the whole announcement
// mechanism react-aria-components builds on `ProgressBarContext`. A slot whose documented use
// removes the name of the thing put in it is a trap, so the pending indicator gets its own box —
// `data-zui-pending`, never `aria-hidden` — that the consumer cannot mis-wire.
//
// The cost is named rather than hidden: `Button` now imports `Spinner`, so every consumer of
// `Button` pays those bytes, `Menu` included since it renders one. That trade bought the
// correctness above, and the bundle-budget ledger records what it cost.
describe("Button pending state", () => {
  const iconStart = createElement("svg", { "data-testid": "start-icon" });
  const iconEnd = createElement("svg", { "data-testid": "end-icon" });

  const iconSlots = (button: HTMLElement) =>
    [...button.querySelectorAll(":scope > [data-zui-icon]")].map((el) =>
      el.getAttribute("data-zui-icon"),
    );

  it("marks the button with RAC's data-pending only while pending", () => {
    renderButton({ isPending: true, pendingLabel: "Saving" }, "Save");
    expect(screen.getByRole("button").getAttribute("data-pending")).toBe("true");
    cleanup();
    renderButton({ isPending: false, pendingLabel: "Saving" }, "Save");
    expect(screen.getByRole("button").hasAttribute("data-pending")).toBe(false);
  });

  // THE DIFFERENCE FROM `isDisabled`, asserted rather than described. A pending button carries
  // `aria-disabled`, which tells assistive tech the press will not land, but NOT the `disabled`
  // attribute, which would remove it from the tab order. Focus is the whole point: the user
  // pressed this button, so it is where their focus already is, and yanking it away mid-operation
  // sends a keyboard user back to the top of the document.
  it("keeps the button focusable while pending, unlike isDisabled", () => {
    renderButton({ isPending: true, pendingLabel: "Saving" }, "Save");
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("suppresses onPress while pending", () => {
    const onPress = vi.fn();
    renderButton({ isPending: true, pendingLabel: "Saving", onPress }, "Save");
    fireEvent.click(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  // A submit button that stayed `type="submit"` while pending would still submit its form on
  // Enter from any text input in it — implicit submission does not go through the button's own
  // press handling, so suppressing `onPress` above does not cover it. RAC downgrades the type for
  // exactly that reason, and this pins the behaviour so a future refactor cannot drop it.
  it("downgrades type=submit to type=button while pending, and restores it after", () => {
    renderButton({ isPending: true, pendingLabel: "Saving", type: "submit" }, "Save");
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
    cleanup();
    renderButton({ isPending: false, pendingLabel: "Saving", type: "submit" }, "Save");
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });

  it("renders a named busy indicator while pending, and none when idle", () => {
    renderButton({ isPending: true, pendingLabel: "Saving" }, "Save");
    expect(screen.getByRole("progressbar", { name: "Saving" })).toBeTruthy();
    cleanup();
    renderButton({ isPending: false, pendingLabel: "Saving" }, "Save");
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  // THE REGRESSION THIS WHOLE DESIGN EXISTS TO PREVENT. The icon boxes are `aria-hidden`, so a
  // spinner placed in one has no accessible name and announces nothing. The pending box must never
  // acquire that attribute, however the two are refactored together later.
  it("never hides the pending box from assistive tech", () => {
    renderButton({ isPending: true, pendingLabel: "Saving" }, "Save");
    const box = screen.getByRole("button").querySelector(":scope > [data-zui-pending]");
    expect(box).toBeTruthy();
    expect(box?.hasAttribute("aria-hidden")).toBe(false);
  });

  // THE EXACT NAME, AND THE REGEX THAT HID IT. This assertion used to read
  // `getByRole("button", { name: /Save/ })`, which is a SUBSTRING match and therefore passes
  // identically for "Save" and for "Saving Save" — it could not tell the documented behaviour from
  // any other. Measured with the exact string instead: the name is "Saving Save".
  //
  // The indicator's label is visually hidden but still in the accessibility tree, and `AriaButton`
  // has no `aria-label`, so its name is computed from content — the label first, because the
  // pending box precedes `children` in the DOM. Both halves of that sentence are pinned here: flip
  // the order or hide the label from assistive tech and one of these two assertions fails.
  it("announces the indicator's label and the button's own label, in DOM order", () => {
    renderButton({ isPending: true, pendingLabel: "Saving" }, "Save");
    expect(screen.queryByRole("button", { name: "Saving Save" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  // The idle button is the control case, and it is what makes the assertion above mean something:
  // the extra word arrives WITH the pending state and leaves with it, rather than being a name this
  // button always had.
  it("carries only its own label when idle", () => {
    renderButton({ isPending: false, pendingLabel: "Saving" }, "Save");
    expect(screen.queryByRole("button", { name: "Save" })).toBeTruthy();
  });

  // The spinner takes the start slot's PLACE rather than sitting beside it: two round things
  // competing for the same spot widen the button under the pointer that just pressed it, which is
  // the exact defect the whole axis exists to avoid. `iconEnd` is untouched — it is not in the way.
  it("replaces iconStart while pending and leaves iconEnd alone", () => {
    renderButton({ isPending: true, pendingLabel: "Saving", iconStart, iconEnd }, "Save");
    const button = screen.getByRole("button");
    expect(iconSlots(button)).toEqual(["end"]);
    expect(button.firstElementChild?.hasAttribute("data-zui-pending")).toBe(true);
  });

  it("restores iconStart once pending ends", () => {
    renderButton({ isPending: false, pendingLabel: "Saving", iconStart, iconEnd }, "Save");
    expect(iconSlots(screen.getByRole("button"))).toEqual(["start", "end"]);
  });

  // Pending is STATE, not a variant, so it must not move the class contract — the lesson the
  // `width` axis taught when a new default variant silently added a class to every button that
  // already existed. The styling hook is the `[data-pending]` attribute RAC already sets.
  it("leaves the rendered class string identical to the same button when idle", () => {
    renderButton({ visual: "danger", size: "lg" }, "Save");
    const idle = screen.getByRole("button").className;
    cleanup();
    renderButton({ visual: "danger", size: "lg", isPending: true, pendingLabel: "Saving" }, "Save");
    expect(screen.getByRole("button").className).toBe(idle);
  });

  // `cursor: progress`, NOT the `not-allowed` that `[data-disabled]` uses, and NOT a dimmed
  // opacity. Both of those spell "this control is unavailable"; a pending button is the opposite —
  // it is busy doing the thing that was asked of it, and it will come back. Dimming it would also
  // make pending visually indistinguishable from disabled, which is the confusion the state was
  // added to remove.
  it("emits a pending cursor without borrowing the disabled treatment", () => {
    const css = emittedStylesheet();
    const body = css.match(/\.zui-button\[data-pending\][^{]*\{([^}]*)\}/)?.[1] ?? "";
    expect(body).toMatch(/cursor:\s*progress/);
    expect(body).not.toMatch(/opacity/);
  });

  // Same load-bearing declaration the icon box needs, for the same reason: with `width="full"` and
  // a long label the pending box is an ordinary flex item, and a squashed spinner is an ellipse.
  it("emits a rule that keeps the pending box from being squashed by a long label", () => {
    expect(emittedStylesheet()).toMatch(
      /\.zui-button\s*>\s*\[data-zui-pending\][^{]*\{[^}]*flex-shrink:\s*0/,
    );
  });
});

// `pendingLabel` is REQUIRED alongside `isPending` at the type level, for the reason
// `spinner.types.ts` already argues about its own `label`: a busy indicator with no programmatic
// name fails the blocking accessibility gate, and this package refuses to invent one — a spinner
// that names itself says the same thing on every page, which is the same as saying nothing. Making
// it a discriminated union rather than a second optional prop means the compiler refuses the
// broken call instead of a story catching it later.
describe("Button pending API surface (type-level)", () => {
  it("rejects isPending without a pendingLabel, and pendingLabel without isPending", () => {
    const constructed = [
      // @ts-expect-error isPending requires pendingLabel — the indicator needs a name
      buttonElement({ isPending: true, children: "x" }),
      // @ts-expect-error pendingLabel means nothing without isPending
      buttonElement({ pendingLabel: "Saving", children: "x" }),
      buttonElement({ isPending: true, pendingLabel: "Saving", children: "x" }),
    ];
    expect(constructed.every(isValidElement)).toBe(true);
  });
});
