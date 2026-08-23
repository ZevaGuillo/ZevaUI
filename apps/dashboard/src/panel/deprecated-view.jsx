// D5/D3: renders BOTH the computed deprecated-in-use (always known -- see
// panel/deprecated-logic.js) and the report's own self-reported
// `deprecatedComponents` as a provenance cross-check. `null` (unknown) and
// `[]` (known-none) render as visibly different states, distinguished by
// text AND a `data-provenance` attribute -- never collapsed together (D3
// provenance honesty). Every consumer-supplied name renders through React's
// own `{value}` auto-escaping, never as markup (Threat Matrix: poisoned
// report XSS).

/** @param {{ value: string[] | null }} props */
function ReportedField({ value }) {
  if (value === null) {
    return <span data-provenance="unknown">unknown (not reported)</span>;
  }
  if (value.length === 0) {
    return <span data-provenance="known-none">none reported</span>;
  }
  return (
    <ul data-provenance="known">
      {value.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

/**
 * @param {{ entries: { repository: string, app: string, deprecatedInUse: string[],
 *   reportedDeprecated: string[] | null }[] }} props
 */
export function DeprecatedView({ entries }) {
  if (entries.length === 0) {
    return <p>No reports yet.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Repository</th>
          <th>App</th>
          <th>Deprecated components in use (computed)</th>
          <th>Self-reported deprecated components</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr key={`${entry.repository}:${entry.app}`}>
            <td>{entry.repository}</td>
            <td>{entry.app}</td>
            <td>
              {entry.deprecatedInUse.length === 0 ? (
                "none"
              ) : (
                <ul>
                  {entry.deprecatedInUse.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}
            </td>
            <td>
              <ReportedField value={entry.reportedDeprecated} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
