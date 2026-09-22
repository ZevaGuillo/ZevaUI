import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { themeIds } from "@zevaui/tokens";
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
function storybookProject(tags: TagFilter, theme: (typeof themeIds)[number], name: string) {
  return {
    // Every config here imports every story file under stories/**, including
    // stories/__gate__/BrokenVisual.stories.tsx, to discover their tags —
    // regardless of whether any of its own stories match the tag filter
    // below. __VISUAL_GATE_LABEL__ must therefore be unconditional and
    // defaulted, not only present on the one config that actually exercises
    // the fixture, or the file fails to import (and the whole run fails)
    // everywhere else. See scripts/assert-visual-gate-fails.js for how
    // VISUAL_GATE_LABEL varies this across separate invocations of this
    // same config.
    //
    // __VISUAL_CAPTURE__ gates preview.ts's screenshot afterEach on the RUN
    // (this config's own tags.include), not on a story's own tags: `visual`
    // and `test` are not mutually exclusive — the 6 real story files carry
    // BOTH — so a story-level tag can never tell the hook which config is
    // executing it. Resolved once here, at config-load time, so the normal
    // `test` run and the a11y gate both bake in `false` and the hook is a
    // true no-op there regardless of which tags an individual story has.
    //
    // The prefix test is deliberate, not lazy matching. An exact list would
    // have to be extended by hand for every new visual partition, and the
    // cost of forgetting is asymmetric: a visual config that resolves
    // `false` here runs its stories with NO screenshot assertion at all and
    // exits 0 — a silent false PASS, the exact failure this whole design
    // exists to prevent. Prefixing fails closed in the safe direction (a
    // new `visual*` partition captures by default), while `test` and
    // `a11y-negative` still resolve `false`.
    //
    // __STORY_THEME__ follows the same config-load-time pattern: each vitest
    // project bakes in the theme id whose `.theme-*` class preview.ts's
    // decorator must apply (via `initialGlobals`), so the themed matrix
    // below runs every story once per theme. `storybook dev` has no define,
    // and preview.ts falls back to light there.
    define: {
      __VISUAL_GATE_LABEL__: JSON.stringify(process.env.VISUAL_GATE_LABEL ?? "Publish"),
      __VISUAL_CAPTURE__: JSON.stringify(tags.include.some((tag) => tag.startsWith("visual"))),
      __STORY_THEME__: JSON.stringify(theme),
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
      // ONE DEPENDENCY CACHE PER PROJECT. A BUG FIX, NOT A TUNING KNOB — AND IT HAS TO BE A PLUGIN.
      //
      // The theme projects below are identical Vite configs apart from `define` and `test.name`,
      // and they all resolved to the SAME dependency cache. The cause is upstream and was read in
      // `@storybook/addon-vitest`'s own dist rather than guessed at:
      //
      //   let projectId = oneWayHash(finalOptions.configDir);
      //   cacheDir: resolvePathInStorybookCache("sb-vitest", projectId);
      //
      // The id is a hash of `configDir` and NOTHING ELSE, so the addon assumes one Vitest project
      // per Storybook config directory. This file deliberately runs three against one.
      //
      // ONE DESTINATION, THREE WRITERS, AND THE RESULT IS A HANG RATHER THAN A FAILURE. Each
      // project starts its own Vite dependency optimizer, each builds `deps_temp_<hash>`, and each
      // renames it onto `deps`. On Windows, renaming over a directory another process holds open
      // fails with EPERM and leaves `deps` PARTIAL — which surfaces as `does not provide an export
      // named <x>` for whichever module got truncated. Every story file then throws at import time
      // and the browser provider waits forever. Measured on disk: one `sb-vitest/deps` with two
      // orphaned `deps_temp_*` beside it.
      //
      // The tell that it is infrastructure and not a component is that an ENTIRE project fails
      // while its siblings pass — Alert, Button and Table included, green for weeks. It has now
      // surfaced three times in three disguises (`aria-query` missing `elementRoles`, `expect-type`
      // missing `expectTypeOf`, and the bare EPERM), which is why it is fixed here rather than
      // re-run until it passes.
      //
      // IT MUST SIT AFTER `storybookTest` AND SET `cacheDir` FROM A `config` HOOK. A plain
      // top-level `cacheDir` on this object does not survive: the addon returns its own partial
      // from its `config` hook, and Vite merges a plugin's return ON TOP of the user's config.
      // That was measured too — the top-level spelling was tried first and no per-project
      // directory was ever created. A later plugin's `config` return merges over an earlier one's,
      // so this wins.
      //
      // Disjoint caches cost three pre-bundles of disk and no wall time: the three optimizers
      // already ran in parallel, they were only fighting over one output. This also separates the
      // visual configs' cache from the themed run's, which collided for the same reason.
      {
        name: "zevaui:per-project-vitest-cache",
        config: () => ({
          cacheDir: path.join(dirname, "node_modules/.cache/vitest", name),
        }),
      },
    ],
    test: {
      name,
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
        instances: [{ browser: "chromium" as const }],
      },
    },
  };
}

// Single light-theme run, unchanged shape — the visual configs keep using
// this: baselines are captured in light only (regenerated on Linux via
// workflow), so the theme matrix must not multiply their captures.
export function createStorybookVitestConfig(tags: TagFilter) {
  return defineConfig(storybookProject(tags, "light", "storybook"));
}

// One vitest project per theme id from @zevaui/tokens: every matching story
// runs (and is axe-scanned, via `a11y: { test: "error" }` in preview.ts)
// once under light, dark, and high-contrast. Used by the normal `test` run
// and the a11y gate; roughly triples their wall time by design (ADR-0006
// noted the gate only covered the light theme).
export function createThemedStorybookVitestConfig(tags: TagFilter) {
  return defineConfig({
    test: {
      projects: themeIds.map((theme) => storybookProject(tags, theme, `storybook-${theme}`)),
    },
  });
}
