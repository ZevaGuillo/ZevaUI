// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file: it stays `.test.ts` (not `.test.tsx`) so this
// package's Vitest setup does not need a JSX transform plugin (`@vitejs/plugin-react` is not a
// dependency here, and adding it just for tests would be an extra build-pipeline dependency).
// `React.createElement` gives the exact same excess-property/type-mismatch checking the
// `@ts-expect-error` assertions below rely on, without that extra dependency.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, isValidElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../src/button/Button.js";
import { buttonRecipe } from "../src/button/button.recipe.js";
import type { ButtonProps } from "../src/button/button.types.js";
import { recipeClassName, variantClassName } from "../src/internal/recipe-class.js";

afterEach(() => {
  cleanup();
});

// `ButtonProps.children` is required, so it must live on the props object itself for
// `createElement`'s overload resolution (and the excess-property checks below) to see it.
function renderButton(props: Omit<ButtonProps, "children">, children: ReactNode) {
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
  const css = readFileSync(
    join(dirname(dirname(fileURLToPath(import.meta.url))), "dist", "styles.css"),
    "utf8",
  );

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
    const ruleFor = (className: string) => {
      const match = new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`).exec(css);
      return match?.[1] ?? "";
    };
    expect(ruleFor(variantClassName(buttonRecipe.className, "width", "full"))).toMatch(
      /width:\s*100%/,
    );
    expect(ruleFor(variantClassName(buttonRecipe.className, "width", "auto"))).toMatch(
      /width:\s*auto/,
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
