---
"@zevaui/components": minor
---

Add `Toast`, the transient notification, and with it the last component of the feedback set.

```tsx
// once, near the application root
<ToastRegion />

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
