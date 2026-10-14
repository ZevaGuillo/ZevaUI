---
"@zevaui/components": minor
---

Card gains an optional, additive `shadow` axis; `surface` is unchanged and no existing Card renders
differently.

**Why a second axis and not a third `surface` value.** ADR-0021 recorded this as gap E1: `surface`
is one-of, so a card could own a boundary OR an elevation and never both, while the dashboard
redesign's own E1 panel wanted both. A third value (`outlinedElevated`) would encode the
combination rather than compose it, and would need a fourth the next time either half grew a value.
Two axes multiply where an enum has to be enumerated.

**The axis carries one value (`card`), not `none | card`, and not a boolean.** Two values would emit
two root classes of identical specificity, and which one wins would then rest on Panda's source
order in `dist/styles.css` — an emission detail, not a contract. With one value, absence of the
class is the no-shadow state, which no ordering can reverse. `defaultVariants` deliberately does not
name `shadow`, so every Card that exists today renders byte-identical DOM; `card.test.ts` pins that
directly. A boolean was rejected for a third reason: `shadow` names the token it applies, so a
future second elevation is a new value here rather than a new prop.

`CardShadow` is exported alongside `CardSurface`. This is the only public type addition in the
shadcn visual-language port, and it is additive — a consumer that never passes `shadow` typechecks
and renders exactly as before.
