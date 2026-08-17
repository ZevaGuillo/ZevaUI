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
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Alert } from "../src/alert/Alert.js";
import { alertRecipe } from "../src/alert/alert.recipe.js";
import type { AlertProps } from "../src/alert/alert.types.js";
import { classSelectorPattern } from "../src/internal/consumed-tokens.js";
import { recipeClassName } from "../src/internal/recipe-class.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const css = readFileSync(join(packageRoot, "dist", "styles.css"), "utf8");

afterEach(() => {
  cleanup();
});

// `AlertProps.children` and `AlertProps.tone` are both required, so they must live on the props
// object itself for `createElement`'s overload resolution (and the excess-property checks below)
// to see them.
function renderAlert(props: AlertProps) {
  return render(createElement(Alert, props));
}

describe("Alert", () => {
  it('renders exactly "zui-alert zui-alert--tone_warning" for tone="warning"', () => {
    renderAlert({ tone: "warning", children: "Careful" });
    const alert = screen.getByText("Careful");
    expect(alert.className).toBe("zui-alert zui-alert--tone_warning");
    expect(alert.className).toBe(recipeClassName(alertRecipe, { tone: "warning" }));
  });

  it('maps tone="danger" to role="alert"', () => {
    renderAlert({ tone: "danger", children: "Something failed" });
    expect(screen.getByRole("alert").textContent).toBe("Something failed");
  });

  it('maps tone="warning" to role="alert"', () => {
    renderAlert({ tone: "warning", children: "Careful" });
    expect(screen.getByRole("alert").textContent).toBe("Careful");
  });

  it('maps tone="success" to role="status"', () => {
    renderAlert({ tone: "success", children: "Saved" });
    expect(screen.getByRole("status").textContent).toBe("Saved");
  });

  it("never carries a manual aria-live attribute, in any tone", () => {
    const tones: ReadonlyArray<AlertProps["tone"]> = ["danger", "success", "warning"];
    for (const tone of tones) {
      cleanup();
      renderAlert({ tone, children: `${tone} message` });
      const alert = screen.getByText(`${tone} message`);
      expect(alert.hasAttribute("aria-live")).toBe(false);
    }
  });

  it("renders children inside the element", () => {
    renderAlert({ tone: "success", children: "All good" });
    expect(screen.getByRole("status").textContent).toBe("All good");
  });
});

// G6 (the "use client" boundary assertion) moved to __tests__/emit-gates.test.ts, where it is
// now one registry-driven gate covering every component instead of a hand-copied block per file.
//
// Routed through a plain function typed as `AlertProps` (rather than a direct call to
// `createElement`) so the excess-property/type checks below still apply to a fresh object
// literal, without tripping Biome's `noChildrenProp` rule on a raw `createElement` call.
function alertElement(props: AlertProps) {
  return createElement(Alert, props);
}

describe("Alert public API surface (type-level)", () => {
  it("rejects className, style, an unknown tone, and a missing tone at compile time", () => {
    // @ts-expect-error className is not part of the public API
    alertElement({ tone: "danger", className: "x", children: "x" });
    // @ts-expect-error style is not part of the public API
    alertElement({ tone: "danger", style: {}, children: "x" });
    // @ts-expect-error unknown tone value
    alertElement({ tone: "info", children: "x" });
    // @ts-expect-error tone is required, not optional
    alertElement({ children: "x" } as Omit<AlertProps, "tone">);
  });
});

describe("the emitted CSS has exactly the base plus three tone rules Alert owes", () => {
  const hasRule = (className: string): boolean => {
    const pattern = classSelectorPattern(className);
    return [...css.matchAll(/([^{}]*)\{/g)].some((match) => pattern.test(match[1]));
  };

  it("emits the base .zui-alert rule", () => {
    expect(hasRule("zui-alert")).toBe(true);
  });

  it("emits exactly three .zui-alert--tone_* rules, one per declared tone", () => {
    const toneSelectors = [...new Set(css.match(/\.zui-alert--tone_[a-z]+/g) ?? [])];
    expect(toneSelectors.sort()).toEqual(
      ["zui-alert--tone_danger", "zui-alert--tone_success", "zui-alert--tone_warning"]
        .map((name) => `.${name}`)
        .sort(),
    );
  });
});
