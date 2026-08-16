# @zevaui/constraints

Validates a theme's color tokens against a declared WCAG contrast contract, so a
broken theme fails CI instead of shipping.

## Quick path

1. Install as a dev dependency: `@zevaui/constraints` (workspace package).
2. Call `validateTheme` with a theme's `id` and its resolved `colors`:

   ```ts
   import { validateTheme } from "@zevaui/constraints";

   const result = validateTheme({
     id: "light",
     colors: {
       "color-text-default": "oklch(0.21 0 0)",
       "color-bg-canvas": "oklch(0.98 0 0)",
       // ...every token in the contract's contrastPairs
     },
   });

   if (!result.pass) {
     console.error(result.violations);
   }
   ```

3. `result.pass` is `true` only when every declared pair meets its theme's
   minimum contrast ratio. Otherwise `result.violations` lists each failure
   with both token names and the measured/required ratios.

## Known gap: non-text contrast is not enforced

**WCAG 1.4.11 (Non-text Contrast) is NOT enforced in v1.** The contract only
checks text/background pairs; borders, focus rings, and other UI-component
graphics are not validated.

This is not a hypothetical gap — `color-border-strong` currently fails the
1.4.11 threshold (3.0:1) against the canvas background in both base themes:

| Theme | Measured ratio | Required |
|-------|-----------------|----------|
| light | 2.49:1 | 3.0:1 |
| dark | 2.66:1 | 3.0:1 |

As a result, **RNF-01 (WCAG 2.2 AA) is only partially satisfied**: text
contrast is enforced and verified, non-text contrast is not. Do not represent
this package as a full WCAG 2.2 AA guarantee.

## How contrast is computed

Contrast is computed on colors parsed to linear sRGB, naively clamped to the
sRGB gamut. This is an approximation of the browser's CSS Color 4 gamut
mapping (which uses a perceptual, non-naive algorithm), chosen because it is
deterministic and always errs on the conservative side — it never reports a
higher ratio than the browser would render.

## Fragile pin: high-contrast text-success

The high-contrast theme's `color-text-success` passes its 7.0:1 floor at
**7.09:1 — 1.3% headroom**. Any future change to `green.800` or to the
high-contrast canvas color must re-verify this ratio before merge; a small
shift in either value can regress it below the floor.

## Checklist

- [ ] Every token referenced in `contract.contrastPairs` is present in the
      `colors` you pass to `validateTheme`.
- [ ] `result.pass` is checked, not just `result.violations.length`.
- [ ] You understand this package does not enforce WCAG 1.4.11 non-text
      contrast (see above).

## Next step

See `src/contract.json` for the full list of validated token pairs and
per-theme minimum ratios.
