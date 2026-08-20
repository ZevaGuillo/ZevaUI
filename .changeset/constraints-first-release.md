---
"@zevaui/constraints": minor
---

First real release of the theme contract validator, which has been shipping
inside the workspace since Stage 3 without ever being versioned.

Exports `validateTheme`, which checks a theme's colors against the declared
contract: every token named by a contrast pair must be present, every value
must parse as a color, and every pair must clear the minimum contrast ratio
declared for that theme id. Violations come back typed and enumerable
(`missing-token`, `invalid-color`, `low-contrast`) instead of as a thrown
error, so a caller can report all of them at once rather than the first.

Versioned now because `@zevaui/mcp` declares `@zevaui/constraints` as a
runtime dependency, not a dev one. Releasing mcp at 0.1.0 while constraints
sat at 0.0.0 would have shipped a dependency on a version that was never
published.
