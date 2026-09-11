---
"@zevaui/components": minor
---

Add `Textarea`, the multi-line text field.

It wraps react-aria-components' `TextField` + `TextArea`, so it shares Input's label, description,
validation and `for`/`id` wiring — and its palette tokens, deliberately: a textarea that drifted
from the input beside it in the same form would be the bug, not the saving.

Two variant axes. `size` (`sm` | `md` | `lg`) matches Input's. `resize` (`vertical` | `none`,
default `vertical`) exists because `className` is typed `never`: the browser's own default is
`resize: both`, which lets a user drag the field out of its container, and without a prop there
would be no way to reach it. `both` is not offered — an axis that ships the broken mode is not a
guard rail.

`rows` sets the initial height and is forwarded to the native attribute.
