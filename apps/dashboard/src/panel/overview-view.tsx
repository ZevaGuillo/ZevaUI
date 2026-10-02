// D5: the Overview landing screen -- the register's own totals, then the app
// roster grouped by repository. RF-AP01 scenario 1, and the arithmetic behind
// every number here is in panel/overview-logic.ts rather than in this file.
//
// NO "use client", same as deprecated-view.tsx and for the same reason: `Card`
// is `clientOnly: false` and carries no directive, so composing it keeps this a
// server component that ships no JavaScript at all. `versions-view.tsx` is the
// exception rather than the rule -- it is a client component only because
// `Table` is, and because its column descriptors carry `cell` functions that
// cannot cross the RSC boundary.
//
// THE ROW IS A NATIVE `<a>`, NOT THE LIBRARY'S `Link`, and that is composition
// rather than a shortcut. `Link` is an inline-TEXT primitive: it is sealed (no
// `className`, no `style`), it mints an underline offset and a link colour, and
// it is `"use client"`. Applied to a whole row it would underline and recolour
// every field in it, pull the screen's one JavaScript bundle in for a
// destination that needs none, and still leave no way to attach the hover
// elevation the design asks for. The library ships no row-level destination and
// no layout primitive (globals.css says so about Stack/Grid/Box), so the row's
// geometry and its two affordances -- hover elevation, focus ring -- are the
// app's own CSS over a plain anchor. That is the same line the rest of this
// panel draws: compose what the library ships, hand-roll only what it does not,
// and never replicate what it does.
import { Card } from "@zevaui/components";
import type { AppHealth, Overview, OverviewApp } from "./overview-logic";

/**
 * The glyph per state.
 *
 * DECORATION, AND THE TESTS PIN IT AS SUCH (`aria-hidden`). The design's rule is
 * that "the glyph, the word and the edge colour all carry the state; any one of
 * the three can be removed and the row still reads" -- so the glyph is the third
 * carrier, not the first. A reader who cannot see it still gets the word, and a
 * reader who cannot distinguish the edge colour still gets both.
 *
 * TWO ENTRIES, NOT THE DESIGN'S FOUR. `overdue` needs a deprecation expiry date
 * and `silent` needs a roster of expected apps; neither exists (see the header
 * of overview-logic.ts). `unknown` takes a dash rather than a fourth symbol,
 * because it is the absence of a claim and a symbol would make it look like one.
 */
const HEALTH_GLYPH: Record<AppHealth["kind"], string> = {
  current: "●",
  behind: "▲",
  unknown: "—",
};

/**
 * The state as a word -- the carrier that survives greyscale, a screen reader
 * and a printout, so it is the one that may never be omitted.
 */
function healthWord(health: AppHealth): string {
  if (health.kind === "behind") {
    return `behind ${health.releases}`;
  }
  if (health.kind === "unknown") {
    return "version not in the release log";
  }
  return "current";
}

/**
 * BOTH FORMS PASSED IN, never a trailing `s` appended to a singular. English
 * plurals are not a suffix rule -- "repository" becomes "repositories" -- and a
 * helper that appends `s` either prints "repositorys" or grows a patch to undo
 * itself at the call site. Two words cost nothing and cannot be wrong.
 */
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * One count in the register band.
 *
 * The WIDTH IS DATA, which is why it is an inline style rather than a class: it
 * is a share of the reporting apps, recomputed on every render, so a stylesheet
 * has nothing to say about it. Everything else about the bar -- its track, its
 * height, its fill colour -- is keyed off `data-register-bucket` in globals.css.
 *
 * `aria-hidden` on the bar, because the number it encodes is already text
 * directly beside it. Announcing both reads the same fact twice, the second time
 * as a shape.
 */
function RegisterCount({
  bucket,
  count,
  label,
  share,
}: {
  readonly bucket: string;
  readonly count: number;
  readonly label: string;
  readonly share: number;
}) {
  return (
    <li className="register__count" data-register-bucket={bucket}>
      <p className="register__value">{count}</p>
      <p className="register__label">{label}</p>
      <div className="register__track" data-register-bar aria-hidden="true">
        <div className="register__fill" style={{ width: `${share}%` }} />
      </div>
    </li>
  );
}

/**
 * One app, as a row that is entirely a destination.
 *
 * `/versions` WITH NO FRAGMENT, and the missing fragment is a library gap rather
 * than an omission. The design makes the row an anchor to
 * `/versions#<repository>:<app>`, but `Table` emits no per-row DOM id: `rowId`
 * reaches exactly one place, TanStack's `getRowId`, and the rendered row is
 * `<tr key={row.id}>` -- React's `key` is not an attribute, so nothing lands in
 * the document. A fragment with no target scrolls nowhere and silently, which is
 * worse than a link that admits its granularity. It goes in the ADR beside the
 * `Table` grouping gap.
 */
function RosterRow({ entry }: { readonly entry: OverviewApp }) {
  return (
    <li>
      <a className="roster__row" data-health={entry.health.kind} href="/versions">
        <span className="roster__glyph" data-health-glyph aria-hidden="true">
          {HEALTH_GLYPH[entry.health.kind]}
        </span>
        <span className="roster__app">{entry.app}</span>
        {/* Verbatim, both of them. `dsVersion` may be a RANGE (`^0.1.0`) when the
            source is `declared`, and the two fields are only honest together:
            the range is what the manifest said, and `declared` is the warning
            that it may not be what is running. */}
        <span className="roster__version">{entry.dsVersion}</span>
        <span className="roster__source">{entry.dsVersionSource}</span>
        <span className="roster__health">{healthWord(entry.health)}</span>
        <time className="roster__age" dateTime={entry.generatedAt}>
          {entry.age}
        </time>
        {/* NO SECOND LINE WHEN NOTHING IS OWED. The design's words: "An app with
            no debt has no second line, which is how the design rewards being
            current without congratulating anyone." A "0 deprecated in use" line
            would be a congratulation, and it would also push every current row
            to the height of an indebted one, flattening the one piece of
            information the roster's shape carries for free.

            THE COUNT WITHOUT A COUNTDOWN. The design's owed line reads "2
            deprecated in use · Menu expires in 67d". The expiry, the overdue
            days and the replacement name have no source: the component manifest
            carries no deprecation metadata at all, which deprecated-view.tsx
            documents at length for the same three fields. The count is real, so
            it renders; the rest is not, so it does not. */}
        {entry.deprecatedInUse > 0 ? (
          <span className="roster__owed" data-owed>
            owes &middot; {entry.deprecatedInUse} deprecated in use
          </span>
        ) : null}
      </a>
    </li>
  );
}

export type OverviewViewProps = { readonly overview: Overview };

export function OverviewView({ overview }: OverviewViewProps) {
  const { totals, groups } = overview;

  if (totals.apps === 0) {
    return <p>No reports yet.</p>;
  }

  // A share OF THE REPORTING APPS, which is the only denominator the register
  // has. The design's band has a third slot -- "not reporting" -- and it is
  // absent here on the design's own instruction (§7: "Either the panel drops
  // that count, or something commits an expected-consumer roster"). `unknown`
  // appears only when it is non-zero, so the band does not grow a permanent
  // third column that reads like the one that was dropped.
  const share = (count: number) => (count / totals.apps) * 100;

  return (
    <div className="group-stack">
      <Card surface="outlined">
        <Card.Header>
          <h2 className="group-title">The register</h2>
        </Card.Header>
        <Card.Body>
          <p className="register__summary">
            {plural(totals.apps, "app", "apps")} &middot;{" "}
            {plural(totals.repositories, "repository", "repositories")}
            {totals.oldestReportAge === null ? null : (
              <> &middot; oldest report {totals.oldestReportAge}</>
            )}
          </p>
          <ul className="register__counts">
            <RegisterCount
              bucket="on-latest"
              count={totals.onLatest}
              label="on latest"
              share={share(totals.onLatest)}
            />
            <RegisterCount
              bucket="behind"
              count={totals.behind}
              label="behind"
              share={share(totals.behind)}
            />
            {totals.unknown > 0 ? (
              <RegisterCount
                bucket="unknown"
                count={totals.unknown}
                label="version not in the release log"
                share={share(totals.unknown)}
              />
            ) : null}
          </ul>
          {/* The sentence the design puts under the band, and it is load-bearing
              rather than a caption: without it a reader takes `n` for the number
              of apps that exist. It is the number that REPORT. */}
          <p className="register__note">
            n = {plural(totals.apps, "app", "apps")} reporting. The register is opt-in: an app that
            never reports is counted here and nowhere else, because absence is not a row.
          </p>
        </Card.Body>
      </Card>

      {groups.map((group) => (
        <Card key={group.repository} surface="outlined">
          <Card.Header>
            <h2 className="group-title">{group.repository}</h2>
          </Card.Header>
          <Card.Body>
            <ul className="roster">
              {group.apps.map((entry) => (
                <RosterRow key={`${entry.repository}:${entry.app}`} entry={entry} />
              ))}
            </ul>
          </Card.Body>
        </Card>
      ))}
    </div>
  );
}
