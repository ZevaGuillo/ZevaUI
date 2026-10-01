// D5: pure presentational component -- release log, RF-AP01 scenario 1 /
// RF-AP02. Takes the already-parsed release log (see
// release-log/parse-changelog.ts and scripts/build-release-log.ts) and
// renders each change as plain text through React's own `{value}`
// auto-escaping. CHANGELOG markdown is never interpreted to HTML, and the
// raw-HTML-injection escape hatch banned by
// __tests__/no-dangerous-html.test.ts is never used here (Threat Matrix:
// poisoned report XSS).
//
// NO "use client", for the same reason as `deprecated-view.tsx`: `Badge` is
// `clientOnly: false`, so this stays a server component and ships no JavaScript.
// Only `versions-view.tsx` has to be a client component, and only because
// `Table`'s `cell` descriptors are functions that cannot cross the RSC boundary.
//
// THE ONE SCREEN THAT IS A DOCUMENT RATHER THAN A TABLE, so it gets a document's
// layout instead of a grid's: a narrow mono rail carrying version and date, a
// gutter, and a prose column with a reading MEASURE (62ch, in globals.css)
// rather than a column width. Change text is real English, not a table cell.
import { Badge } from "@zevaui/components";
import type { ParsedChangelog } from "../release-log/parse-changelog";

export type ReleaseLogViewProps = { readonly packages: readonly ParsedChangelog[] };

/**
 * The anchor target for a version heading.
 *
 * Cross-screen linking is the only navigation this design has -- the
 * impact-radius screen is meant to link straight at
 * `/releases#@zevaui/components@0.2.0` -- so the id has to be derived from the
 * data rather than assigned by hand. Package and version together, because a
 * version string alone collides across packages the moment two of them ship
 * `0.2.0`.
 */
const releaseAnchor = (packageName: string, version: string) => `${packageName}@${version}`;

export function ReleaseLogView({ packages }: ReleaseLogViewProps) {
  if (packages.length === 0) {
    return <p>No releases yet.</p>;
  }
  return (
    <div className="group-stack">
      {packages.map((pkg) => (
        <section className="group" key={pkg.package}>
          <h2 className="group__header">{pkg.package}</h2>
          <div className="group__body">
            {pkg.releases.map((release) => (
              <article className="release-log__release" key={release.version}>
                <div className="release-log__rail">
                  <h3
                    className="release-log__version"
                    id={releaseAnchor(pkg.package, release.version)}
                  >
                    {release.version}
                  </h3>
                  {/* THE DATE IS OPTIONAL AND THE PAGE DOES NOT PRETEND TO ONE.
                      `parse-changelog.ts` admits a `(YYYY-MM-DD)` suffix on the
                      version heading and nothing else, so a release only has a
                      date once `changeset version` has been taught to stamp one
                      (ADR-0019 P0). Until then the rail shows the version alone
                      rather than a guessed or derived date -- the whole thesis of
                      ADR-0011 D2 is that the log is evidence, and evidence needs a
                      real timestamp or none. `<time dateTime>` keeps the value
                      machine-readable, and the string is already a plain ISO day,
                      so there is no locale-dependent format to produce a hydration
                      mismatch. */}
                  {release.date === undefined ? null : (
                    <time className="release-log__date" dateTime={release.date}>
                      {release.date}
                    </time>
                  )}
                </div>
                <ul className="release-log__changes">
                  {release.changes.map((change) => (
                    <li className="release-log__change" key={`${change.type}:${change.text}`}>
                      {/* `tone="neutral"` ON PURPOSE, not for want of a better
                          tone. major/minor/patch is a CATEGORY, not a severity:
                          colouring "major" danger-red would editorialise a
                          changelog the panel only reports. `neutral` is
                          `bg.subtle`, which is exactly the surface the design
                          asks the tag for.

                          The design also wants a `border-strong` edge on that
                          tag, and `Badge` has no border in its recipe and is
                          sealed (`className: never`), so that half is not
                          expressible from here -- it goes in the ADR with the
                          other library gaps rather than being faked with a
                          wrapper. */}
                      <Badge tone="neutral">{change.type}</Badge>
                      <p className="release-log__change-text">{change.text}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
