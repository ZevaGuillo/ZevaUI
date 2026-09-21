# @zevaui/components

## 0.3.0

### Minor Changes

- 0dfc272: Add `Avatar`, the first component of the data set.

  ```tsx
  <Avatar name="Ana Beltrán" />
  <Avatar name="Ana Beltrán" src="/people/ana.jpg" size="lg" />
  <Avatar name="Acme Inc" shape="rounded" />
  ```

  Two axes, `size` (`sm` | `md` | `lg`) and `shape` (`circle` | `rounded`). It renders plain elements
  and is server-renderable — no `"use client"`, no react-aria-components, **1,027 B gzipped**.

  ## `name` is one prop doing three jobs

  It is the accessible name, carried on the root as `aria-label`. It is the source of the initials
  drawn when there is no photograph. And being required is what makes an unnamed avatar impossible to
  construct — a `role="img"` with no name announces nothing, which is exactly what the blocking axe
  gate exists to catch.

  The conventional `alt` + `fallback` pair lets all three drift: `alt="Profile photo"` with
  `fallback="AB"` is perfectly typeable, announces the wrong thing, and draws initials belonging to
  nobody.

  ## Staying server-renderable took the design through one refutation

  Every other design system handles a broken avatar with state — an `onError` handler that swaps the
  image for initials — which makes the component client-only. An avatar appears in server-rendered
  lists of people more than almost anything else in this package, so that is a `"use client"`
  boundary per row.

  So the fallback is **always** in the DOM, with the photograph layered over it. The first
  implementation layered an `<img alt="">`, on the reasoning that a source which fails to load paints
  nothing. A story was written to hold that claim in real Chromium, and **the first baseline it
  produced refuted it**: Chromium draws its broken-image glyph in the top-left of the circle, on top
  of the monogram. `alt=""` suppresses the alt _text_, not the indicator.

  The photograph is now a `background-image` on a `<span>`. That has no failure rendering at all —
  and not as an engine behaviour that might change, but because there is no replaced element for a
  user agent to draw a placeholder _for_. It is a stronger guarantee than the one the `<img>` version
  was claiming. A test asserts no `<img>` is rendered, so the refuted shape cannot come back quietly.

  What it costs, stated plainly: no `srcset`, no `sizes`, no `loading="lazy"` and no `decoding` hint,
  because none of those exist for a background. For a box between 28 and 49 CSS pixels that is an
  acceptable trade; for a hero image it would not be.

  ## The `src` is the only caller text in this package that reaches a stylesheet

  So it gets its own escaper, `internal/css-url.ts`, with its own unit tests. It **strips** the four
  characters that could close the quoted `url("…")` — `"`, `\`, CR, LF — rather than escaping them,
  because none of them are valid in a URL to begin with: a real one carries them percent-encoded and
  passes through untouched. `encodeURI` was the obvious alternative and is wrong here, because it
  re-encodes `%` itself and would break every avatar URL behind a CDN or a signing proxy.

  Those tests are units rather than rendered assertions, and that split is load-bearing: jsdom's CSSOM
  refuses to parse a hostile value and leaves the style attribute `null`, so a DOM-level test would
  pass identically for an implementation that escaped correctly and one that emitted nothing at all.

  ## The initials

  Up to two letters, the first of the first word and the first of the last. Two decisions in it are
  forced rather than preferred, both by server rendering:

  - **Iterated by code point, never by index.** A name beginning outside the Basic Multilingual Plane
    is two UTF-16 units, so `name[0]` would hand back half a surrogate pair and the browser would draw
    a replacement glyph. `Intl.Segmenter` would be more correct still and is deliberately not used: it
    would put an ICU-dependent result into server-rendered markup, and an engine whose data differs
    from the browser's produces a hydration mismatch on a component that appears dozens of times per
    page. A slightly wrong monogram is a far cheaper failure.
  - **`toUpperCase()`, not `toLocaleUpperCase()`.** The locale-aware form reads the _host's_ locale,
    which differs between the server that renders and the browser that hydrates — Turkish `i`
    uppercases to `İ` in one and `I` in the other, and React reports the difference as an error.

  ## Contrast

  The initials are `text.default` on `bg.muted`, a pair `@zevaui/constraints` deliberately does not
  gate — `contract.test.ts` asserts by name that no text pair references `color-bg-muted`, because
  widening it would constrain tokens ADR-0020 depends on being free. So this is covered the way
  `Menu`'s hovered row and `Badge`'s `neutral` tone already are: by axe's `color-contrast` rule over
  real stories in real Chromium, in all three themes. Every story that draws initials is load-bearing
  for that reason.

  ## What this unblocks, and what it does not

  `skeleton.recipe.ts` refused a `circle` shape when it shipped, on two grounds: a circle's inline
  size would contradict its `width` axis, and there was no `Avatar` yet, so a diameter scale would
  have to be invented there and matched here — with a page-jump the moment the two drifted.

  The second ground is now closed: `internal/avatar-diameter.ts` owns the one scale, `Avatar` reads it
  rather than restating it, and a test asserts any future `circle` must read the same constant.

  The first still stands, and `skeleton.recipe.ts` now records the analysis and the shape of the
  answer instead of a stale promise. It is left undone deliberately: it restructures the variant axes
  and the public `SkeletonProps` of a component that has already shipped, which is its own change with
  its own changeset rather than a footnote to a new component's.

  The same file's claim that G11 is "a package-wide law, not a rule with exemptions" is also corrected
  there — it stopped being true when `Link` and `Separator` shipped, and someone would otherwise cite
  it.

  ## Bundle cost, measured

  `Avatar` is 1,027 B gzipped on its own, against a ceiling of 1,224 B. The barrel moved from
  85,798 B to **86,400 B** (+602 B) and stays under its 88,004 B ceiling, now with **1,604 B of
  headroom** — down from 2,206 B.

- 4fd0ffa: `Badge`: a short label with a background, and the first component of the feedback set.

  ```tsx
  <Badge>Draft</Badge>
  <Badge tone="danger">Overdue</Badge>
  ```

  One axis, `tone`, with five values — `neutral` (the default), `accent`, `danger`, `success`,
  `warning`. It renders a plain `<span>` and is server-renderable: no `"use client"`, no
  react-aria-components, 522 B gzipped on its own.

  **The tone is a background, never a text colour.** The conventional look — `{tone}.default` text
  on `{tone}.subtle` — was measured against the light theme's real values when `Alert` shipped and
  fails the 4.5:1 AA floor in every tone (danger 3.90, success 2.93, warning 1.93). Badge paints the
  same backgrounds, so it keeps `text.default` in all five tones and a test pins that no tone rule
  declares a text colour at all.

  `@zevaui/constraints` is deliberately **not** extended to cover the two backgrounds Alert never
  used. Its contract gates `color-text-default` over the three tone-`subtle` tokens, and adding
  `color-accent-subtle` / `color-bg-subtle` alongside them would constrain tokens that ADR-0020
  depends on being free — that is what lets a proposed theme carry a brand colour into `accent`
  intact. `neutral` and `accent` are therefore covered the way `Menu`'s hovered row already is: by
  axe's `color-contrast` rule over real stories in real Chromium, in all three themes. Every tone
  ships a story for that reason.

  **`tone` is optional here and required on `Alert`**, which is not an inconsistency: an alert
  without a tone would have its meaning invented for it, while `neutral` asserts nothing.

  **There is no `size` axis, and dimensions are derived rather than tokenised.** Padding, gap and
  type are multiples of `fontSizes.body`, the same trade `Checkbox` documented: with `className`
  typed as `never`, a consumer cannot retune a badge's geometry independently of their body font
  size. The corner is `radius.input` rather than a hardcoded pill, so a theme that rounds its
  controls rounds its badges with them.

  A badge has no ARIA role and announces nothing on its own. Whatever the colour means has to be in
  the text too — `<Badge tone="danger">Overdue</Badge>`, never a bare coloured dot.

- 5a01dfd: Add `Breadcrumb`, closing the navigation set.

  ```tsx
  <Breadcrumb
    items={[
      { id: "home", label: "Home", href: "/" },
      { id: "projects", label: "Projects", href: "/projects" },
    ]}
    current="Alpha release"
  />
  ```

  ## The ancestors and the current page are two separate props

  This is the one design decision worth reading about, because it is not how anyone else models it.

  The conventional shape is a single `items` array whose last entry is implicitly the current page —
  which is how react-aria-components does it, marking that entry `[data-current]`. It also means the
  type permits two states that are always wrong: an ancestor with no `href` (a crumb that goes
  nowhere), and a current page **with** one — a link to the page you are already on, which a screen
  reader announces as a link and a sighted user clicks to no effect. That second one is the single
  most common defect in hand-rolled trails.

  Splitting them makes both unrepresentable. `items` are ancestors and every one requires an `href`;
  `current` is a **string**, because where you are is text, not a link. There is no `href` to give it.
  The position rule disappears along with them: nothing here depends on "the last one is special", so
  nothing can get that wrong. Tests assert the split reaches the DOM rather than stopping at the type.

  `items` may be empty — a top-level page has a trail of exactly one crumb, itself.

  ## It does not use `Breadcrumbs` from react-aria-components

  Every other collection in this package (`Menu`, `Select`, `Tabs`) does, so the departure needs an
  argument. Measured against the installed 1.20 types, `Breadcrumbs` gives four things: an `<ol>`, a
  collection render pipeline, `onAction(key)`, and an `isCurrent` flag on the last item.

  The first is one line of JSX. The third is what `href` already does, better — a real link is
  middle-clickable, copyable, and previewable in the status bar, and `onAction` is none of those. The
  fourth is `index === length - 1`, which the prop split above encodes in the _type_ instead; a rule
  the compiler enforces beats the same rule carried by a data attribute nobody can see.

  Which leaves the collection, and that is the part worth paying for elsewhere and not here. `Menu`
  and `Tabs` need it because they need a keyboard delegate — arrow keys that walk the rows, skip
  disabled ones and wrap. A breadcrumb has no such behaviour: it is a list of links, and Tab already
  walks links.

  **The price is measured, not asserted.** `Tabs` costs 31,730 B gzipped, most of it that machinery.
  `Breadcrumb` costs **12,669 B**, of which 12,141 B is `Link` — so the component itself is 528 B.
  The barrel had 2,206 B of headroom when this landed. Taking the collection would not have fit.

  ## The rest

  **It renders the `<nav>` landmark itself**, which `Breadcrumbs` does not — that one emits only the
  list, leaving the landmark to the caller, and it is the job most callers skip. A landmark is how
  someone navigating by structure jumps to the trail. `label` names it and defaults to "Breadcrumb";
  override it to localise, or to tell two trails on one page apart.

  **The crumbs are this package's own `Link` with `tone="neutral"` and `underline="hover"`** — the
  exact pair `link.recipe.ts` documented as correct in a navigation structure and as a WCAG 1.4.1
  failure inside prose, and the reason that axis exists at all. A trail where every crumb is blue and
  underlined makes the colour carry no information, because nothing in it is _not_ a link.

  **The separator is a real element, not a `::before`.** Generated content is the conventional
  implementation and it is wrong twice: some screen readers announce CSS `content`, and a
  pseudo-element has no node for `aria-hidden` to sit on. This one does, so the trail reads "Home,
  Projects, Alpha release" and never "Home slash Projects slash". It is deliberately left
  **selectable**, which is the opposite of the usual reflex — `user-select: none` makes a copied trail
  read "HomeProjectsAlpha", and the slashes are what make it legible as a path when pasted.

  **The list wraps.** A deep trail in a narrow column has to wrap rather than push the page sideways;
  without it a breadcrumb is the thing that gives a layout a horizontal scrollbar at exactly one
  viewport width, which is a regression a default-width screenshot never catches. There is a baseline
  for it.

  **No variants**, for the reason `Tooltip` established: every axis this package ships answers a
  question a caller genuinely has, and a breadcrumb raises none of them — no hit target to size, no
  container to span, no intent to tone. An axis invented to look like the others is API that can never
  be taken back.

  Collapsing a long trail behind an ellipsis is deliberately not here. It needs a menu of the hidden
  crumbs to stay reachable, which is a composition decision — and `flex-wrap` handles the case that
  actually breaks layouts today.

  ## Bundle cost, measured

  `Breadcrumb` is 12,669 B gzipped on its own, against a ceiling of 13,936 B. The barrel moved from
  85,556 B to **85,798 B** (+242 B — `Link` was already in it) and stays under its 88,004 B ceiling,
  now with **2,206 B of headroom**.

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

- 8fa2f64: `Button` gains a pending state: `isPending` plus a required `pendingLabel`.

  ```tsx
  <Button isPending={isSaving} pendingLabel="Saving" onPress={save}>
    Save
  </Button>
  ```

  This is the state a button is in between a press and the answer, and until now a consumer had
  exactly two ways to spell it, both wrong. `isDisabled` says _you may not do this_ — a judgement
  about permission when the truth is _you already did, wait_ — and it drops the button from the tab
  order, moving a keyboard user's focus to nowhere in the middle of their own action. Swapping the
  label for a spinner in `children` resizes the button under the pointer that just pressed it.

  Pending keeps the button focusable and in the tab order, carries `aria-disabled` so assistive tech
  knows the press will not land, suppresses presses and hover, and downgrades a `type="submit"`
  button to `type="button"` — implicit form submission goes through the browser's own default-button
  lookup, never through the button's press handling, so suppressing the handler alone would not have
  stopped Enter in a text field from submitting.

  **The spinner is rendered by the system, not composed by the caller, and that is forced rather than
  preferred.** The obvious spelling — `iconStart={<Spinner label="Saving" />}` — is silently broken:
  the icon slots are `aria-hidden` by contract, because icons there are decoration, which strips the
  spinner's accessible name and with it the announcement react-aria-components builds on
  `ProgressBarContext`. The button would spin and say nothing. The indicator therefore gets its own
  box that is never hidden, and while pending it takes `iconStart`'s place rather than sitting beside
  it; `iconEnd` is untouched. **If you are currently passing a spinner through `iconStart`, move it to
  `isPending`** — the README's own example of that pattern has been corrected.

  `pendingLabel` is required alongside `isPending` and the compiler enforces it: the two are a
  discriminated union, not two optional props. The reason is the one `Spinner`'s own `label` already
  gives — the indicator is a `role="progressbar"`, a control with no programmatic name fails the
  blocking accessibility gate, and this package refuses to invent one. Passing `isPending` without a
  label no longer type-checks; so does passing `pendingLabel` without `isPending`.

  **That label is also heard on the button itself, which is worth knowing before you write one.** It
  is real text in the accessibility tree — that is what names the indicator — and a button takes its
  accessible name from its own content, so while pending the two combine, indicator first:
  `<Button isPending pendingLabel="Saving">Save</Button>` announces **"Saving Save"**. Measured, not
  assumed, and pinned to that exact string in the test suite. It is the right trade: a screen-reader
  user hears what the control is and that it is busy. Pick a `pendingLabel` that reads as a sentence
  beside your own label — `"Saving"` next to `Save`, not `"Please wait"`.

  Pending deliberately does not borrow the disabled treatment. `[data-disabled]` is dimmed to half
  opacity with a `not-allowed` cursor; `[data-pending]` stays at full strength with `cursor: progress`
  and no opacity change. Dimming would make the two states indistinguishable, which is the confusion
  this state was added to remove. Both hooks are attributes react-aria-components already sets, so the
  class contract of every button that exists today is unchanged — pending is state, not a variant.

  **One cost, measured rather than estimated.** `Button` now imports `Spinner`, moving its bundle
  entry from 13,771 B to 16,643 B gzipped (+2,872 B, +20.9%), and its hand-decided ceiling was raised
  to 18,308 B. `Dialog` (+2,026 B) and `Menu` (+2,003 B) grew too, since both render a `Button`, and
  both stay under their existing ceilings — `Dialog` with 397 B to spare, which is worth knowing
  before the next change that touches `Button`. If you import the barrel the cost is 85 B, because
  `Spinner` was already in it. The whole ledger is in `bundle-budget.json`.

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

- d3edaea: Add `Link` and `Separator`, the two smallest pieces of the navigation set.

  ```tsx
  <p>
    The full list lives in <Link href="/docs/tokens">the token reference</Link>.
  </p>

  <Separator />
  <Separator orientation="vertical" />
  ```

  ## `Link`

  Two axes: `tone` (`accent` by default, or `neutral`) and `underline` (`always` by default, or
  `hover`). It renders a real `<a>` through react-aria-components, 12,141 B gzipped on its own
  against a ceiling of 13,356 B.

  **`href` is required, unlike upstream.** react-aria-components will render a link with no
  destination — an `<a role="link">` driven by `onPress` alone — and that shape is a button wearing a
  link's clothes: no middle-click, no "open in new tab", no status-bar preview, nothing to copy.
  Client-side routing does not need the prop relaxed; react-aria's `RouterProvider` intercepts the
  navigation and hands the `href` to your router, so the markup stays a real link. If there is no URL
  behind the interaction, use `Button`.

  **The default pair is the only one that is unconditionally safe inside a paragraph, and the others
  are not weaker versions of it.** A link distinguished from surrounding text by colour alone fails
  WCAG 1.4.1, which is why `underline: "always"` is the default rather than the opt-in. `tone:
"neutral"` with `underline: "hover"` is deliberately available and deliberately called out: at rest
  it is indistinguishable from the text around it, which is a 1.4.1 failure inside prose and the
  correct treatment in a nav bar or a breadcrumb trail, where position already says what each item
  is. No gate can read which of the two a call site is, so it is documented rather than silently
  allowed.

  **The colour does not move on hover, and that is a contract decision.** `@zevaui/constraints` gates
  `color-text-link` and `color-text-default` against both `color-bg-canvas` and `color-bg-surface` in
  all three themes, so every colour this component can paint is validated at the AA floor — 7.0:1 in
  high-contrast. The conventional hover treatment, darkening to `accent.strong`, would paint a text
  colour the contract does **not** cover, on every link in every paragraph. So the hover affordance is
  the underline instead: it thickens from 1px to 2px when `underline="always"`, and appears when
  `underline="hover"` — on focus as well as on hover, so the affordance is not mouse-only. A test
  pins that no hover rule declares a text colour at all.

  **Disabled uses `text.muted`, not `Button`'s `opacity: 0.5`.** Dimming with opacity composites the
  text against whatever is behind it and drops a colour measured at 4.5:1 to roughly half that —
  acceptable on a button, whose meaning is also carried by its box, and not acceptable on something
  that is nothing but text. `text.muted` is the one dimmed text colour the contract already validates
  against both backgrounds.

  One upstream detail, measured rather than assumed, because the obvious guess is wrong: a disabled
  link is not an `<a>` with its `href` removed. react-aria-components 1.20 renders a
  `<span role="link" aria-disabled="true">` with no `tabindex`, so it leaves the tab order and has
  nothing to navigate to while still announcing itself as a link. If you select links with `a[href]`
  in a stylesheet or a test, a disabled one will not match.

  **It sets no font properties at all** — no family, no size, no weight, no line-height. This is the
  one line that separates its recipe from `Button`'s. A button is a box that sits beside text; a link
  is text that sits inside other text, so fixing its type would make a link in an `<h2>` shrink to
  body size. A test asserts the emitted CSS declares none of them.

  **`target="_blank"` gets `rel="noopener noreferrer"` applied, not documented.** `noopener` is
  already implied by modern browsers; `noreferrer` is the half that is not, and without it the
  destination receives the full URL of the page that linked to it — on an authenticated page, a path
  and a query string handed to a third party. Passing your own `rel` replaces it entirely, because
  `rel="me"` and `rel="license"` on a `_blank` link are both legitimate. `target` itself is narrowed
  to the four browsing-context keywords rather than the `string` the DOM allows.

  ## `Separator`

  One axis, `orientation` (`horizontal` by default, or `vertical`), plus a `decorative` flag. It is
  server-renderable — no `"use client"`, no react-aria-components — and at **438 B gzipped** it is
  now the smallest component in this package.

  **That `clientOnly: false` was won rather than inherited.** react-aria-components ships a
  `Separator`, and using it would have made a 1px line unusable inside a React Server Component: its
  1.20 export does `import 'client-only'`, which is a build-time error there. A plain `<hr>` already
  carries the implicit `role="separator"`, so the upstream component buys a divider nothing it needs
  — and a divider is the single most likely thing to appear in a server-rendered page.

  **It announces itself by default.** A separator's purpose is to say "these two things are
  separate", and `role="separator"` is how that reaches someone navigating by structure instead of by
  sight, for whom the drawn line does not exist at all. `decorative` strips the role, for the case
  where the division is already announced by something else — between two `<section>` elements that
  each carry their own heading, where a second announcement is just noise.

  **`vertical` requires a flex or grid parent**, and this is stated rather than papered over. CSS has
  no cross-axis equivalent of `width: 100%` that works in normal flow: a block element takes its
  width from its container and its height from its content, and a separator has no content. So the
  vertical value uses `align-self: stretch`, which resolves against a flex or grid parent and nothing
  else — outside one it renders with no height and is invisible. The alternative, a hardcoded
  `height`, would be wrong for every row it did not happen to match. A vertical divider lives in a
  toolbar, a breadcrumb trail or a button group, and all three are flex rows already.

  It uses `border.default` rather than the 3:1-gated `border.strong`. WCAG 1.4.11 measures the
  boundary that _identifies_ a user-interface component, and a separator identifies nothing — it has
  no state and nothing to operate, and it divides content that stays legible without it. Reaching for
  `border.strong` would paint a divider heavier than the borders of the real controls around it.

  There is no `children` and no `size` axis. `<hr>` is void content, so a divider with a label in the
  middle of it ("or", "Today") is a different component — it needs a background matching the surface
  behind it to punch through the line, and which surface it sits on is a thing this one cannot know.
  A thicker divider is a section boundary, and a section boundary wants a background change.

  ## Bundle cost, measured

  `Link` is 12,141 B gzipped on its own, `Separator` 438 B. The barrel moved from 82,629 B to
  83,357 B (+728 B) and stays under its existing 88,004 B ceiling. If you import neither, both
  tree-shake out.

- 4bbbb9f: Add `Pagination`.

  ```tsx
  <Pagination page={4} total={20} href={(page) => `/issues?page=${page}`} />
  ```

  ## It is built on links, not on a callback

  The conventional API is `onPageChange(page)`, which makes every page number a button. **A page of
  results has a URL; a button does not.** `?page=3` can be bookmarked, shared, opened in a new tab,
  middle-clicked, previewed in the status bar and reached with the back button, and a click handler is
  none of those. Same reading `Breadcrumb` applies to `onAction`, and the same reason `Link` requires
  an `href`.

  So `href` is a required function of the page number — a function rather than a template string,
  because the shape of a URL belongs to the application: `/issues?page=3`, `/issues/page/3` and
  `/issues#3` are all somebody's scheme, and a `{page}` placeholder would be a tiny templating
  language nobody asked for. Wiring it to a client router costs nothing; react-aria's `RouterProvider`
  intercepts the navigation and hands the `href` to your router.

  The current page is **not** a link. It is plain text carrying `aria-current="page"` — the defect
  `Breadcrumb` restructured its whole API to make unrepresentable.

  ## A gap never hides a single page

  The window is the first page, the last page, and `siblings` pages either side of the current one.
  The naive collapse rule — "a gap wherever consecutive kept pages are more than one apart" — produces
  `1 … 3 4 5 … 20` on page 4, where the leading ellipsis stands in for page **2 alone**. That is
  strictly worse than showing it: same cell width, costs a click, tells the reader less. A gap has to
  hide at least two pages to be worth drawing, so page 4 renders `1 2 3 4 5 … 20`.

  That rule and the clamping below live in `internal/pagination-window.ts` and are unit-tested
  directly rather than through eleven rendered `<li>` elements — a lesson from the `Avatar` change,
  where a DOM-level test of its CSS escaper turned out to prove nothing. The interesting behaviour
  here is arithmetic over edge cases, and asserting it through markup would test the renderer far more
  than the rule.

  ## `page` is clamped, not trusted

  In every real call site it comes from a query string, so `?page=0` and `?page=9999` are _user input_
  rather than caller bugs. A trail that rendered nothing, or one whose `aria-current` pointed at a page
  not in the list, would be a worse answer than one showing the nearest real page. What the request
  does with an out-of-range page is still yours to decide; this decides only what the control looks
  like.

  **A `total` of 1 or less renders nothing at all.** A pagination control for a single page tells the
  reader something they can already see, and costs a landmark in the accessibility tree to say it.

  ## The edge controls, and the choice most libraries make differently

  A disabled "Previous" on page 1 announces as _"Previous page, dimmed"_ — a control offered and then
  withdrawn, on every first page, to everyone using a keyboard or a screen reader. The fact it conveys
  is "you are at the start", and `aria-current="page"` on the first number already says exactly that,
  where the reader is already looking.

  So at a boundary the cell is **reserved visually and left out of the accessibility tree**: the row
  must not shift when you reach either end, but nothing announces a control you cannot use.

  Both live controls are named with words — `previousLabel` / `nextLabel`, defaulting to "Previous
  page" and "Next page" — and the chevron they draw is `aria-hidden`. A link whose only content is `‹`
  computes its accessible name from that character, and "single left-pointing angle quotation mark" is
  not what the control does.

  ## Every cell is the same width

  Page numbers are one, two or three digits, so a row sized to its content reflows the moment you
  paginate past 9 or 99 — and the control you are clicking moves out from under the pointer that just
  clicked it. A `min-inline-size` floor derived from the body type keeps the row still, and there is a
  baseline at three-digit page numbers because that regression is invisible at page 4.

  The list wraps rather than pushing the page sideways, the same declaration `Breadcrumb` leans on.

  No variants — the third recipe here with none. `siblings` changes _what_ is rendered rather than how
  it looks, so it is a prop rather than an axis.

  ## Bundle cost, measured

  `Pagination` is 13,074 B gzipped on its own (ceiling 14,382 B), of which 12,141 B is `Link` — the
  component itself is 933 B, because it uses no react-aria collection. A row of links needs no keyboard
  delegate; Tab already walks links.

  The barrel moved from 86,400 B to **86,914 B** (+514 B) and stays under its 88,004 B ceiling, now
  with **1,090 B of headroom**. `Table` will not fit in that, and should raise the ceiling deliberately
  rather than discover it.

- c207e7b: Add `Progress`, the bar that reports how far along an operation is.

  It wraps react-aria-components' `ProgressBar`, so it publishes `role="progressbar"` with
  `aria-valuenow`/`aria-valuemin`/`aria-valuemax`/`aria-valuetext` and formats the value through
  `Intl.NumberFormat`. `label` is required and visible, for the same reason `Input`'s is: a control
  without a programmatic name fails the blocking accessibility gate.

  `value`, `minValue` and `maxValue` describe the range; `formatOptions` and `valueLabel` describe
  how it reads. The default format is `{ style: "percent" }`, which formats the POSITION IN THE
  RANGE rather than the raw number — so `value={5} maxValue={10}` reads "50%", and `{ style:
"decimal" }` reads "5".

  `isIndeterminate` covers progress of unknown extent: the bar sweeps a partial sliver instead of
  filling, no value text is rendered, and `aria-valuenow` is dropped. The sliver is deliberately
  never the full track, including under `prefers-reduced-motion: reduce` where the sweep is
  cancelled and it parks at the start — a full accent bar would claim the operation had finished.

  One variant axis, `size` (`sm` | `md` | `lg`, default `md`), which sets the track height only. The
  corner reuses `radius.input` rather than introducing a token: body size is `0.875rem`, so the three
  track heights are 3.5px, 5.25px and 7px, and a 4px radius is at least half of every one of them —
  the pill shape falls out of a token this package already bridges.

  Two firsts worth knowing about, because both change what the package does rather than only what it
  looks like:

  - **The fill's width is the package's first inline style.** A percentage that changes on every
    render has no class to hang off, and a static stylesheet cannot name it. It is the only
    declaration in that object, and a test asserts it stays that way.
  - **The package now ships `@keyframes`.** A looping sweep has no pair of states a transition could
    interpolate between. A component declares its keyframes beside its recipe and carries them on its
    registry entry, so `panda.config.ts` derives them the same way it derives recipes and never
    hand-lists one.

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

- 2ef209e: `Skeleton`: a shaped, pulsing placeholder for content that has not arrived yet.

  ```tsx
  <div aria-busy="true">
    <Skeleton shape="heading" width="half" />
    <Skeleton />
    <Skeleton />
    <Skeleton width="wide" />
  </div>
  ```

  Two axes. `shape` — `text` (the default), `heading`, `block` — decides the block extent and the
  corner. `width` — `full` (the default), `wide`, `half`, `narrow` — decides the inline extent as a
  fraction of the container. It renders a plain `<span>` and is server-renderable: no
  `"use client"`, no react-aria-components, 639 B gzipped on its own.

  **The two axes exist because `className` is `never` here.** Every other skeleton library sizes
  itself with a utility class or an arbitrary `width`/`height` prop, and this package exposes
  neither. Fractions rather than lengths, because the consumer owns the container and the design
  system does not: a placeholder pinned at `12rem` is wrong in every column that is not 12rem wide,
  while `half` is right in all of them. The `block` shape goes further and reserves nothing of its
  own — it fills the box the consumer already sized, and its `min-block-size` only decides what
  happens when no box reserved a height at all.

  **There is no `circle` shape, and no `Skeleton` height scale.** A circle is `aspect-ratio: 1` with
  an auto inline size, which is the one property the `width` axis exists to set, so the two axes
  would contradict each other on the same declaration. And `Avatar` does not exist yet: a diameter
  invented here would have to be matched there, and any drift between the two would make the page
  jump at the exact moment the real avatar arrived.

  **It is hidden from assistive technology — `aria-hidden="true"`, always, not overridable.** A
  skeleton is a shape, not a message: it has nothing to read, and it arrives in crowds, so a
  per-element announcement turns one loading state into two dozen. `Progress` already owns
  `role="progressbar"` for work in progress, indeterminate case included. The loading state
  therefore stays the REGION's job — `aria-busy="true"` on the container that is waiting, announced
  once — which every story demonstrates rather than merely documenting.

  **Reduced motion is handled in the recipe, not bolted on.** Under
  `prefers-reduced-motion: reduce` the pulse is cancelled and the box parks at the BRIGHT end, not
  at the dim frame: a permanently faded placeholder reads as disabled content rather than as content
  still arriving. Tests brace-match the media query, so an `animation-name: none` that drifted out
  of it fails rather than passing on a substring. That branch is also what keeps the visual
  baselines deterministic, since the Playwright context pins `reducedMotion: "reduce"`.

  No new design tokens. `bg.muted` is the fill, `radii.input` and `radii.card` are the two corners,
  and every derived dimension is a multiple of the body type metrics — the same derivation `Badge`
  and `Progress` already use. The plan's prediction that a `radius.skeleton` token would be needed
  was checked against the theme files and is false, exactly as the equivalent prediction for the
  markable controls turned out to be.

- 43400aa: Add `Spinner`, the busy indicator for an operation of unknown extent.

  It is built on the same react-aria-components `ProgressBar` primitive as `Progress`, held
  permanently indeterminate — measured, not assumed: RAC 1.20 ships no `Spinner` of its own (only
  `ProgressBar` and `Meter`), and an indeterminate progress bar already publishes exactly the
  contract a busy indicator owes. The root is a `role="progressbar"` with `aria-valuenow` and
  `aria-valuetext` absent, which is the state assistive tech announces as busy with no measurable
  extent.

  There is no `value`, no `minValue`/`maxValue`, no `formatOptions`, and no `isIndeterminate` flag,
  and their absence is the feature: this component cannot be talked into claiming progress it does
  not know about. A caller who has a number wants `Progress`.

  `label` is required, for the same reason `Progress`'s and `Input`'s are: a control without a
  programmatic name fails the blocking accessibility gate. What is new here is that hiding it is a
  real prop. `labelVisibility` (`hidden` | `visible`, default `hidden`) chooses whether the name is
  also drawn, because the spinner people mean is a bare ring in a button, a cell, or the corner of a
  card — and with `className` typed `never` there is no escape hatch to hide it with. The hiding uses
  the clip-rect pattern, never `display: none`: the element is the one `aria-labelledby` points at,
  so removing it from the accessibility tree would leave the spinner unnamed while looking identical
  on screen.

  One more variant axis, `size` (`sm` | `md` | `lg`, default `md`), which sets the ring's outer
  diameter and its stroke. Both are derived from the body type scale rather than fixed in pixels, so
  a spinner beside a line of text scales when a theme changes its type scale. No token was added or
  bridged: the circle is `border-radius: 50%`, which is exact on a square box at any size, and a
  themeable radius token would advertise that a theme may make a spinner less round — which it may
  not. A spinner's roundness is geometry, not a design decision.

  Under `prefers-reduced-motion: reduce` the rotation is cancelled and the ring parks with its accent
  arc at the top. Motion is never the only signal: the role and the required label carry the state
  whether or not anything moves, and a ring with one arc in the accent colour is the loading glyph
  itself rather than an empty box. It is also what keeps the visual baselines deterministic.

  Two things changed outside the new component:

  - **`internal/progress-surface.ts` was extracted.** `Progress` shipped with its root rhythm,
    typography and label declarations inline, which was right while it was the only `ProgressBar` in
    the package. `Spinner` is the second, so the two now read the declarations they genuinely share
    from one module — the same rule `internal/text-surface.ts` was written under when `Textarea`
    joined `Input`. It also carries the measured RAC contract in one written place, including the one
    fact that is easy to get wrong exactly once and impossible to notice: `label` is not a prop on
    `ProgressBar`, so the accessible name has to come from a `<Label>` child.
  - **The registry's `@keyframes` names are now asserted unique.** `panda.config.ts` merges every
    entry's keyframes with `Object.assign`, so two components declaring the same animation name would
    silently overwrite one another. That was unreachable while `Progress` was the only entry with
    keyframes at all; `Spinner` is the second, so the collision became possible in the same change
    that guards against it.

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

- 1f70a10: Add `Table`, closing the data set — and with it `@tanstack/react-table` as this package's second
  runtime dependency.

  ```tsx
  <Table
    caption="Open issues"
    columns={[
      {
        id: "title",
        header: "Title",
        cell: (i) => i.title,
        isRowHeader: true,
        sortable: true,
      },
      {
        id: "comments",
        header: "Comments",
        cell: (i) => i.comments,
        align: "end",
      },
    ]}
    rows={issues}
    rowId={(issue) => issue.id}
    sortHref={(column, direction) => `/issues?sort=${column}&dir=${direction}`}
  />
  ```

  ## Two engine decisions that point in opposite directions

  **It does not use `Table` from react-aria-components.** Measured against the installed 1.20 types:
  RAC's `Table` gives row selection, cell-level keyboard navigation, resizing and drag-and-drop — and
  implements them as `role="grid"`. That role is the part worth stopping on, because the usual framing
  ("the accessible one costs more") is backwards here. A screen reader reads a native `<table>` in its
  **table mode** and a `role="grid"` in its **grid mode**: grid mode is built for a thing you operate
  cell by cell, table mode for a thing you read. For a table you read, native semantics are not the
  cheaper compromise — they are the better answer.

  So every piece of markup is hand-written and native: `<table>`, `<caption>`, `<th scope="col">`,
  `<th scope="row">`, `aria-sort`.

  **It does use TanStack Table, as an internal engine the consumer never sees.** v9 is headless — it
  owns column definitions, row models and state and renders nothing — which is what makes the two
  decisions compatible rather than contradictory.

  **The public API is this package's own.** `TableColumn<Row>` is exported; `ColumnDef`,
  `tableFeatures` and `createColumnHelper` stop inside `Table.tsx`. That is the rule every `.types.ts`
  here states — _hand-picked, never a re-export of another library's prop types_ — and the reason
  react-aria's types never reached `Menu` or `Select` either. A test asserts the shipped `.d.ts` files
  name `@tanstack` nowhere, and a second asserts the built module really does import it, so the first
  cannot pass by the engine having quietly been removed.

  **What it costs, measured rather than sold.** `tableFeatures({})` tree-shakes sorting, filtering,
  pagination and grouping away, and the core still measures **10,808 B gzipped**. For the flat,
  server-sorted table here that buys row identity, a row model and a header model — real machinery,
  but not 10 KB of it. The honest justification is forward-looking: client-side filtering, pagination,
  grouping, column visibility and row selection become configuration rather than a rewrite. If those
  never arrive, this was a bad trade, and that sentence is in the source rather than in nobody's
  memory.

  Sorting is deliberately **not** registered: this component does not sort, it draws an order the
  caller already produced and says which one it is. `rowSortingFeature` would add a measured 2,222 B
  to ship a client-side sort nothing calls.

  ## The markup decisions that matter

  **`isRowHeader` renders `<th scope="row">`** on the column that identifies the record, which is what
  lets a screen reader announce a value _with_ its subject — "Comments, 12, Fix the login redirect" —
  instead of stranding a number with nothing attached. It is the single highest-value markup decision
  in a data table and the one most often skipped, because nothing looks wrong without it.

  **`caption` is required and drawn.** A table with no name announces as "table, 3 columns, 4 rows"
  and nothing else. Drawn rather than hidden for the reason `PopoverProps.title` gives: a hidden name
  is one only assistive technology can check.

  **Sorting is a link**, the same argument `Pagination` makes — a sorted table is a view with an
  address. The heading links to the **next** direction, so clicking the column you are already sorted
  by does something the second time. `aria-sort` carries `none` on sortable-but-unsorted columns and
  is absent entirely on columns that cannot be sorted: the attribute is what says a column is
  sortable, so `none` everywhere would announce a table full of controls that do not exist.

  **The table sits in a focusable, named scroll region.** A table is the one thing in a layout whose
  width comes from its content, so a wide one must scroll inside its own box — and a region that
  scrolls but cannot be focused is unreachable by keyboard (WCAG 2.1.1), while anything focusable
  needs a name and a role for that name to attach to (4.1.2). `aria-labelledby` points at the caption.
  The cost is honest: one extra tab stop per table, including ones narrow enough never to scroll.

  **`rowId` is required** rather than defaulting to the array index, because a table is where that
  default costs most: re-sort and every index changes, so React reuses the wrong DOM node and any
  state inside a cell lands on the wrong record. It is also what the engine keys rows by.

  An empty result set renders its message **inside** the table, spanning the columns, so the row count
  stays honest — a `<tbody>` with no rows and a paragraph beside it announces "0 rows" and then says
  nothing about why.

  ## What this is not

  No row selection, no cell-level keyboard navigation, no column resizing. Those absences are a
  boundary rather than a backlog, and they are documented in the public types rather than left to be
  discovered. A selectable grid is a different component with a different contract; it can be added
  beside this one, but it cannot be bolted on without changing what every existing caller ships.

  No zebra striping and no `density` axis either. Striping needs a second surface colour that reads as
  "still a row" rather than "selected", and the one this package has — `bg.subtle` — is already spent
  on `Menu`'s hover. Density is a real axis that wants a measurement against real data.

  ## Bundle cost

  `Table` is **23,741 B** gzipped on its own (ceiling 26,116 B): 12,141 B of `Link`, 10,808 B of
  TanStack core, and the component itself.

  The barrel moved from 86,914 B to **98,467 B** (+11,553 B). Its ceiling is raised deliberately in
  this change, from 88,004 B to **108,314 B**, by the repo's own rule — `CEILING_MULTIPLIER.barrel`
  is 1.1 in `scripts/check-bundle-budget.js`, the same multiplier that sets a ceiling when any entry
  is first authored. That leaves 9,847 B of headroom, which is what still catches the failure this
  gate exists for: an unintended import of `Link` is 12 KB and of a react-aria collection is 30 KB,
  both comfortably over.

- cec47c0: Add `Tabs`, and with it the first component of the navigation set.

  ```tsx
  <Tabs
    label="Documentation sections"
    tabs={[
      { id: "overview", label: "Overview", content: <Overview /> },
      { id: "api", label: "API", content: <Api /> },
    ]}
  />
  ```

  The strip, the tabs and the panel are all part of the component. You describe the set as data and
  the system renders the structure — the same contract `Menu` and `Select` follow, and the one tabs
  make hardest to get right by hand: `role="tablist"` accepts only `tab` children, each tab's
  `aria-controls` has to point at its own panel, and react-aria needs a stable key per tab. `content`
  is the one field that takes arbitrary markup, because a panel holds whatever your application puts
  in it; the tab's `label` stays a plain string, which is the half that has to stay predictable.

  `label` is **required** and is not drawn. It names the `role="tablist"` for assistive tech, and
  nothing else supplies that: each tab names its own panel, never the set. Two unnamed strips on one
  page are two identical "tab list" announcements.

  **Only the selected panel is in the DOM.** `shouldForceMount` is deliberately not exposed. It would
  keep every panel mounted and inert, which a panel holding a form mid-edit genuinely wants, but
  react-aria's own documentation says inert panels "must be styled appropriately so this is clear to
  the user visually" — so the prop would hand you an axis whose accessibility cost this package would
  then owe you. It can be added against a real case; it cannot be taken back.

  **`onSelectionChange` reports changes, and that is narrower than the upstream callback on
  purpose.** Measured on react-aria 3.51.0 by counting calls: it fires once on mount with the
  initially selected tab, again when you click the tab that is already selected, and once more with
  the _currently_ selected id when you click a **disabled** tab. Three of those four are not a
  selection change. Wire the upstream callback to a router and you get a navigation on page load and
  a duplicate on every re-click. This component gates all three, so `onSelectionChange` is safe to
  hand straight to a router or to analytics with no guard of your own.

  `orientation` moves the strip beside the panel and react-aria swaps the arrow keys to match. It is
  carried as an attribute rather than a class: `Tabs` and `TabList` already publish
  `data-orientation`, so a variant would mint a second encoding of the same fact. The tab elements do
  not get it from upstream — measured in the 1.20 types — so this component stamps it on, which keeps
  every vertical CSS rule local to the tab instead of reaching up through an ancestor selector.

  Disabled tabs are announced as disabled, skipped by the arrow keys, and cannot be selected; a
  disabled _first_ tab does not start selected either. Unlike `Menu`, the flag lives on the tab
  rather than on the collection — react-aria resolves tab disabling with `||` in all three places
  that matter (`useTab`, the keyboard delegate, and the default-selection walk), so the per-tab form
  is complete on its own and the extra indirection buys nothing.

  Selection moves a colour and never a box: every tab reserves its accent edge transparently, so the
  strip cannot reflow under the pointer that just clicked it.

  **Bundle cost, measured.** `Tabs` is 31,730 B gzipped on its own — it pulls in react-aria's
  collection machinery, the same weight class as `Select` and `Menu` — against a hand-decided ceiling
  of 34,896 B. The barrel moved from 80,003 B to 82,629 B (+2,626 B) and stays under its existing
  88,004 B ceiling. If you never import `Tabs`, it tree-shakes out.

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

- 8fa2f64: Add `Toast`, the transient notification, and with it the last component of the feedback set.

  ```tsx
  // once, near the application root
  <ToastRegion />;

  // from anywhere — a submit handler, a router guard, a catch block
  toast.show({ tone: "success", title: "Changes saved" });
  ```

  Two exports for one component, and the split is the design rather than an accident. `toast` is an
  imperative queue that lives at module scope, because the places that need to raise a notification —
  a `catch` block, an interceptor, a route guard — have no React context to read. `ToastRegion` is
  the single mount point those toasts render into. This is the shape react-aria-components was built
  for: `ToastQueue` is a plain class with a `subscribe` method precisely so it can live outside the
  tree.

  `title` and `tone` are both required. `title` because each toast renders as a `role="alertdialog"`
  whose `aria-labelledby` points at it — a toast without one is a dialog with no accessible name, and
  that fails the blocking accessibility gate. `tone` for the reason `Alert`'s is: defaulting would
  silently pick a semantic meaning the caller never stated. The three tones are `Alert`'s, and the
  text colour is `text.default` in all of them — the conventional `{tone}.default` on `{tone}.subtle`
  was measured against the light theme's real values when `Alert` shipped and fails the 4.5:1 AA
  floor in every tone, so the tone is a non-text accent only.

  `timeout` is optional and **omitting it means the toast stays** until dismissed. That is the right
  default for anything a user may need to act on; a message that removes itself on a timer is a
  message someone can miss. When a timeout is set, react-aria pauses it while the region is hovered
  or holds focus, so reading a toast cannot race its own countdown. At most three are visible at once
  — the rest wait in the queue and are promoted as those close.

  `toast.dismiss(key)` closes one by the key `show` returned; `toast.clear()` closes all of them,
  which is what a route change or a sign-out wants.

  **This release narrows the `react-aria-components` dependency from `^1.20.0` to
  `>=1.20.0 <1.22.0`, and that is a deliberate trade you should know about.** Every runtime toast
  export in react-aria-components carries the `UNSTABLE_` prefix — measured in the real type
  definitions of the installed 1.20.0 and of 1.21.1, the newest release, not assumed. Adobe uses that
  prefix for what it says: those names may change or disappear in a minor, which semver would forbid
  for a stable export. Because react-aria-components is a direct dependency here, an open-ended range
  would let a consumer resolve a future minor that dropped them and break an install this package
  never published anything into. The bound closes that. The cost is real and lands on every component,
  not just this one: react-aria-components minor and patch releases no longer arrive on their own and
  have to be taken deliberately. A new gate (`G13`) fails loudly in CI if any of those exports
  vanishes. None of this reaches your code — `toast` and `ToastRegion` are this package's own API and
  neither mentions react-aria-components.

  **Bundle cost, measured.** `ToastRegion` is 21,250 B gzipped on its own, and the barrel moved from
  74,492 B to 80,003 B (+5,511 B); its hand-decided ceiling was raised to 88,004 B. If you never
  import `ToastRegion`, nothing changes for you — the whole component tree-shakes out.

- 7b35cbf: Add `Tooltip` and `Popover`, completing the two anchored overlays of the navigation set.

  ```tsx
  <Tooltip content="Moves the project out of your active list">
    <Button>Archive</Button>
  </Tooltip>

  <Popover label="Filters" title="Filter by status">
    Only issues that are still open are shown in this view.
  </Popover>
  ```

  ## `Tooltip`

  **A tooltip describes; it never names.** react-aria points the trigger's `aria-describedby` at the
  bubble and never its `aria-labelledby`, and that is correct wiring rather than a limitation to work
  around. The consequence is a contract on you, and it is the single most important thing about this
  component:

  > An icon-only button still needs its own `aria-label`. The tooltip is not its name.

  Two independent reasons, both measurable. A description is announced _after_ the name and many
  screen-reader configurations suppress descriptions entirely, so a control whose only name came from
  a tooltip announces as "button" and nothing else. And **a tooltip does not exist on touch** — there
  is no hover, and a tap activates the control instead of revealing the bubble. On a phone,
  information that lives only in a tooltip is information that does not exist. A tooltip may repeat
  or expand on what the interface already says; it may never be the only place something is said.
  `Tooltip.stories.tsx > IconOnlyTrigger` asserts the pair, so this is a gate rather than advice.

  **`children` here is the trigger, not the content,** which inverts what every other component in
  this package does. RF-07 exists so a consumer can never reach the markup, and `Menu` renders its
  own trigger for exactly that reason. A tooltip cannot work that way: it _explains an existing
  control_, so one that rendered its own trigger would be a tooltip you can never attach to the icon
  button that needed one. The concession is narrow — you control one element, handed to react-aria's
  `TooltipTrigger`; nothing about the bubble is reachable.

  The type is honest about what it cannot enforce. `children` is `ReactElement`, not
  `ReactElement<ButtonProps>`: JSX produces `ReactElement<any>`, which is assignable to any narrower
  element type, so the tighter annotation would reject nothing while reading as though it did. It
  must be a `Button` or a `Link` — react-aria wires itself through focus and hover context a plain
  `<button>` does not consume.

  `content` is a plain string. A tooltip that holds markup holds something you may want to select,
  click or read at your own pace, none of which it supports — it disappears the instant the pointer
  leaves.

  **It inverts, and the inversion is the one the contract already validates.** `bg.inverse` with
  `text.inverse` is both the conventional tooltip look and the only inverse text pair
  `@zevaui/constraints` gates, measured in all three themes. The alternative — reusing the surface
  tokens — would produce something visually indistinguishable from a `Menu` you cannot click.

  **No arrow.** `OverlayArrow` would work, and what it costs is a seam: the bubble is separated from
  the page by `shadow.dropdown`, and a shadow follows the bubble's box, not the box plus a triangle
  glued to one edge. Every arrowed tooltip therefore drops the shadow or draws a rotated square that
  must be clipped and re-shadowed per placement — four extra rules for a decoration saying nothing
  the bubble's proximity does not. `Menu`'s popover has no arrow either.

  **No variants at all** — the first recipe in this package with none, and the honest outcome rather
  than a gap. Every axis this package ships answers a question a caller has: how big, how wide, which
  tone. A tooltip has none of those. Its size is its text, its placement is a _behaviour_ react-aria
  may override at paint time, and it carries no intent. Inventing an axis to look like the others
  would be inventing API. A test asserts the base rule still lands with an empty `staticCss` variant
  map, because a Panda that stopped emitting it would ship this component unstyled with nothing else
  noticing.

  `delay` is left at react-aria's own 1500ms warmup, which is deliberately long: a tooltip that fires
  instantly turns a sweep across a toolbar into a sequence of flashes. Keyboard focus is unaffected —
  a focused trigger shows its tooltip immediately, because someone tabbing to a control has already
  committed to it.

  ## `Popover`

  One axis, `size` (`sm` | `md` | `lg`), plus `placement`. It owns its trigger the way `Menu` does,
  and holds a `role="dialog"` the way `Dialog` does.

  **It is non-modal, and that is the whole reason it is not a `Dialog`.** `Dialog` goes through
  `ModalOverlay`, which takes the page out of the accessibility tree and traps focus until it closes.
  This goes through `Popover`, which does neither: the page stays readable and clickable, Escape and
  an outside click dismiss it, and focus returns to the trigger. Use `Dialog` when the answer is
  required before anything else can happen; use this when it is not. A test asserts the panel never
  claims `aria-modal`.

  **It sits at dropdown depth, not modal depth, and the shadow is the only thing saying so.**
  `shadow.modal` means "the page behind this is unavailable" — true of a modal, false here. With no
  borders on any overlay in this package (ADR-0005 D2), depth is the entire vocabulary available for
  that distinction, which is why a test guards it by name.

  **`label` and `title` are two different strings, and both are required.** This is where it diverges
  from `Menu`: react-aria names a `role="menu"` from its trigger, but a `role="dialog"` is named by
  its own heading. So the trigger says what pressing it does ("Filters") and the title says what the
  panel is ("Filter by status"). The title is _drawn_ rather than visually hidden, because a hidden
  name is one only assistive technology can check and this package has no way to tell you yours went
  stale.

  There is no scrim and therefore no `overlay` slot: a popover that dimmed the page would be claiming
  a modality it does not enforce.

  ## Bundle cost, measured

  `Tooltip` is 14,181 B gzipped on its own (ceiling 15,600 B); `Popover` is 32,557 B (ceiling
  35,813 B), which puts it between `Dialog` at 27,836 B and `Menu` at 53,235 B — it pulls in
  react-aria's overlay positioning and dialog machinery but no collection.

  The barrel moved from 83,357 B to **85,556 B** (+2,199 B) against its existing 88,004 B ceiling.
  That leaves **2,448 B of headroom**, the tightest this package has run: the next component that is
  not tree-shaken out of the barrel will need that ceiling raised deliberately rather than by
  accident. If you import neither of these, both tree-shake out.

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
