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
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../src/button/Button.js";
import { buttonRecipe } from "../src/button/button.recipe.js";
import { recipeClassName } from "../src/internal/recipe-class.js";

afterEach(() => {
  cleanup();
});

describe("Button", () => {
  it('renders a native <button> with type="button" by default', () => {
    render(createElement(Button, {}, "Click me"));
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("applies exactly the base and default variant classes with no props", () => {
    render(createElement(Button, {}, "Default"));
    const button = screen.getByRole("button", { name: "Default" });
    expect(button.className).toBe(recipeClassName(buttonRecipe, {}));
  });

  it("applies exactly the visual=danger size=lg variant classes and no others", () => {
    render(createElement(Button, { visual: "danger", size: "lg" }, "Danger"));
    const button = screen.getByRole("button", { name: "Danger" });
    expect(button.className).toBe(recipeClassName(buttonRecipe, { visual: "danger", size: "lg" }));
  });

  it("marks a disabled button with the disabled attribute and RAC's data-disabled", () => {
    render(createElement(Button, { isDisabled: true }, "Disabled"));
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("data-disabled")).toBe("true");
  });

  it("suppresses onPress while disabled", () => {
    const onPress = vi.fn();
    render(createElement(Button, { isDisabled: true, onPress }, "Disabled"));
    const button = screen.getByRole("button", { name: "Disabled" });
    fireEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("fires onPress exactly once for Enter", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(createElement(Button, { onPress }, "Press"));
    const button = screen.getByRole("button", { name: "Press" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("fires onPress exactly once for Space", async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(createElement(Button, { onPress }, "Press"));
    const button = screen.getByRole("button", { name: "Press" });
    button.focus();
    await user.keyboard(" ");
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders children inside the button", () => {
    render(createElement(Button, {}, "Child text"));
    expect(screen.getByRole("button").textContent).toBe("Child text");
  });
});

describe('G6: the emitted Button module ships the "use client" directive', () => {
  it("starts dist/button/Button.js with the client boundary directive", () => {
    const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    const built = readFileSync(join(packageRoot, "dist", "button", "Button.js"), "utf8");
    expect(built.startsWith('"use client";')).toBe(true);
  });
});

describe("Button public API surface (type-level)", () => {
  it("rejects className, style and unknown variant values at compile time", () => {
    // @ts-expect-error className is not part of the public API
    createElement(Button, { className: "x", children: "x" });
    // @ts-expect-error style is not part of the public API
    createElement(Button, { style: {}, children: "x" });
    // @ts-expect-error unknown variant value
    createElement(Button, { visual: "nope", children: "x" });
  });
});
