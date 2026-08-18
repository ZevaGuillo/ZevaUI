import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

type TagFilter = {
  readonly include: readonly string[];
  readonly exclude?: readonly string[];
};

// Shared by vitest.config.ts (the normal `test` script, `tags.include:
// ['test']`) and vitest.a11y-gate.config.ts (the gate script, `tags.include:
// ['a11y-negative']`). Only the tag filter differs between the two runs —
// everything else (browser mode, Storybook config dir) must stay identical,
// or the gate would be exercising a different environment than the one
// that ships.
//
// No `setupFiles`/`setProjectAnnotations` here: since Storybook 10.3,
// `@storybook/addon-vitest` reads `.storybook/preview.ts` and every
// registered addon's preview module (including addon-a11y's axe hook)
// automatically. Adding a manual setup file only risks the two provisioning
// paths conflicting — verified against this project's actual 10.5.8
// install, which warns exactly that.
export function createStorybookVitestConfig(tags: TagFilter) {
  return defineConfig({
    // Every config here imports every story file under stories/**, including
    // stories/__gate__/BrokenVisual.stories.tsx, to discover their tags —
    // regardless of whether any of its own stories match the tag filter
    // below. This define must therefore be unconditional and defaulted, not
    // only present on the one config that actually exercises the fixture, or
    // the file fails to import (and the whole run fails) everywhere else.
    // See scripts/assert-visual-gate-fails.js for how VISUAL_GATE_LABEL
    // varies this across separate invocations of this same config.
    define: {
      __VISUAL_GATE_LABEL__: JSON.stringify(process.env.VISUAL_GATE_LABEL ?? "Publish"),
    },
    plugins: [
      storybookTest({
        configDir: path.join(dirname, ".storybook"),
        tags: {
          include: [...tags.include],
          exclude: [...(tags.exclude ?? [])],
          skip: [],
        },
      }),
    ],
    test: {
      name: "storybook",
      // axe's color-contrast rule cannot execute in jsdom (see ADR-0004
      // D7) — browser mode via Playwright's Chromium is required, not a
      // performance nicety.
      browser: {
        enabled: true,
        // Pinned so every capture (normal test run, a11y gate, and the
        // visual gate that reuses this same shared config) runs against a
        // deterministic viewport/DPR/motion/theme instead of whatever the
        // host happens to default to.
        provider: playwright({
          contextOptions: {
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 1,
            reducedMotion: "reduce", // ADR-0005: overlays honour prefers-reduced-motion
            colorScheme: "light",
          },
        }),
        headless: true,
        instances: [{ browser: "chromium" }],
      },
    },
  });
}
