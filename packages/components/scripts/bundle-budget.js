// Pure verdict/report logic for the bundle-budget gate (RNF-02). No esbuild invocation and no
// filesystem access here — see check-bundle-budget.js for the runnable entry that measures real
// bundles and calls into this module. Kept pure so RF-QVB06's unit test can drive it directly,
// mirroring the split build-manifest.js draws between derivation and I/O.

/**
 * Resolves the budget's declared entries against the component registry.
 *
 * A registry component with `clientOnly: false` is a DERIVED entry (ADR-0004 D4 "derive, never
 * hand-list"): it must have a matching `bundle-budget.json` entry, and a new server component
 * cannot land without one — its absence is a failure, not a skip.
 *
 * Any other budget entry is DECLARED: it must carry an explicit `imports` array (or `"*"` for
 * the whole barrel), because it has no registry counterpart to derive from. An entry that is
 * neither derived nor carries `imports` is stale — the budget names a bundle nothing produces.
 */
export function budgetEntries(registry, budget) {
  const declaredEntries = budget.entries ?? {};
  const derivedNames = new Set();
  const resolved = [];

  for (const component of registry) {
    if (component.clientOnly !== false) continue;
    derivedNames.add(component.name);
    const entry = declaredEntries[component.name];
    if (entry === undefined) {
      throw new Error(
        `bundle-budget.json is missing an entry for "${component.name}" ` +
          "(registered with clientOnly: false)",
      );
    }
    resolved.push({
      name: component.name,
      kind: "server",
      imports: [component.name],
      maxGzipBytes: entry.maxGzipBytes,
      measuredGzipBytes: entry.measuredGzipBytes,
    });
  }

  for (const [name, entry] of Object.entries(declaredEntries)) {
    if (derivedNames.has(name)) continue;
    const imports = entry.imports;
    if (imports !== "*" && !Array.isArray(imports)) {
      throw new Error(
        `bundle-budget.json has a stale entry "${name}": no registered component derives it, ` +
          'and it declares no explicit "imports"',
      );
    }
    resolved.push({
      name,
      kind: imports === "*" ? "barrel" : "client",
      imports,
      maxGzipBytes: entry.maxGzipBytes,
      measuredGzipBytes: entry.measuredGzipBytes,
    });
  }

  return resolved;
}

/**
 * Compares live measurements against each entry's declared ceiling. `measurements` maps an
 * entry name to its just-measured gzip byte count.
 *
 * Ceiling comparison is a plain `<=`. The +25%/+10% multipliers (RF-QVB02) are baked into
 * `maxGzipBytes` when an entry is first authored (see check-bundle-budget.js `--record`) — this
 * function only enforces the number already on record and never recomputes it, because a
 * ceiling is a human decision, not a live measurement.
 */
export function verdict(entries, measurements) {
  return entries.map((entry) => {
    const gzipBytes = measurements[entry.name];
    if (gzipBytes === undefined) {
      throw new Error(`no measurement was provided for budget entry "${entry.name}"`);
    }
    return {
      name: entry.name,
      kind: entry.kind,
      gzipBytes,
      measuredGzipBytes: entry.measuredGzipBytes,
      maxGzipBytes: entry.maxGzipBytes,
      deltaLedger: gzipBytes - entry.measuredGzipBytes,
      deltaCeiling: gzipBytes - entry.maxGzipBytes,
      status: gzipBytes <= entry.maxGzipBytes ? "OK" : "OVER",
    };
  });
}

const REPORT_COLUMNS = [
  { header: "entry", cell: (row) => row.name },
  { header: "kind", cell: (row) => row.kind },
  { header: "gzip", cell: (row) => `${row.gzipBytes} B` },
  { header: "ledger", cell: (row) => `${row.measuredGzipBytes} B` },
  { header: "ceiling", cell: (row) => `${row.maxGzipBytes} B` },
  { header: "Δ ledger", cell: (row) => signedBytes(row.deltaLedger) },
  { header: "Δ ceiling", cell: (row) => signedBytes(row.deltaCeiling) },
  { header: "status", cell: (row) => row.status },
];

function signedBytes(value) {
  return `${value >= 0 ? "+" : ""}${value} B`;
}

function padCell(text, width) {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

/** Renders one row per verdict entry as a plain-text table (stdout AND $GITHUB_STEP_SUMMARY). */
export function formatReport(rows) {
  const widths = REPORT_COLUMNS.map((column) =>
    Math.max(column.header.length, ...rows.map((row) => column.cell(row).length)),
  );
  const formatLine = (cells) => cells.map((cell, index) => padCell(cell, widths[index])).join("  ");

  const lines = [formatLine(REPORT_COLUMNS.map((column) => column.header))];
  for (const row of rows) lines.push(formatLine(REPORT_COLUMNS.map((column) => column.cell(row))));
  return lines.join("\n");
}
