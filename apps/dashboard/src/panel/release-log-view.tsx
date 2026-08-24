// D5: pure presentational component -- release log, RF-AP01 scenario 1 /
// RF-AP02. Takes the already-parsed release log (see
// release-log/parse-changelog.js and scripts/build-release-log.js) and
// renders each change as plain text through React's own `{value}`
// auto-escaping. CHANGELOG markdown is never interpreted to HTML, and the
// raw-HTML-injection escape hatch banned by
// __tests__/no-dangerous-html.test.ts is never used here (Threat Matrix:
// poisoned report XSS).
import type { ParsedChangelog } from "../release-log/parse-changelog";

export type ReleaseLogViewProps = { readonly packages: readonly ParsedChangelog[] };

export function ReleaseLogView({ packages }: ReleaseLogViewProps) {
  if (packages.length === 0) {
    return <p>No releases yet.</p>;
  }
  return (
    <div>
      {packages.map((pkg) => (
        <section key={pkg.package}>
          <h2>{pkg.package}</h2>
          {pkg.releases.map((release) => (
            <div key={release.version}>
              <h3>{release.version}</h3>
              <ul>
                {release.changes.map((change) => (
                  <li key={`${change.type}:${change.text}`}>
                    <strong>{change.type}</strong>: {change.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
