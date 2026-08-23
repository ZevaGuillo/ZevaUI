// D3: deprecatedComponents null = unknown, [] = known-none; both survive verbatim.
/** @typedef {{ repository: string, appLabel: string, dsVersion: string, dsVersionSource: string, components: string[], deprecatedComponents: string[] | null, generatedAt: Date | string }} ReportRow */

/** @param {ReportRow} row */
export function serializeReport(row) {
  return {
    repository: row.repository,
    app: row.appLabel,
    dsVersion: row.dsVersion,
    dsVersionSource: row.dsVersionSource,
    components: row.components,
    deprecatedComponents: row.deprecatedComponents,
    generatedAt: new Date(row.generatedAt).toISOString(),
  };
}

// D2: mirrors the audit package's UsageReport shape exactly -- the declined repo-as-registry layout.
/**
 * @param {ReportRow} row
 * @returns {{ app: string, dsVersion: string, dsVersionSource: string, components: string[], generatedAt: string, deprecatedComponents?: string[] }}
 */
export function toRegistryFileReport(row) {
  const base = {
    app: row.appLabel,
    dsVersion: row.dsVersion,
    dsVersionSource: row.dsVersionSource,
    components: row.components,
    generatedAt: new Date(row.generatedAt).toISOString(),
  };
  return row.deprecatedComponents === null
    ? base
    : { ...base, deprecatedComponents: row.deprecatedComponents };
}
