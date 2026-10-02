// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { Overview, OverviewApp } from "../src/panel/overview-logic";
import { OverviewView } from "../src/panel/overview-view";

afterEach(cleanup);

const app = (overrides: Partial<OverviewApp> = {}): OverviewApp => ({
  repository: "acme/alpha",
  app: "web-alpha",
  dsVersion: "0.4.0",
  dsVersionSource: "installed",
  health: { kind: "current" },
  deprecatedInUse: 0,
  generatedAt: "2026-10-01T10:00:00.000Z",
  age: "2h ago",
  ...overrides,
});

const overview = (
  apps: readonly OverviewApp[],
  totals: Partial<Overview["totals"]> = {},
): Overview => ({
  totals: {
    apps: apps.length,
    repositories: 1,
    onLatest: apps.length,
    behind: 0,
    unknown: 0,
    oldestReportAge: "2h ago",
    ...totals,
  },
  groups: [{ repository: "acme/alpha", apps }],
});

const renderView = (value: Overview) => render(createElement(OverviewView, { overview: value }));

describe("OverviewView: the state is carried three times over", () => {
  // The design's rule, verbatim: "the glyph, the word and the edge colour all
  // carry the state; any one of the three can be removed and the row still
  // reads." So all three must be present and independently assertable -- a row
  // that only coloured its edge would be unreadable in greyscale.
  it("renders a glyph, a word and a data-health attribute per row", () => {
    const { container } = renderView(overview([app({ health: { kind: "current" } })]));
    const row = container.querySelector('[data-health="current"]');
    expect(row).not.toBeNull();
    expect(row?.querySelector("[data-health-glyph]")).not.toBeNull();
    expect(row?.textContent).toContain("current");
  });

  it("states how many releases behind, in the word and not only in the glyph", () => {
    const { container } = renderView(
      overview([app({ health: { kind: "behind", releases: 2 } })], { onLatest: 0, behind: 1 }),
    );
    expect(container.querySelector('[data-health="behind"]')).not.toBeNull();
    expect(container.textContent).toContain("behind 2");
  });

  // `unknown` is an absence of a claim, not a failure -- the same contract
  // deprecated-view.tsx holds for an absent self-report. It must be visibly its
  // own state rather than collapsing into "current" or into "behind".
  it("renders an unknown version as its own state, distinct from current and behind", () => {
    const { container } = renderView(
      overview([app({ dsVersion: "9.9.9", health: { kind: "unknown" } })], {
        onLatest: 0,
        unknown: 1,
      }),
    );
    expect(container.querySelector('[data-health="unknown"]')).not.toBeNull();
    expect(container.querySelector('[data-health="current"]')).toBeNull();
    expect(container.querySelector('[data-health="behind"]')).toBeNull();
  });

  // The word carries the state, so the glyph is decoration -- announcing it
  // would read the state twice, once as a symbol nobody can name.
  it("hides the glyph from assistive technology", () => {
    const { container } = renderView(overview([app()]));
    expect(container.querySelector("[data-health-glyph]")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});

describe("OverviewView: the owed line appears only when something is owed", () => {
  // "An app with no debt has no second line, which is how the design rewards
  // being current without congratulating anyone."
  it("renders no owed line for an app with no deprecated components in use", () => {
    const { container } = renderView(overview([app({ deprecatedInUse: 0 })]));
    expect(container.querySelector("[data-owed]")).toBeNull();
  });

  it("states the size of the debt when there is one", () => {
    const { container } = renderView(overview([app({ deprecatedInUse: 3 })]));
    const owed = container.querySelector("[data-owed]");
    expect(owed).not.toBeNull();
    expect(owed?.textContent).toContain("3 deprecated in use");
  });

  it("agrees with itself in the singular", () => {
    const { container } = renderView(overview([app({ deprecatedInUse: 1 })]));
    expect(container.querySelector("[data-owed]")?.textContent).toContain("1 deprecated in use");
    expect(container.querySelector("[data-owed]")?.textContent).not.toContain(
      "1 deprecated in uses",
    );
  });

  // The three fields the design shows beside a deprecated name -- "expires in
  // 67d", "overdue 12d", "use Menu instead" -- have no source in the manifest.
  // Rendering any of them would mean inventing arithmetic.
  it("never claims an expiry or an overdue countdown", () => {
    const { container } = renderView(overview([app({ deprecatedInUse: 3 })]));
    expect(container.textContent).not.toMatch(/expires|overdue/i);
  });
});

describe("OverviewView: the register band counts only what it can know", () => {
  it("states the apps, the repositories and the oldest report's age", () => {
    const { container } = renderView(
      overview([app(), app({ app: "admin-alpha" })], {
        repositories: 2,
        oldestReportAge: "6d ago",
      }),
    );
    expect(container.textContent).toContain("2 apps");
    expect(container.textContent).toContain("2 repositories");
    expect(container.textContent).toContain("6d ago");
  });

  // The design's third count needs a roster of expected apps, and §7 says so:
  // "Either the panel drops that count, or something commits an
  // expected-consumer roster." No roster exists, so the count is absent rather
  // than rendered as a zero -- a zero would assert that every app reports.
  it("renders no 'not reporting' count, because absence is not a row", () => {
    const { container } = renderView(overview([app()]));
    expect(container.textContent).not.toMatch(/not reporting/i);
  });

  // The band's fills repeat the counts that are already text beside them.
  it("hides the proportion bars from assistive technology", () => {
    const { container } = renderView(overview([app()]));
    const bars = container.querySelectorAll("[data-register-bar]");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) {
      expect(bar.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("says the register is opt-in, so a reader knows what the total is not", () => {
    const { container } = renderView(overview([app()]));
    expect(container.textContent).toMatch(/opt-in/i);
  });
});

describe("OverviewView: the roster", () => {
  // Every group title, not the first: the register band owns a `.group-title`
  // too, so selecting one picks the band's heading and passes on a view that
  // never rendered the roster at all.
  it("heads each group with its repository", () => {
    const { container } = renderView(overview([app()]));
    const titles = [...container.querySelectorAll(".group-title")].map((node) => node.textContent);
    expect(titles).toContain("acme/alpha");
  });

  it("prints the reported version and its source verbatim", () => {
    const { container } = renderView(
      overview([app({ dsVersion: "^0.3.0", dsVersionSource: "declared" })]),
    );
    expect(container.textContent).toContain("^0.3.0");
    expect(container.textContent).toContain("declared");
  });

  // `Table` emits no per-row DOM id (`rowId` reaches TanStack's `getRowId`, and
  // the rendered row is `<tr key=…>` -- React's key is not an attribute), so the
  // design's `/versions#repo:app` fragment has no target. A dead fragment
  // scrolls nowhere, so the row links to the screen it can actually reach.
  it("links each row to /versions, with no fragment it cannot land on", () => {
    const { container } = renderView(overview([app()]));
    const anchor = container.querySelector("a[href]");
    expect(anchor?.getAttribute("href")).toBe("/versions");
  });

  it("gives the row an accessible name that names the app and its state", () => {
    const { container } = renderView(overview([app({ app: "web-alpha" })]));
    const anchor = container.querySelector("a[href]");
    expect(anchor?.textContent).toContain("web-alpha");
    expect(anchor?.textContent).toContain("current");
  });

  it("says nothing has reported rather than rendering an empty register", () => {
    const { container } = render(
      createElement(OverviewView, {
        overview: {
          totals: {
            apps: 0,
            repositories: 0,
            onLatest: 0,
            behind: 0,
            unknown: 0,
            oldestReportAge: null,
          },
          groups: [],
        },
      }),
    );
    expect(container.textContent).toContain("No reports yet.");
  });
});
