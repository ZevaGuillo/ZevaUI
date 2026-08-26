import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@zevaui/components";
import tokens, { themeIds, themeKeyOf } from "@zevaui/tokens";
import { expect } from "storybook/test";

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
