---
"@zevaui/tokens": minor
---

Add `space-button-px` and `space-button-py` semantic spacing tokens
(bringing the total to 44), consumed by `@zevaui/components`'s `Button`
recipe. `sm` and `lg` sizes derive from these same two tokens via fixed
ratios in the recipe rather than declaring independent tokens per size, so
the proportional relationship between sizes can't drift out of sync.
