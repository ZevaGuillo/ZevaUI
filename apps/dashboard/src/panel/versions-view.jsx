// D5: pure presentational component -- versions per app, RF-AP01 scenario 1.
// Takes already-serialized reports (see reports/serialize.js); no fetching,
// no auth, no interactive elements at all -- RF-AP01 scenario 2 (no mutation
// affordance) is proven by __tests__/no-mutation-affordance.test.ts.
// `{value}` interpolation is React's own auto-escaping; every consumer-
// supplied field renders as text, never as markup (Threat Matrix: poisoned
// report XSS).

/**
 * @param {{ reports: { repository: string, app: string, dsVersion: string,
 *   dsVersionSource: string, generatedAt: string }[] }} props
 */
export function VersionsView({ reports }) {
  if (reports.length === 0) {
    return <p>No reports yet.</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Repository</th>
          <th>App</th>
          <th>Design system version</th>
          <th>Version source</th>
          <th>Reported at</th>
        </tr>
      </thead>
      <tbody>
        {reports.map((report) => (
          <tr key={`${report.repository}:${report.app}`}>
            <td>{report.repository}</td>
            <td>{report.app}</td>
            <td>{report.dsVersion}</td>
            <td>{report.dsVersionSource}</td>
            <td>{report.generatedAt}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
