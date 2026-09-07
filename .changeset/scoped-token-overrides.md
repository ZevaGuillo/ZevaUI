---
"@zevaui/components": patch
---

Scoped token overrides now actually apply. Until this release they silently did nothing.

The README's Theming section has always told you to override `--zui-*` "scoped to a selector, a theme class, whatever your app needs". That instruction was wrong for every selector except `:root`:

```css
/* documented, and it did nothing */
.my-dark-panel { --zui-color-accent-default: oklch(0.7 0.15 250); }
```

Same for `@zevaui/tokens`'s own `theme-*` classes. Putting `theme-dark` on a `<section>` — a dark panel on an otherwise light page, the ordinary reason anyone reaches for a theme class — left every component inside it painting light. Only `<html>` worked, which is why the package's own theme test never caught it: it asserts at the root.

**The cause is cascade semantics, not a missing token.** A CSS custom property substitutes its `var()` at the element that *declares* it, and then inherits already resolved. The component layer bridges each public `--zui-*` into an internal `--zuip-*`, and that bridge was declared once on `:where(:root, :host)`. So every value was resolved against the root's tokens exactly once, and redeclaring `--zui-*` further down the tree could not reach it — the bridge had already been evaluated somewhere the override could not affect.

The bridge is now declared on `:where(*)`, so every element re-resolves against the `--zui-*` it actually inherits. Measured in Chromium against the two shipped stylesheets: a `subtle` Button inside a nested `.theme-dark` painted identically to one outside it before, and paints the dark surface after.

**One thing to check if you worked around this.** The unsupported workaround was to override the internal `--zuip-*` instead. That no longer works when set on an ancestor: each element now redeclares `--zuip-*` from its own inherited `--zui-*`, which wins over the inherited value. Switch to the public `--zui-*` name — it is the one that works now, and the names differ (`--zui-color-accent-default`, not `--zuip-colors-accent-default`). Overriding `--zuip-*` was never documented or supported.

No component, recipe, class name or public prop changes, and no rendering changes for a page that themes at `:root` — which is every page that worked before. The emitted stylesheet is 279 bytes smaller (17523 → 17244; 2685 → 2631 gzipped), because the new selector is shorter than the one it replaces.

Guarded two ways: `G1` in `css-gates.test.ts` fails if the emitted bridge selector stops matching every element, and the `ThemeContract > AppliesAScopedThemeClass` story asserts in a real browser that a component inside a nested theme class paints differently from one outside it.
