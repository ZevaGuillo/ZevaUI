// D5: the Overview's arithmetic, as pure functions over already-serialized
// reports. The page does the I/O (database, manifest, release log, clock) and
// hands everything in; nothing here reads a clock, a file or a connection, so
// every number on the landing screen is unit-testable without any of them.
//
// WHAT THIS MODULE REFUSES TO COMPUTE is as load-bearing as what it does, and
// both come straight from the design's own §7:
//
// - "NOT REPORTING" IS NOT HERE. The design's register band shows a third count
//   -- apps that have never submitted -- and says of it: "The register cannot
//   know about an app that never reported: absence is not a row. Either the
//   panel drops that count, or something commits an expected-consumer roster."
//   No roster exists (registry-tenant-denylist.json is a denylist, not an
//   expected-app list), so the count is DROPPED rather than faked. The register
//   is explicitly opt-in, and `totals.apps` says so by counting only reporters.
//
// - NO "OVERDUE" AND NO EXPIRY COUNTDOWN. The design's glyph set is
//   `current / behind / overdue / silent`. `overdue` needs a deprecation expiry
//   date and `silent` needs the roster above. The component manifest carries no
//   deprecation metadata at all (see panel/deprecated-view.tsx, which refuses
//   the same three fields for the same reason), so this module emits exactly the
//   two states it can derive -- plus `unknown`, which is an absence of a claim
//   rather than a fourth state.

import type { ParsedChangelog } from "../release-log/parse-changelog";
import type { SerializedReport } from "../reports/serialize";
import { computeDeprecatedInUse } from "./deprecated-logic";

// Mirrors packages/audit/scripts/build-report.js:13. A report's `dsVersion` is
// resolved from THIS package and no other, so it is the only release series the
// comparison below may use -- picking any other package's versions would compare
// an app against a number it never reported.
const DS_PACKAGE_NAME = "@zevaui/components";

/**
 * The reported version, as a health claim.
 *
 * `unknown` IS NOT A FAILURE AND MUST NOT RENDER AS ONE. It means the reported
 * version is not a release this log contains, so the panel has no honest answer
 * -- the same shape as `DeprecatedCrossCheck.unavailable` in deprecated-logic.ts.
 */
export type AppHealth =
  | { readonly kind: "current" }
  | { readonly kind: "behind"; readonly releases: number }
  | { readonly kind: "unknown" };

/**
 * The release series to compare against, in the log's own committed order.
 *
 * Returns `[]` rather than falling back to another package when the components
 * package is absent: an empty series makes every app `unknown`, which is the
 * honest reading of "there is nothing to compare against".
 */
export function componentsReleases(packages: readonly ParsedChangelog[]): readonly string[] {
  const entry = packages.find((parsed) => parsed.package === DS_PACKAGE_NAME);
  return entry === undefined ? [] : entry.releases.map((release) => release.version);
}

/**
 * A leading range operator stripped, so a `declared` range can still be placed.
 *
 * The design made this call explicitly and this follows it: "a declared range has
 * no honest answer -- `^0.1.0` may already resolve to 0.2.0. The design renders
 * 'behind 1' with the declared qualifier attached rather than suppressing the
 * estimate." The qualifier is already on screen -- `versions-view.tsx` tones the
 * `declared` source as a warning Badge and the Overview row prints the raw string
 * verbatim -- so the estimate is never presented as a measurement.
 *
 * Two-character operators come FIRST in the alternation. With `[><=]` ahead of
 * `>=`, the class would eat the `>` and leave a stray `=`.
 */
function rangeBase(raw: string): string {
  return raw.trim().replace(/^(?:>=|<=|[\^~=v><])+/, "");
}

/**
 * How many releases have shipped since the one an app reports.
 *
 * AN INDEX LOOKUP IN THE RELEASE LOG, NOT A SEMVER COMPARATOR, and that is the
 * whole design of this function. ADR-0019 P2 settles that semver is compared in
 * TypeScript rather than in SQL, and a comparator is what that implies -- but
 * "behind N" does not ask which version is greater, it asks HOW MANY RELEASES
 * SIT BETWEEN. The release log already answers that: it is built from the
 * committed CHANGELOG.md files (scripts/build-release-log.ts), which `changeset
 * version` writes newest-first, so the position of a version IS the number of
 * releases published after it. Counting positions needs no ordering rules, which
 * means no prerelease precedence to get wrong and no build-metadata edge case.
 *
 * It also makes the failure mode better. A comparator answers for versions that
 * were never released -- `0.5.0` against a newest of `0.4.0` would come out
 * "ahead", a number no one can act on. An index lookup has no answer for a
 * version outside the log, and `unknown` is exactly that: no answer.
 *
 * `indexOf`, not a prefix or `startsWith` test, because `0.1.0` is a prefix of
 * `0.10.0` -- asserted in overview-logic.test.ts rather than trusted here.
 */
export function appHealth(dsVersion: string, releases: readonly string[]): AppHealth {
  const position = releases.indexOf(rangeBase(dsVersion));
  if (position === -1) {
    return { kind: "unknown" };
  }
  return position === 0 ? { kind: "current" } : { kind: "behind", releases: position };
}

/**
 * A report's age, coarse on purpose.
 *
 * COARSE RATHER THAN EXACT, because the panel must not claim a precision it does
 * not have: a report is stamped at SCAN time (`generatedAt`), so its age measures
 * when the consumer last looked, not when its code last changed. Minutes under an
 * hour, hours under a day, days above -- the three buckets the design's wireframe
 * actually shows ("2h ago", "6d ago", "1d ago").
 *
 * `now` IS A PARAMETER, NEVER `Date.now()`. A clock read inside here would make
 * every test time-dependent, and the caller already has to own the clock anyway:
 * these strings are computed on the server and shipped as plain text, which is
 * also what keeps them out of the hydration-mismatch class of bug that
 * `versions-view.tsx` documents for dates.
 *
 * A future `generatedAt` floors to "just now" rather than rendering a negative
 * age. RF-AR03's monotonicity gate stops a report going BACKWARDS per app, but
 * nothing stops a consumer's clock running ahead of this server's.
 */
export function relativeAge(generatedAt: string, now: Date): string {
  const elapsedSeconds = Math.floor((now.getTime() - Date.parse(generatedAt)) / 1000);
  if (elapsedSeconds < 60) {
    return "just now";
  }
  if (elapsedSeconds < 3600) {
    return `${Math.floor(elapsedSeconds / 60)}m ago`;
  }
  if (elapsedSeconds < 86_400) {
    return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  }
  return `${Math.floor(elapsedSeconds / 86_400)}d ago`;
}

export type OverviewApp = {
  readonly repository: string;
  readonly app: string;
  readonly dsVersion: string;
  readonly dsVersionSource: string;
  readonly health: AppHealth;
  readonly deprecatedInUse: number;
  readonly generatedAt: string;
  readonly age: string;
};

export type OverviewGroup = {
  readonly repository: string;
  readonly apps: readonly OverviewApp[];
};

/**
 * The register band's counts.
 *
 * `apps` COUNTS REPORTERS, which is the sentence the design puts under the band:
 * "n = 17 apps reporting. The register is opt-in: apps that never report are
 * counted here and nowhere else." There is no total to be a fraction of.
 *
 * `oldestReportAge` is `null` when nothing has reported -- not "0d ago", which
 * would assert a fresh report that does not exist.
 */
export type RegisterTotals = {
  readonly apps: number;
  readonly repositories: number;
  readonly onLatest: number;
  readonly behind: number;
  readonly unknown: number;
  readonly oldestReportAge: string | null;
};

export type Overview = {
  readonly totals: RegisterTotals;
  readonly groups: readonly OverviewGroup[];
};

export type BuildOverviewInput = {
  readonly reports: readonly SerializedReport[];
  readonly releases: readonly string[];
  readonly deprecatedNames: ReadonlySet<string>;
  readonly now: Date;
};

/**
 * An explicit comparator, never a bare `.sort()`.
 *
 * Sonar's S2871 landed in this repo once already (ADR follow-up on PR #17): a
 * bare sort coerces to string and is only accidentally right. Comparing with
 * `<`/`>` rather than `localeCompare` keeps the order deterministic across
 * locales -- the roster's ordering is part of the contract ("alphabetical and
 * fixed"), so it may not depend on the server's environment.
 */
function byName(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * The whole screen's data, built once.
 *
 * Ordering is ALPHABETICAL AND FIXED, repositories then apps -- the design's
 * rule, and it is a refusal rather than a default: "No sort by debt, no 'worst
 * offenders'." A register that ranks its members has started making an argument,
 * and this screen reports. `/versions` is where ordering is a visitor's choice,
 * and there it travels by URL.
 */
export function buildOverview({
  reports,
  releases,
  deprecatedNames,
  now,
}: BuildOverviewInput): Overview {
  // `Map` rather than an object literal keyed by repository name. A repository
  // name arrives on a consumer's report, so it is arbitrary data, and an object
  // literal answers index lookups for keys nobody set (`{}["constructor"]` is
  // `Object`) -- the exact CRITICAL a review caught in versions-view.tsx.
  const byRepository = new Map<string, OverviewApp[]>();
  const totals = { onLatest: 0, behind: 0, unknown: 0 };
  let oldest: number | null = null;

  for (const report of reports) {
    const health = appHealth(report.dsVersion, releases);
    if (health.kind === "current") totals.onLatest += 1;
    else if (health.kind === "behind") totals.behind += 1;
    else totals.unknown += 1;

    const generatedAtMs = Date.parse(report.generatedAt);
    if (!Number.isNaN(generatedAtMs) && (oldest === null || generatedAtMs < oldest)) {
      oldest = generatedAtMs;
    }

    const entry: OverviewApp = {
      repository: report.repository,
      app: report.app,
      dsVersion: report.dsVersion,
      dsVersionSource: report.dsVersionSource,
      health,
      // The COUNT only. The names and the two-source cross-check are what
      // /deprecated is for; the Overview's owed line states the size of the debt
      // and links onward rather than restating the other screen in one line.
      deprecatedInUse: computeDeprecatedInUse(report.components, deprecatedNames).length,
      generatedAt: report.generatedAt,
      age: relativeAge(report.generatedAt, now),
    };

    const bucket = byRepository.get(report.repository);
    if (bucket === undefined) {
      byRepository.set(report.repository, [entry]);
    } else {
      bucket.push(entry);
    }
  }

  const groups = [...byRepository.entries()]
    .sort(([left], [right]) => byName(left, right))
    .map(([repository, apps]) => ({
      repository,
      apps: [...apps].sort((left, right) => byName(left.app, right.app)),
    }));

  return {
    totals: {
      apps: reports.length,
      repositories: byRepository.size,
      ...totals,
      oldestReportAge: oldest === null ? null : relativeAge(new Date(oldest).toISOString(), now),
    },
    groups,
  };
}
