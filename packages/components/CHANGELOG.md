# @zevaui/components

## 0.3.0

### Minor Changes

- 2fe71a6: `Button` gains two icon slots: `iconStart` and `iconEnd`.

  ```tsx
  <Button iconStart={<SaveIcon />} onPress={save}>
    Save
  </Button>
  ```

  Slots rather than `children` plus a `gap`, because `children` lets the system guarantee neither order nor spacing — `<Button><Icon />Save</Button>` and `<Button>Save<Icon /></Button>` both type-check and mean different things — and a design system that never receives the icon as a value cannot reason about it. This is the rule `Dialog` and `Menu` already follow: the caller supplies content, the system supplies structure.

  The icon is decoration, and that is enforced rather than documented: its wrapper is `aria-hidden`, so an icon carrying its own `<title>` or `aria-label` cannot append a second word to the button's accessible name. That name still comes from `children`, or from `aria-label`. If the icon _is_ the message, put the message in `aria-label`.

  A slot you leave out costs nothing. No wrapper is rendered for `undefined`, `null`, `false` or `""`, so the ordinary conditional spelling `iconStart={isSaving && <Spinner />}` adds no empty box and no stray spacing when the condition is false. `0` still renders a box, because React renders `0` as visible text.

  The gap scales with `size` (`sm`/`md`/`lg` get `0.375`/`0.5`/`0.75` of `spacing.button.px`), derived in the recipe the same way `sm`/`lg` already derive their padding from `md`'s tokens. Worth naming the trade: no `space.button.gap` token exists, so with `className` typed as `never` a consumer cannot retune this gap. If it ever needs to be themeable, that is three tokens across three themes, not one.

  **Two things change for buttons that already exist.** Neither is visible in the common case, and both are consequences of the button now declaring `gap`:

  - A text-only button is a single flex item, so `gap` has no effect on it. But a call site already passing _multiple element children_ — `<Button><span>a</span><span>b</span></Button>` — now gets that gap between them where it had none.
  - `gap` is a declaration this component did not emit before, and it lands in `@layer recipes`. A consumer's own `gap` rule on `.zui-button` from an earlier layer (`reset`, `base`, `tokens`) is now suppressed regardless of its specificity. Unlayered CSS and the `utilities` layer still win. The emitted sheet declares `@layer reset, base, tokens, recipes, utilities`.

  The rendered class string is otherwise untouched: it is byte-identical with and without icons, asserted by comparing the two rather than by re-deriving one.

  Measured cost: `Button` +130 B gzip (13641 → 13771, ceiling 14973); the barrel +132 B.

- 1b8cd68: `Button` gains a `width` axis: `auto` (the default) or `full`.

  A full-width button was not awkward before this — it was impossible. `Button`'s base is `inline-flex`, so it shrink-wraps its label, and this package types `className` and `style` as `never`, leaving a consumer no supported way to stretch one. Measured in a bare consumer app: of the wrappers a consumer might reach for, only `display: grid` stretched a 54px button to its 600px container; `display: block` and both flex spellings left it at 54px. A contract that depends on knowing grid stretches its children, and only grid, is not a contract.

  ```tsx
  <Button width="full" onPress={submit}>
    Save
  </Button>
  ```

  Spelled as an axis rather than a `fullWidth` boolean, to match `Menu`'s existing `width: auto | trigger`. Two components with a width concern should spell it the same way, and an axis has room for a third value that a boolean would have to be deprecated to grow.

  `minor`, not `patch`: this is new public API. Rendered width is unchanged at every existing call site — `auto` is the default and emits `width: auto`, which is what an `inline-flex` button already computed. The emitted output does change in two ways worth naming, though. Every button now carries an extra `zui-button--width_auto` class, so an assertion on the exact class string needs updating. And `auto` places a `width` declaration inside `@layer recipes` where the button previously carried none, so a consumer's own `width` rule in an earlier layer — the emitted sheet declares `@layer reset, base, tokens, recipes, utilities` — is now suppressed regardless of its specificity. Unlayered CSS and the `utilities` layer still win.

  This is the first of the layout affordances that make `className: never` livable rather than merely strict. The reasoning behind keeping that restriction, and what a consumer _can_ still do, is in the README.

- 2c1ffdd: `Checkbox` — the first form control, and the first markable one.

  ```tsx
  <Checkbox isSelected={accepted} onChange={setAccepted}>
    Accept the terms
  </Checkbox>
  ```

  The label is `children` and it is **required**, for the same reason `Input`'s `label` is: a control without a programmatic name fails the blocking accessibility gate, so the type refuses it rather than letting a story catch it later. A checkbox that must carry no visible label — the select-all cell in a table header is the honest case — passes a visually-hidden element. That is a layout decision, not a reason to ship an unnamed control.

  **The third state ships with it.** `isIndeterminate` is what a select-all needs when its group is partly chosen, and it is a real state rather than a styling flag: it sets the native `indeterminate` DOM property, which is what makes assistive tech announce "mixed". No `aria-checked` is involved — react-aria sets none, and adding one would be redundant ARIA over a native control. That last sentence is measured, after an assertion against `aria-checked="mixed"` failed and was corrected.

  The glyph is an SVG path, not a `"✓"` character. A text checkmark renders in whatever font resolves on the consumer's page — the one thing this package cannot control — so it arrives as a different shape, or as a missing-glyph box, depending on what the system substitutes.

  **No new tokens**, following the precedent `Button`'s icon gap set: derive in the recipe, and name the trade where a consumer reads it. The box is `calc({fontSizes.body} * N)` because a checkbox's job is to sit level with the sentence beside it, and tying it to the body size is what keeps that true when a theme changes its type scale. The corner is `radii.input`: a checkbox is a form control, and a consumer who rounds their inputs means to round this too. **The cost is real** — with `className` typed as `never`, you cannot retune the box independently of your body font size. If that ever needs to be themeable, it is tokens across three themes, not one.

  `size` is `sm | md | lg` and scales both the box and its gap to the label, at `0.875` / `1.125` / `1.375` and `0.375` / `0.5` / `0.625` of the body size.

  **A bug caught while writing it, worth naming because Switch and RadioGroup would have inherited it.** react-aria puts every state attribute on the root `<label>` and none on the spans this component renders, so the obvious way to repaint the box is the ancestor-conditioned `[data-selected] &`. That emits `[data-selected] .zui-checkbox__control`, and the attribute is unqualified — **any** ancestor carrying it matches. A `Menu` row under the pointer sets `data-hovered`, and every checkbox inside it would light its border with no pointer near it. Scoping the selector by writing the root class into it trades that for a worse bug: the class name would live in a string no gate checks, so renaming the recipe would silently unstyle the control while `G5` stayed green. So `Checkbox` stamps the states its box needs onto the box itself, off react-aria's render prop, and every rule is a local `&[data-*]`. A test asserts no emitted checkbox rule contains a state attribute that is not attached to a checkbox class.

  **A second bug, this one caught by the review rather than by me, and it is the more interesting of the two.** Specificity, counted on the emitted selectors:

  ```
  .zui-checkbox__control[data-hovered]:not([data-disabled])  -> (0,3,0)
  .zui-checkbox__control[data-invalid]                       -> (0,2,0)
  ```

  A `:not()` argument carries its own weight, so the hover tint outranked the invalid border no matter what order the two rules were written in. The consequence was visible and exactly backwards: **an invalid checkbox lost its red border the moment the pointer touched it** — the one moment the user is looking straight at it. `aria-invalid` never changed, so a screen reader was unaffected and only sighted users lost the signal, which is why nothing else would have caught it.

  The fix excludes invalid from the hover tint rather than inflating the invalid rule to win a specificity arms race. Hovering an invalid control now changes nothing about its border: the error outranks the affordance. Guarded at both altitudes — a unit gate on the emitted selector, and a story that measures `getComputedStyle` on three rendered controls in a real browser. Both were confirmed to fail against the unfixed recipe, in all three themes, rather than assumed to.

  Disabled, read-only, required and invalid are all wired. Invalid paints the box `danger` and is not colour-only: react-aria sets `aria-invalid` on the real input, so the state survives for a user who cannot perceive the change. A single checkbox renders no error text of its own — the message for "you must accept the terms" belongs to the field that groups it, and `CheckboxGroup` does not ship yet.

  Bundle: **+2076 B gzip on the barrel** (57001 → 59077, ceiling 62534), 15913 B imported alone. Measured against `main`, not estimated.

  The ledger in `bundle-budget.json` also catches up four entries that were last recorded before the `width` axis and the icon slots landed — `Card` 673 → 711, `Button` 13611 → 13771, `Dialog` 25666 → 25811, `Menu` 51086 → 51232. Those deltas belong to those changes, not to this one; every entry stays under its ceiling.

- 6a55944: `RadioGroup` — the third markable control, and the first that is a **group** rather than a control.

  ```tsx
  <RadioGroup
    label="How should we contact you?"
    value={channel}
    onChange={setChannel}
    options={[
      { value: "email", label: "Email" },
      { value: "sms", label: "Text message" },
      { value: "none", label: "Do not contact me" },
    ]}
  />
  ```

  **The answers are data, not children.** `options` takes a typed `RadioOptionDescriptor[]`, the same shape `MenuItemDescriptor` uses, and the argument applies harder here. Accepting children would hand the consumer the option element itself — which is structure, not content — and with it every way to break what a radio group depends on: the shared `name`, the one-of-N invariant, the label-to-input association. A typed descriptor keeps the DOM shape fixed and the accessible name mandatory, and it is why this component can honestly type `className` as `never`: there is no part left for a consumer to reach.

  `label` is required, same rule as `Checkbox`, `Switch` and `Input`: a group without a programmatic name fails the blocking accessibility gate, so the type refuses it rather than letting a story catch it later.

  **`isRequired` and `isInvalid` live on the GROUP, and that inverts what the other two markable controls do.** Measured against react-aria-components 1.20, not assumed: `RadioGroupProps` carries both, `AriaRadioProps` carries neither. That is upstream getting it right — a single radio has nothing to be required about, the _question_ does — and it has a consequence worth stating, because it also had to be corrected during implementation after an assertion asserted the opposite: **`aria-invalid` is emitted on the radiogroup and on none of the inputs.** A screen reader announces the problem once on entering the group instead of repeating it on every option the user arrows past. An implementation that stamped it per input would look more thorough and be worse. A story pins it.

  **It is built on `RadioField` + `RadioButton` rather than the flat `Radio`, and the reason is NOT `Switch`'s.** Copying that justification would have been false, so it is named plainly: RAC 1.20 marks the flat `Radio` `@deprecated Use RadioField + RadioButton instead`, but unlike `Switch` there is **no capability gap** here — `RadioProps` and `RadioFieldProps` extend the same `Omit<AriaRadioProps, 'children'>`, and `RadioButtonRenderProps extends RadioRenderProps`. The deprecated component is fully capable. The only cost paid is one extra wrapper element, and the only thing bought is not being deprecated. A future reader comparing the three markable controls deserves to know the two situations were different.

  `size` is `sm | md | lg`. `orientation` is `vertical | horizontal`, defaulting to vertical because a list of answers is read down a column and a horizontal group truncates on a narrow viewport. Horizontal **wraps rather than scrolls**: an answer a user cannot see is an answer they cannot choose. A story measures the laid-out rows, because `flex-wrap: wrap` in the computed style is the input and a second row is the outcome.

  **The state is not colour-only, and the mechanism is this control's own.** A checkbox reveals a glyph, a switch moves its thumb, a radio reveals a dot — each a non-chromatic difference, which is what WCAG 1.4.1 asks for. The dot is scaled to nothing when unselected rather than hidden, so there is one element in the DOM either way and choosing an answer never shifts the row. A story asserts the unselected dot has a **zero box while still being in the document**, which is the claim, rather than asserting a `background-color` that would pass on an invisible element.

  **The dot carries its own `data-selected`**, rather than being reached from the marker's, and the two obvious alternatives were both considered and are both worse. A nested `&[data-selected] .zui-radio-group__dot` would hardcode another slot's class name into a selector string no gate reads — the exact trade `checkbox.recipe.ts` already refuses, because renaming the recipe would then silently unstyle the dot while `G5` stayed green. A recipe _variant_ would make the reveal a group-level class when the state is per-option, which is simply the wrong shape. Stamping the attribute costs a handful of inert bytes and buys a rule that is local, gate-checked and correct per option.

  **Two disabled rules, not one.** Disabling the group dims the whole question, label included — the question is unavailable, not merely its answers. Disabling one option dims only its own row. They compose rather than conflict.

  **The corner is `9999px`, following `Switch` and not `Checkbox`.** `Checkbox` uses `radii.input` because a checkbox _is_ a form control and a consumer who rounds their inputs means to round it too; that argument does not survive the trip, because a radio with a 4px corner is not a radio, it is a small square. This deliberately departs from the component plan, which had called for a `radius.radio` token across three themes — a token no consumer should ever retune. No new tokens ship: every other dimension derives from `fontSizes.body`.

  **The specificity bug review caught on `Checkbox` is guarded here before it could be re-introduced**, identical to `Switch`'s:

  ```
  .zui-radio-group__marker[data-hovered]:not([data-disabled])  -> (0,3,0)
  .zui-radio-group__marker[data-invalid]                       -> (0,2,0)
  ```

  A `:not()` argument carries its own weight, so without the `:not([data-invalid])` guard the hover tint outranks the invalid border regardless of source order, and an invalid group loses its red boundary the moment the pointer touches an option. `aria-invalid` never changes, so only sighted users would lose the signal. Guarded at both altitudes, like the other two: a unit assertion on the emitted selector, and a story that measures `getComputedStyle` on rendered controls in a real browser. That story renders **two groups** rather than three controls in one, and that is forced rather than stylistic — validity is a property of the group here, so "an invalid option beside a valid one" does not exist in this component.

  State attributes are stamped on the marker off RAC's render prop, third time and same reason: a bare `[data-hovered] .zui-radio-group__marker` would match **any** hovered ancestor — a `Menu` row, a `Card` — and light every radio inside it with no pointer near it.

  The keyboard contract is the one thing this control does **not** share with `Checkbox` and `Switch`, which each own a tab stop and toggle on space. A radio group owns **one tab stop for the whole question**; the arrow keys move between answers and select as they go, and they skip a disabled answer rather than stopping on it. Stories cover all three, because a group that gave every option its own tab stop would pass every other check in the file.

  This component renders no error text of its own, matching the other two: the message belongs to the field that groups the control, and no such component ships yet.

  ## Bundle

  **19136 B gzip imported alone** (ceiling 21050), **+2045 B on the barrel** (59928 → 61973, ceiling 62534). Measured, not estimated.

  The interesting number is neither of those, and it is the reason it is written down: **`RadioGroup` is the first markable control that does not mostly ride on its siblings' runtime.** Measured marginal cost, each on top of what a consumer already has:

  | already imported | `Switch` adds | `RadioGroup` adds |
  | ---------------- | ------------- | ----------------- |
  | `Checkbox`       | +786 B        | **+5043 B**       |
  | `Menu`           | +3104 B       | +4109 B           |
  | the whole barrel | +851 B        | +2045 B           |

  `Checkbox` and `Switch` overlap almost entirely — 14797 B of their runtime is shared — so a consumer who has one very nearly gets the other for free. `RadioGroup` shares 14093 B with `Checkbox` and brings **5043 B that neither sibling has**. The cause was not isolated, and is not guessed at here; only the cost is reported.

  **The barrel now has 561 B of headroom under its ceiling**, down from 2606 B. That ceiling is a human decision and is deliberately left untouched by this change — but the next component to land on the barrel will not fit under it, and that is worth knowing before it is discovered by a red gate.

  The ledger also catches up `Card` 710 → 711 B, a one-byte drift that belongs to an earlier change rather than to this one. Every entry stays under its ceiling.

- 59aa293: Add `Select`, the single-choice field, and with it the last component of the forms set.

  It wraps react-aria-components' `Select` + `ListBox`, so it shares Input's label, description and
  validation wiring, and its palette and padding multipliers deliberately: a select that did not line
  up with the input beside it in the same form would be the bug, not the saving. The raised surface
  takes Menu's instead — `shadow-dropdown` over an opaque `bg-surface`, no border, because
  `color-border-strong` measurably fails WCAG 1.4.11 against both backgrounds an overlay can sit on.

  Options are typed descriptors (`value`, `label`, optional `description` and `isDisabled`), never
  children — the same reason `Menu` and `RadioGroup` give: `role="listbox"` only accepts `option`
  children, the collection needs a stable key per row, and the closed trigger derives its text from
  the chosen row. One variant axis, `size` (`sm` | `md` | `lg`), matching Input's. No new tokens.

  Single selection only. react-aria-components 1.20 added a `selectionMode` of `'multiple'`; this
  component does not expose it, so `value` stays a `string` and the trigger always shows one option.

  Two absences are deliberate, and both are upstream rather than choices of taste:

  - **No `isReadOnly`.** react-aria-components spells its own base as `Omit<InputBase, 'isReadOnly'>`.
    `Input`, `Textarea` and `RadioGroup` all ship the prop; there is nothing underneath this one to
    honour it, and a prop that silently does nothing is worse than an absent one.
  - **No `aria-invalid`.** react-aria-components emits it nowhere for a Select, and passing one in
    does not survive its `Button`, whose DOM-prop allowlist carries `data-*` and the labelling ARIA
    attributes but not this one. `Input` and `Textarea` announce the invalid state; **this control
    announces strictly less.** It is accepted rather than worked around for the reason ADR-0006 D3
    accepts its own measured gap: the state is not carried by colour alone — `FieldError` renders
    real text and react-aria wires it into the trigger's `aria-describedby`, so a screen reader user
    still hears what is wrong. The test suite pins the absence, so the day upstream closes it the
    gate says so rather than the gap quietly persisting.

  The selection props are react-aria-components' live spelling, not its deprecated one: `value` /
  `defaultValue` / `onChange`. `selectedKey`, `defaultSelectedKey` and `onSelectionChange` are all
  marked `@deprecated` in 1.20, and none of them reaches this package's public surface.

- 770c8cf: `Switch` — the second markable control, and the first one that could not simply copy the first.

  ```tsx
  <Switch isSelected={notify} onChange={setNotify}>
    Enable notifications
  </Switch>
  ```

  The label is `children` and it is **required**, same rule as `Checkbox` and `Input`: a control without a programmatic name fails the blocking accessibility gate, so the type refuses it rather than letting a story catch it later.

  **It is built on `SwitchField` + `SwitchButton`, not on `Switch`, and that is a correctness decision rather than a preference.** Measured against react-aria-components 1.20, not assumed:

  - The flat `Switch` is marked `@deprecated Use SwitchField + SwitchButton instead`.
  - `SwitchProps` **omits `isRequired`, `isInvalid`, `validate`, `validationState` and `validationBehavior`** from the props it inherits, and `SwitchRenderProps` declares neither `isInvalid` nor `isRequired`.

  So a switch built on the flat component could not have offered the two states `Checkbox` already has. The gap is upstream, not one this package was free to design around. The cost is named rather than hidden: **one extra wrapper element** compared to `Checkbox`, whose root _is_ its label. `Checkbox` still uses the flat (also deprecated) component; aligning it is a separate change, because it would re-render every one of its screenshot baselines.

  `size` is `sm | md | lg`. The track's block size matches `Checkbox`'s box at the same size, so the two sit level in one form; its inline size is twice that, which is what makes it read as a switch rather than as a rounded checkbox.

  **The state is not colour-only, and the mechanism differs from `Checkbox`'s.** A checkbox reveals a glyph; a switch moves its thumb from one end of the track to the other. Position is a non-chromatic difference, which is what WCAG 1.4.1 asks for, and RAC's `role="switch"` means assistive tech announces on/off besides. A story measures the thumb's offset as a fraction of the track in a real browser, so the claim rests on layout rather than on the declaration that produces it.

  **No new tokens**, following `Checkbox` and `Button`'s icon gap: every dimension derives from `fontSizes.body`, because a switch's job is to sit level with the sentence beside it. The one literal is the pill corner. `9999px` is not a themeable design value but the _definition_ of the shape — a switch with a 4px corner is not a switch — and `border-radius` at that length always resolves to half the box height, so a single literal is correct at every size with no per-size artwork. `radii` exposes `button`, `card` and `input` and has no `full`, so the alternative was a `radius.switch` token across three themes that no consumer should ever retune. Dimension literals already have precedent here (`border-width: 1px`, `outline-width: 2px` in the checkbox recipe); only **colour** literals are forbidden.

  The thumb is a circle at every size via `align-self: stretch` + `aspect-ratio: 1`, with no length arithmetic: a fixed size would have to be recomputed per `size` variant and would drift the moment the padding or border changed.

  **Known gap, stated rather than left to be discovered: the thumb does not animate.** It is moved by flipping `justify-content`, which does not transition. Three reasons, in order of weight: a transition mid-capture is a real source of flake in the screenshot gate; nothing else in this package animates, so this would be the first and would arrive without the `prefers-reduced-motion` handling that obligation implies; and the flip is correct at every size with no length arithmetic. Adding motion later is additive and does not change this API.

  **The specificity bug review caught on `Checkbox` is guarded here before it could be re-introduced.** It is identical:

  ```
  .zui-switch__track[data-hovered]:not([data-disabled])  -> (0,3,0)
  .zui-switch__track[data-invalid]                       -> (0,2,0)
  ```

  A `:not()` argument carries its own weight, so without the `:not([data-invalid])` guard the hover tint outranks the invalid border regardless of source order, and an invalid switch loses its red border the moment the pointer touches it — the one moment the user is looking straight at it. `aria-invalid` never changes, so only sighted users would lose the signal. Guarded at both altitudes, like `Checkbox`: a unit assertion on the emitted selector, and a story that measures `getComputedStyle` on three rendered controls in a real browser.

  The same goes for the ancestor-selector trap: state attributes are stamped on the track itself off RAC's render prop, so every rule is a local `&[data-*]`. A bare `[data-hovered] .zui-switch__track` would match **any** hovered ancestor — a `Menu` row, a `Card` — and light every switch inside it. A test asserts no emitted switch rule contains a state attribute that is not attached to a switch class.

  Disabled, read-only, required and invalid are all wired, plus the space-bar keyboard contract. A single switch renders no error text of its own, matching `Checkbox`: that message belongs to the field that groups it.

  Bundle: **+851 B gzip on the barrel** (59077 → 59928, ceiling 62534), 15583 B imported alone. The delta is small because `Switch` shares nearly all of its react-aria runtime with `Checkbox` — a consumer who already has one pays very little for the other. Measured, not estimated.

- 41deff3: Add `Textarea`, the multi-line text field.

  It wraps react-aria-components' `TextField` + `TextArea`, so it shares Input's label, description,
  validation and `for`/`id` wiring — and its palette tokens, deliberately: a textarea that drifted
  from the input beside it in the same form would be the bug, not the saving.

  Two variant axes. `size` (`sm` | `md` | `lg`) matches Input's. `resize` (`vertical` | `none`,
  default `vertical`) exists because `className` is typed `never`: the browser's own default is
  `resize: both`, which lets a user drag the field out of its container, and without a prop there
  would be no way to reach it. `both` is not offered — an axis that ships the broken mode is not a
  guard rail.

  `rows` sets the initial height and is forwarded to the native attribute.

### Patch Changes

- 477364a: Scoped token overrides now actually apply. Until this release they silently did nothing.

  The README's Theming section has always told you to override `--zui-*` "scoped to a selector, a theme class, whatever your app needs". That instruction was wrong for every selector except `:root`:

  ```css
  /* documented, and it did nothing */
  .my-dark-panel {
    --zui-color-accent-default: oklch(0.7 0.15 250);
  }
  ```

  Same for `@zevaui/tokens`'s own `theme-*` classes. Putting `theme-dark` on a `<section>` — a dark panel on an otherwise light page, the ordinary reason anyone reaches for a theme class — left every component inside it painting light. Only `<html>` worked, which is why the package's own theme test never caught it: it asserts at the root.

  **The cause is cascade semantics, not a missing token.** A CSS custom property substitutes its `var()` at the element that _declares_ it, and then inherits already resolved. The component layer bridges each public `--zui-*` into an internal `--zuip-*`, and that bridge was declared once on `:where(:root, :host)`. So every value was resolved against the root's tokens exactly once, and redeclaring `--zui-*` further down the tree could not reach it — the bridge had already been evaluated somewhere the override could not affect.

  The bridge is now declared on `:where(*)`, so every element re-resolves against the `--zui-*` it actually inherits. Measured in Chromium against the two shipped stylesheets: a `subtle` Button inside a nested `.theme-dark` painted identically to one outside it before, and paints the dark surface after.

  **One thing to check if you worked around this.** The unsupported workaround was to override the internal `--zuip-*` instead. That no longer works when set on an ancestor: each element now redeclares `--zuip-*` from its own inherited `--zui-*`, which wins over the inherited value. Switch to the public `--zui-*` name — it is the one that works now, and the names differ (`--zui-color-accent-default`, not `--zuip-colors-accent-default`). Overriding `--zuip-*` was never documented or supported.

  No component, recipe, class name or public prop changes, and no rendering changes for a page that themes at `:root` — which is every page that worked before. The emitted stylesheet is 279 bytes smaller (17523 → 17244; 2685 → 2631 gzipped), because the new selector is shorter than the one it replaces.

  Guarded two ways: `G1` in `css-gates.test.ts` fails if the emitted bridge selector stops matching every element, and the `ThemeContract > AppliesAScopedThemeClass` story asserts in a real browser that a component inside a nested theme class paints differently from one outside it.

## 0.2.2

### Patch Changes

- ca89fd2: Document the step the consumer contract always required and never stated: the page has to paint the canvas.

  Both READMEs told you to install the packages and import the two stylesheets, and stopped there. Importing the custom properties defines them; it paints nothing. Two of them are the page's own — `--zui-color-bg-canvas` and `--zui-color-text-default` — and nothing in either package applies them to `body`.

  The obligation is real, not cosmetic. Component text that sits on the page rather than on a component's own surface — `Input`'s label and description, most visibly — is coloured for `color-bg-canvas`. On a page that never paints it, the browser's white shows through instead, and in the dark theme that text measures **1.05:1 against a 4.5:1 AA floor**. Light and high-contrast appear to survive, but only because the browser's white happens to sit near `color-bg-canvas` in those themes — luck that evaporates the moment a user switches to dark.

  This is exactly the class of defect that only exists outside the monorepo: this repository's own Storybook applies the two declarations in its preview scaffold, so no test here has ever rendered a page without them.

  `@zevaui/components` gains a `Quick path` step, a `The page is yours to paint` section explaining why the split exists — a design system that painted your `body` would be the global reset `G3` fails the build on — and a checklist item. `@zevaui/tokens` gains the same instruction next to its usage snippet, plus the scope of what its contrast guarantees actually cover: theme values applied as intended, not any background a consumer chooses.

  Documentation only. No component, token, or emitted stylesheet changes.

## 0.2.1

### Patch Changes

- f9b3bda: `Card` now declares its own text colour and type tokens instead of inheriting them from the consumer's page.

  `Card` was the only component of the six that declared neither `color` nor `fontFamily` anywhere in its recipe, so its text fell through to whatever the host page happened to set. On a page that sets nothing — which is what the README's Quick Path produces, since it asks only for the two stylesheet imports — that is the User Agent's black, painted on the card's own `bg.surface`. Measured from a bare Vite consumer app against the published 0.2.0 tarballs: **1.18:1 in the dark theme, against a 4.5:1 AA floor**. The light and high-contrast themes passed only by the accident of UA black landing on a light surface.

  `root` now carries `color: text.default` plus the four `body` type tokens, mirroring `Alert` exactly. All five are inherited CSS properties, so the one declaration covers `Card.Header`, `Card.Body`, `Card.Footer` and any zone added later. Re-measured through the same consumer app: **16.98:1 in dark, 17.75:1 in light, 21.00:1 in high-contrast**.

  Card's rendered text changes as a result — it now uses the design system's body font, size, weight and line height rather than the browser's defaults. Consumers who were compensating with their own page-level rules for Card should remove them.

  A new gate, `G11` in `packages/components/__tests__/css-gates.test.ts`, fails any component whose emitted CSS declares no text colour or no font family in its own namespace, so a future component cannot repeat this silently.

## 0.2.0 (2026-08-22)

### Minor Changes

- 34dbdd3: Initial public release of the ZevaUI packages.

  - `@zevaui/tokens` — single source of truth for design tokens, compiled at build time to CSS custom properties, a typed manifest, and per-theme stylesheets (light, dark, high-contrast).
  - `@zevaui/constraints` — the machine-readable design contract plus `validateTheme()`: WCAG 1.4.3 text contrast (4.5:1 / 7.0:1 theme-scoped) and WCAG 1.4.11 non-text contrast (flat 3.0:1) enforced as a blocking gate.
  - `@zevaui/components` — six core React components (Button, Input, Card, Alert, Dialog, Menu) that consume tokens exclusively through CSS custom properties.
  - `@zevaui/mcp` — an MCP server exposing `validate_theme`, so agents and theme editors can reject rule-breaking themes before saving them.

## 0.1.0 (2026-08-21)

### Minor Changes

- aaa965d: Adds a bundle-size budget gate for RNF-02. `pnpm turbo run size` bundles a
  real consumer entry per declared budget entry (esbuild, React/React-DOM
  external), measures its gzip size, and fails naming every entry that
  exceeds its ceiling. Four entries are budgeted: `Card` and `Alert`
  (server-renderable, derived automatically from the registry's
  `clientOnly: false` components), `Button` (representative client entry),
  and the whole barrel — server entries get a +25% ceiling, client and
  barrel entries get +10%, both recorded as admitted assumptions rather than
  measured values.

  The gate is proven with a negative fixture
  (`__fixtures__/budget-over.json` + `scripts/assert-budget-fails.js`, wired
  as `size:gate`) that asserts both an impossible ceiling and a multi-import
  entry are correctly caught, mirroring the existing a11y gate's
  three-branch crash-vs-fail exit handling.

  See `docs/adrs/0007-presupuesto-de-bundle-y-medicion-de-entradas.md` for
  the measured numbers, the admitted-assumption framing of the ceiling
  multipliers, and the documented blind spot: with 4 entries, a `Menu`
  regression is visible only through the barrel ceiling that `Menu` already
  dominates, so a regression up to ~9% of the barrel would currently pass
  undetected.

- 6594595: Adds `Card` and `Alert` to `@zevaui/components`, completing RF-05's
  six-component roster and the first two server-renderable components (no
  `"use client"` directive — see `docs/adrs/0006-card-alert-roster-completo.md`).

  `Card` (`surface`: `elevated` | `outlined`, default `elevated`) is a
  multi-part slot recipe with `Card.Header` / `Card.Body` / `Card.Footer`
  dot-notation parts, composed with `children` — its zones are arbitrary
  content a consumer cannot structurally break, unlike `Dialog`/`Menu`'s typed
  content props.

  `Alert` (`tone`: `danger` | `success` | `warning`, no default, no `info`) is
  a single-part recipe whose role is derived from `tone` (`danger`/`warning`
  get `role="alert"`, `success` gets `role="status"`) rather than taken as a
  prop. Text stays `color-text-default` in every tone — measured against the
  real token values, `{tone}.default` text on `{tone}.subtle` background fails
  WCAG AA in all three tones (3.90 / 2.93 / 1.93 against a 4.5:1 floor); the
  tone color is a non-text accent (the left border) only.

  Same theming model as the rest of the package: no `className`/`style` escape
  hatch (both typed `never`) — theme by overriding `--zui-*` custom
  properties, never by forking.

  See `docs/adrs/0006-card-alert-roster-completo.md` for the composition,
  contrast, and server-rendering decisions behind them.

- ae1c8d1: Adds the first two overlays to `@zevaui/components`. `Dialog` (`size`: `sm` |
  `md` | `lg`, `placement`: `center` | `top`, defaults `md`/`center`) is a modal
  built on React Aria's `ModalOverlay`/`Modal`, with a required `title` and typed
  `description`/`footer`/`children` content slots. `Menu` (`size`: `sm` | `md` |
  `lg`, `width`: `auto` | `trigger`, defaults `md`/`auto`) is a dropdown that owns
  its own trigger and takes its rows as `items: readonly MenuItemDescriptor[]`
  (`id`, `label`, optional `description`, optional `isDisabled`) rather than as
  children — `role="menu"` only accepts `menuitem` children, and react-aria
  derives the menu's accessible name from the trigger, so both stay inside the
  component.

  Neither overlay has a tone or intent axis. Both variant axes on both components
  are purely geometric, because a colored boundary would need
  `color-border-strong`, which measurably fails WCAG 1.4.11 non-text contrast
  (2.49:1 light, 2.66:1 dark, against a 3.0:1 floor). Surfaces are separated by
  `shadow-modal` / `shadow-dropdown` over an opaque `color-bg-surface` instead.

  Same theming model as `Button`, unchanged: no `className`/`style` escape hatch
  (both are typed `never`) — theme by overriding `--zui-*` custom properties,
  never by forking. The dialog scrim carries its translucency in the color
  channel (`color-mix` over `color-bg-inverse`), never in `opacity`, so nothing
  can fade the dialog inside it.

  See `packages/components/README.md` for the prop tables and the theming model,
  and `docs/adrs/0005-overlays-dialog-y-menu.md` for the scrim, surface
  separation, radius and composition decisions behind them.

- 6667ddd: First real release of `@zevaui/components`. Ships `Button` (`visual`:
  `solid` | `subtle` | `danger`, `size`: `sm` | `md` | `lg`, defaults `solid`/
  `md`), built on React Aria for accessible behavior and a PandaCSS-compiled,
  `--zui-*`-only style layer for visuals. No `className`/`style` escape hatch
  — theme by overriding `--zui-*` custom properties, never by forking.

  Ships `dist/styles.css`, `dist/components.manifest.json`, and compiled
  types. See `packages/components/README.md` for the theming model and
  `docs/adrs/0004-storybook-y-la-puerta-de-accesibilidad.md` for the PandaCSS
  posture behind the compiled output.
