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
import { recipeClassName } from "../src/internal/recipe-class.js";

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
