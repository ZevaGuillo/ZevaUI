---
"@zevaui/components": patch
---

`Card` now declares its own text colour and type tokens instead of inheriting them from the consumer's page.

`Card` was the only component of the six that declared neither `color` nor `fontFamily` anywhere in its recipe, so its text fell through to whatever the host page happened to set. On a page that sets nothing — which is what the README's Quick Path produces, since it asks only for the two stylesheet imports — that is the User Agent's black, painted on the card's own `bg.surface`. Measured from a bare Vite consumer app against the published 0.2.0 tarballs: **1.18:1 in the dark theme, against a 4.5:1 AA floor**. The light and high-contrast themes passed only by the accident of UA black landing on a light surface.

`root` now carries `color: text.default` plus the four `body` type tokens, mirroring `Alert` exactly. All five are inherited CSS properties, so the one declaration covers `Card.Header`, `Card.Body`, `Card.Footer` and any zone added later. Re-measured through the same consumer app: **16.98:1 in dark, 17.75:1 in light, 21.00:1 in high-contrast**.

Card's rendered text changes as a result — it now uses the design system's body font, size, weight and line height rather than the browser's defaults. Consumers who were compensating with their own page-level rules for Card should remove them.

A new gate, `G11` in `packages/components/__tests__/css-gates.test.ts`, fails any component whose emitted CSS declares no text colour or no font family in its own namespace, so a future component cannot repeat this silently.
