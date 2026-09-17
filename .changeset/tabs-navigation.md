---
"@zevaui/components": minor
---

Add `Tabs`, and with it the first component of the navigation set.

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
the *currently* selected id when you click a **disabled** tab. Three of those four are not a
selection change. Wire the upstream callback to a router and you get a navigation on page load and
a duplicate on every re-click. This component gates all three, so `onSelectionChange` is safe to
hand straight to a router or to analytics with no guard of your own.

`orientation` moves the strip beside the panel and react-aria swaps the arrow keys to match. It is
carried as an attribute rather than a class: `Tabs` and `TabList` already publish
`data-orientation`, so a variant would mint a second encoding of the same fact. The tab elements do
not get it from upstream — measured in the 1.20 types — so this component stamps it on, which keeps
every vertical CSS rule local to the tab instead of reaching up through an ancestor selector.

Disabled tabs are announced as disabled, skipped by the arrow keys, and cannot be selected; a
disabled *first* tab does not start selected either. Unlike `Menu`, the flag lives on the tab
rather than on the collection — react-aria resolves tab disabling with `||` in all three places
that matter (`useTab`, the keyboard delegate, and the default-selection walk), so the per-tab form
is complete on its own and the extra indirection buys nothing.

Selection moves a colour and never a box: every tab reserves its accent edge transparently, so the
strip cannot reflow under the pointer that just clicked it.

**Bundle cost, measured.** `Tabs` is 31,730 B gzipped on its own — it pulls in react-aria's
collection machinery, the same weight class as `Select` and `Menu` — against a hand-decided ceiling
of 34,896 B. The barrel moved from 80,003 B to 82,629 B (+2,626 B) and stays under its existing
88,004 B ceiling. If you never import `Tabs`, it tree-shakes out.
