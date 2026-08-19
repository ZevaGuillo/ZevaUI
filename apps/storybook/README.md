# Storybook: accessibility and visual gates

This package hosts the component stories and the two gates that run against
them in CI: a blocking accessibility scan (ADR-0004) and a screenshot
regression check (ADR-0008). Both run in real Chromium through
`@storybook/addon-vitest`, in a viewport pinned by `vitest.shared.ts`.

The one thing to know before touching anything here: **the committed
screenshot baselines are generated on Linux, by CI, and only by CI.** You
cannot author them on your machine. The procedure below is how you refresh
them.

## Quick path: a visual gate failed on your PR

1. Open the failing CI run and look at the diff attachment. Decide which case
   you are in.
2. **You did not intend a visual change** → you found a real regression. Fix
   the component; do not regenerate baselines.
3. **You did intend it** (a token moved, a component was restyled) → ask a
   maintainer to run the **Visual baselines** workflow against your branch,
   or run it yourself if you have write access:
   - Actions → *Visual baselines* → *Run workflow*
   - `ref` = your branch name
4. The workflow regenerates the PNGs, **verifies them before committing**, and
   pushes one `chore(visual): update screenshot baselines` commit to your
   branch. Pull it, and re-run CI.

If the workflow fails, nothing is pushed. That is by design — read the failing
step rather than re-dispatching.

## Scripts

| Script | What it does |
|---|---|
| `test` | The normal story test run (axe + play functions). No screenshots. |
| `test:visual` | The positive gate: compares the 38 stories against the committed baselines. |
| `test:visual:update` | Regenerates baselines. **CI runs this; you generally should not.** |
| `test:a11y-gate` | Negative fixture proving the axe gate fails on a real violation. |
| `test:visual-gate` | Negative fixture proving the screenshot gate catches a normally-rendered change. |
| `test:visual-overlay-gate` | Negative fixture proving it catches a change inside a **portalled** overlay. |

The three `*-gate` scripts seed their own fixtures at run time, so they work on
any platform, including Windows. Run them locally whenever you touch
`preview.ts` or `vitest.shared.ts`.

## Details

| Topic | Decision |
|---|---|
| Why Linux-only baselines | The reference filename carries a platform suffix (`-chromium-linux` vs `-chromium-win32`), so a locally authored PNG is *invisible* to CI rather than conflicting with it — CI then fails on a missing reference. |
| Why no loose threshold instead | Inter is named in the tokens but never embedded (no `@font-face` in the repo), so another OS re-rasterises every glyph. That dwarfs the ~38px a genuine one-letter regression costs; any threshold loose enough to absorb it would absorb real copy and layout bugs too. |
| What is captured | The pinned viewport, 1200×720 — not the bare story root. React-aria portals `Modal`/`Popover` outside it, so an unmodified element screenshot would silently pass on an empty canvas. See `preview.ts`. |
| Which stories | The 6 component story files carry `tags: ["visual"]` at meta level, so a **new story is covered unless it opts out** with `"!visual"`. The 6 `play`-function stories opt out. |
| Threshold | `allowedMismatchedPixels: 0`, `threshold: 0.1`. The second is pixelmatch's perceived-colour knob (does a pixel differ *at all*), not a count allowance. Loosening either needs an ADR note. |
| The baseline workflow never runs automatically | `workflow_dispatch` only. Re-baselining in response to a red gate would delete the gate. |

## Checklist: changing the capture mechanism

- [ ] `pnpm test:visual-gate` exits 0
- [ ] `pnpm test:visual-overlay-gate` exits 0 (this is the one that proves portalled overlays are inside the frame)
- [ ] `pnpm test:a11y-gate` exits 0
- [ ] `pnpm turbo run test` still green — the capture must stay a no-op in the normal run
- [ ] No `__screenshots__/` or `.vitest-attachments/` debris committed

## Next step

Frame dimensions, the rejected alternatives, and the gaps this gate does *not*
cover (focus rings, dark and high-contrast themes) are recorded in
`docs/adrs/0008-regresion-visual-en-ci-y-linea-base-linux.md`.
