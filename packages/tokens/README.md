# @zevaui/tokens

The single source of truth for ZevaUI's design tokens. Token definitions live
in `tokens/` (primitives plus the `light`, `dark`, and `high-contrast` themes)
and are compiled at build time — never at runtime — into:

- `dist/styles.css` — CSS custom properties (`--zui-*`) for every theme.
- `dist/tokens-<theme>.css` — one stylesheet per theme.
- `dist/tokens.manifest.json` — a typed manifest of every token name, value,
  and type, consumed by `@zevaui/constraints` to validate themes in CI.
- `dist/index.js` / `dist/index.d.ts` — typed token references for TypeScript
  consumers.

## Usage

```css
/* Import the compiled custom properties once, at your app root. */
@import "@zevaui/tokens/styles.css";
```

Components in `@zevaui/components` consume these tokens exclusively through
`var(--zui-*)` references — no literal color, spacing, or radius values.

## Guarantees

Every theme in this package is validated against the machine-readable contract
in `@zevaui/constraints` as a blocking CI gate: WCAG 1.4.3 text contrast
(4.5:1 in light/dark, 7.0:1 in high-contrast) and WCAG 1.4.11 non-text
contrast (flat 3.0:1 across all themes). A token change that breaks either
floor fails the build instead of shipping.

## License

Apache-2.0
