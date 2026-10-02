import { describe, expect, it } from "vitest";
import {
  appHealth,
  buildOverview,
  componentsReleases,
  relativeAge,
} from "../src/panel/overview-logic";

const NOW = new Date("2026-10-01T12:00:00.000Z");

// The release log's own committed order, newest first -- what
// scripts/build-release-log.ts writes and what `appHealth` counts against.
const RELEASES = ["0.4.0", "0.3.0", "0.2.0", "0.1.0"];

const report = (
  overrides: Partial<Parameters<typeof buildOverview>[0]["reports"][number]> = {},
) => ({
  repository: "acme/alpha",
  app: "web-alpha",
  dsVersion: "0.4.0",
  dsVersionSource: "installed",
  components: ["Button"],
  deprecatedComponents: null,
  generatedAt: "2026-10-01T10:00:00.000Z",
  ...overrides,
});

describe("componentsReleases (the comparison source is @zevaui/components, not any package)", () => {
  it("picks the design system package's versions in the log's own order", () => {
    expect(
      componentsReleases([
        { package: "@zevaui/tokens", releases: [{ version: "9.9.9", changes: [] }] },
        {
          package: "@zevaui/components",
          releases: [
            { version: "0.4.0", changes: [] },
            { version: "0.3.0", changes: [] },
          ],
        },
      ]),
    ).toEqual(["0.4.0", "0.3.0"]);
  });

  it("is empty when the log carries no components package, rather than falling back to another", () => {
    expect(
      componentsReleases([
        { package: "@zevaui/tokens", releases: [{ version: "9.9.9", changes: [] }] },
      ]),
    ).toEqual([]);
  });
});

describe("appHealth (RF-AP01: derived from the release log, never invented)", () => {
  it("reads the newest release as current", () => {
    expect(appHealth("0.4.0", RELEASES)).toEqual({ kind: "current" });
  });

  it("counts the releases published since the reported one", () => {
    expect(appHealth("0.3.0", RELEASES)).toEqual({ kind: "behind", releases: 1 });
    expect(appHealth("0.2.0", RELEASES)).toEqual({ kind: "behind", releases: 2 });
    expect(appHealth("0.1.0", RELEASES)).toEqual({ kind: "behind", releases: 3 });
  });

  it("resolves a declared range to its base version rather than suppressing the estimate", () => {
    expect(appHealth("^0.3.0", RELEASES)).toEqual({ kind: "behind", releases: 1 });
    expect(appHealth("~0.2.0", RELEASES)).toEqual({ kind: "behind", releases: 2 });
    expect(appHealth(">=0.1.0", RELEASES)).toEqual({ kind: "behind", releases: 3 });
    expect(appHealth("v0.4.0", RELEASES)).toEqual({ kind: "current" });
  });

  it("refuses to guess a version the release log does not contain", () => {
    expect(appHealth("0.5.0", RELEASES)).toEqual({ kind: "unknown" });
    expect(appHealth("0.4.0-beta.1", RELEASES)).toEqual({ kind: "unknown" });
    expect(appHealth("not-a-version", RELEASES)).toEqual({ kind: "unknown" });
  });

  it("is unknown when there is no release log to compare against", () => {
    expect(appHealth("0.4.0", [])).toEqual({ kind: "unknown" });
  });

  // The whole reason this is an index lookup over the log's committed order and
  // not a string comparison: "0.1.0" is a prefix of "0.10.0".
  it("does not confuse a version with one that merely starts with it", () => {
    expect(appHealth("0.1.0", ["0.10.0", "0.1.0"])).toEqual({ kind: "behind", releases: 1 });
    expect(appHealth("0.10.0", ["0.10.0", "0.1.0"])).toEqual({ kind: "current" });
  });
});

describe("relativeAge (coarse by design -- the panel never claims a precision it lacks)", () => {
  it("reads minutes under the hour, hours under the day, days above it", () => {
    expect(relativeAge("2026-10-01T11:40:00.000Z", NOW)).toBe("20m ago");
    expect(relativeAge("2026-10-01T10:00:00.000Z", NOW)).toBe("2h ago");
    expect(relativeAge("2026-09-25T12:00:00.000Z", NOW)).toBe("6d ago");
  });

  it("never renders a negative age for a report stamped in the future", () => {
    expect(relativeAge("2026-10-02T12:00:00.000Z", NOW)).toBe("just now");
  });

  it("is 'just now' under a minute rather than '0m ago'", () => {
    expect(relativeAge("2026-10-01T11:59:30.000Z", NOW)).toBe("just now");
  });
});

describe("buildOverview (the register's totals and the roster, as one value)", () => {
  it("counts apps, repositories and health buckets", () => {
    const { totals } = buildOverview({
      reports: [
        report({ repository: "acme/alpha", app: "web-alpha", dsVersion: "0.4.0" }),
        report({ repository: "acme/alpha", app: "admin-alpha", dsVersion: "0.3.0" }),
        report({ repository: "acme/beta", app: "web-beta", dsVersion: "0.2.0" }),
        report({ repository: "acme/beta", app: "pay-beta", dsVersion: "9.9.9" }),
      ],
      releases: RELEASES,
      deprecatedNames: new Set<string>(),
      now: NOW,
    });

    expect(totals.apps).toBe(4);
    expect(totals.repositories).toBe(2);
    expect(totals.onLatest).toBe(1);
    expect(totals.behind).toBe(2);
    expect(totals.unknown).toBe(1);
  });

  it("reports the oldest report's age, not the newest", () => {
    const { totals } = buildOverview({
      reports: [
        report({ app: "a", generatedAt: "2026-10-01T10:00:00.000Z" }),
        report({ app: "b", generatedAt: "2026-09-25T12:00:00.000Z" }),
      ],
      releases: RELEASES,
      deprecatedNames: new Set<string>(),
      now: NOW,
    });
    expect(totals.oldestReportAge).toBe("6d ago");
  });

  it("has no oldest age at all when nothing has reported", () => {
    const { totals, groups } = buildOverview({
      reports: [],
      releases: RELEASES,
      deprecatedNames: new Set<string>(),
      now: NOW,
    });
    expect(totals.apps).toBe(0);
    expect(totals.oldestReportAge).toBeNull();
    expect(groups).toEqual([]);
  });

  // ADR-0011's ordering rule, and the design's: alphabetical and fixed. No sort
  // by debt, no "worst offenders" -- the roster is a register, not a ranking.
  it("orders repositories and their apps alphabetically, never by debt", () => {
    const { groups } = buildOverview({
      reports: [
        report({ repository: "acme/beta", app: "web-beta", dsVersion: "0.1.0" }),
        report({ repository: "acme/alpha", app: "web-alpha", dsVersion: "0.4.0" }),
        report({ repository: "acme/alpha", app: "admin-alpha", dsVersion: "0.4.0" }),
      ],
      releases: RELEASES,
      deprecatedNames: new Set<string>(),
      now: NOW,
    });

    expect(groups.map((group) => group.repository)).toEqual(["acme/alpha", "acme/beta"]);
    expect(groups[0].apps.map((entry) => entry.app)).toEqual(["admin-alpha", "web-alpha"]);
  });

  it("carries the deprecated-in-use count per app, intersected from the manifest", () => {
    const { groups } = buildOverview({
      reports: [
        report({ app: "web-alpha", components: ["Button", "OldMenu", "OldTabs"] }),
        report({ app: "admin-alpha", components: ["Button"] }),
      ],
      releases: RELEASES,
      deprecatedNames: new Set(["OldMenu", "OldTabs"]),
      now: NOW,
    });

    const byApp = new Map(groups[0].apps.map((entry) => [entry.app, entry]));
    expect(byApp.get("web-alpha")?.deprecatedInUse).toBe(2);
    expect(byApp.get("admin-alpha")?.deprecatedInUse).toBe(0);
  });

  it("keeps each app's reported version and source verbatim for the row to render", () => {
    const { groups } = buildOverview({
      reports: [report({ dsVersion: "^0.3.0", dsVersionSource: "declared" })],
      releases: RELEASES,
      deprecatedNames: new Set<string>(),
      now: NOW,
    });

    const entry = groups[0].apps[0];
    expect(entry.dsVersion).toBe("^0.3.0");
    expect(entry.dsVersionSource).toBe("declared");
    expect(entry.health).toEqual({ kind: "behind", releases: 1 });
    expect(entry.age).toBe("2h ago");
  });
});
