// D3: deprecatedComponents null = unknown, [] = known-none; both survive verbatim.
export type ReportRow = {
  readonly repository: string;
  readonly appLabel: string;
  readonly dsVersion: string;
  readonly dsVersionSource: string;
  readonly components: readonly string[];
  readonly deprecatedComponents: readonly string[] | null;
  readonly generatedAt: Date | string;
};

export type SerializedReport = {
  readonly repository: string;
  readonly app: string;
  readonly dsVersion: string;
  readonly dsVersionSource: string;
  readonly components: readonly string[];
  readonly deprecatedComponents: readonly string[] | null;
  readonly generatedAt: string;
};

export function serializeReport(row: ReportRow): SerializedReport {
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
export type RegistryFileReport = {
  readonly app: string;
  readonly dsVersion: string;
  readonly dsVersionSource: string;
  readonly components: readonly string[];
  readonly generatedAt: string;
  readonly deprecatedComponents?: readonly string[];
};

export function toRegistryFileReport(row: ReportRow): RegistryFileReport {
  const base: RegistryFileReport = {
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
