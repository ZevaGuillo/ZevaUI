import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@zevaui/components";
import tokens, { themeIds, themeKeyOf } from "@zevaui/tokens";
import { expect, within } from "storybook/test";

// Proves the theme decorator in .storybook/preview.ts really re-themes the
// canvas: for whichever theme the run's `globals.theme` selects, <html>
// must carry exactly that one `theme-*` class (the consumer mechanism from
// packages/tokens/scripts/build.js) AND the semantic custom properties must
// COMPUTE to that theme's values — not just have a class present while the
// `:root` light values still win. Under the themed vitest matrix
// (vitest.shared.ts) this story runs once per theme, so all three themes
// are asserted on every `pnpm test`.
const meta = {
  title: "ThemeContract",
  component: Button,
  args: { children: "Theme probe" },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AppliesActiveThemeTokens: Story = {
  play: async ({ globals }) => {
    const theme = (globals.theme ?? "light") as (typeof themeIds)[number];
    const root = document.documentElement;

    // Exactly one theme class, and it is the active theme's.
    const applied = themeIds.filter((id) => root.classList.contains(`theme-${id}`));
    await expect(applied).toEqual([theme]);

    // Computed custom properties resolve to this theme's token values.
    const expected = tokens[themeKeyOf[theme]];
    const computed = getComputedStyle(root);
    await expect(computed.getPropertyValue("--zui-color-text-default").trim()).toBe(
      expected["color-text-default"],
    );
    await expect(computed.getPropertyValue("--zui-color-bg-canvas").trim()).toBe(
      expected["color-bg-canvas"],
    );
  },
};

// The story above asserts the theme at <html>, which is the case that always worked — and that is
// precisely why the SCOPED case stayed broken and unnoticed. `@zevaui/tokens` ships a `theme-*`
// class, the README's Theming section tells a consumer to override tokens "scoped to a selector, a
// theme class, whatever your app needs", and a dark panel inside a light page is the ordinary way
// anyone would reach for that. It did nothing.
//
// The cause was cascade semantics, not a missing token. A custom property substitutes its `var()`
// at the element that DECLARES it, so with the component bridge declared once on
// `:where(:root, :host)`, every `--zuip-*` was resolved against the ROOT's `--zui-*` and inherited
// already-resolved. Redeclaring `--zui-*` further down the tree could not reach it. Panda's
// `cssVarRoot` now emits that bridge on `:where(*)`, so every element re-resolves against the
// `--zui-*` it actually inherits.
//
// This asserts the RENDERED result, not the variable: a component inside the section must paint
// differently from the same component outside it. A variable assertion would pass on a bridge that
// resolves correctly and never reaches the component.
export const AppliesAScopedThemeClass: Story = {
  tags: ["!visual"],
  render: () => (
    <>
      <Button visual="subtle">Outside</Button>
      <section className="theme-dark">
        <Button visual="subtle">Inside a scoped theme</Button>
      </section>
    </>
  ),
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    const paintOf = (name: string) => {
      const style = getComputedStyle(canvas.getByRole("button", { name }));
      return `${style.backgroundColor}|${style.color}`;
    };

    // Under the themed matrix this story also runs with `theme-dark` already on <html>, where
    // "inside" and "outside" are legitimately identical — nesting dark inside dark changes
    // nothing. Only the light run can prove the scoped class does something.
    if ((globals.theme ?? "light") !== "light") return;

    await expect(paintOf("Inside a scoped theme")).not.toBe(paintOf("Outside"));
  },
};
