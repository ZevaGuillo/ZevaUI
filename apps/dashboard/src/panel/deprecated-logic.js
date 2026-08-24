// D5/D7: deprecated-in-use intersects each report's own components against
// the build-time manifest's deprecated set -- always known, since both the
// manifest and a report's components are always present. The report's own
// `deprecatedComponents` field is a SEPARATE provenance cross-check and is
// NOT computed here: `null` means "unknown" (an older/pre-D7 report, or the
// consumer's own manifest was unreadable at report time), `[]` means
// "known-none" -- these two states must never be collapsed together (D3
// provenance honesty). The panel view is responsible for rendering that
// distinction; this module only computes the primary, always-known value.

/** @param {{ components?: { name: string, deprecated?: unknown }[] }} manifest */
export function deprecatedNamesFromManifest(manifest) {
  return new Set(
    (manifest.components ?? [])
      .filter((component) => component.deprecated != null)
      .map((component) => component.name),
  );
}

/** @param {string[]} components @param {Set<string>} deprecatedNames */
export function computeDeprecatedInUse(components, deprecatedNames) {
  return components.filter((name) => deprecatedNames.has(name));
}
