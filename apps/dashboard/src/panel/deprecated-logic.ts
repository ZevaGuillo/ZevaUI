// D5/D7: deprecated-in-use intersects each report's own components against
// the build-time manifest's deprecated set -- always known, since both the
// manifest and a report's components are always present. The report's own
// `deprecatedComponents` field is a SEPARATE provenance cross-check and is
// NOT computed here: `null` means "unknown" (an older/pre-D7 report, or the
// consumer's own manifest was unreadable at report time), `[]` means
// "known-none" -- these two states must never be collapsed together (D3
// provenance honesty). The panel view is responsible for rendering that
// distinction; this module only computes the primary, always-known value.

export type ManifestComponent = { readonly name: string; readonly deprecated?: unknown };
export type ComponentManifest = { readonly components?: readonly ManifestComponent[] };

export function deprecatedNamesFromManifest(manifest: ComponentManifest): Set<string> {
  return new Set(
    (manifest.components ?? [])
      .filter((component) => component.deprecated != null)
      .map((component) => component.name),
  );
}

export function computeDeprecatedInUse(
  components: readonly string[],
  deprecatedNames: ReadonlySet<string>,
): string[] {
  return components.filter((name) => deprecatedNames.has(name));
}

/**
 * The cross-check between the two sources, as a value rather than as rendering.
 *
 * ADR-0014 risk 3 predicts the divergence this computes: the manifest and the
 * consumer's self-report are measured at different times by different code, so
 * they can legitimately disagree, and the panel's job is to SAY SO rather than
 * to pick a winner.
 *
 * `unavailable` is NOT a failure and must not be rendered as one. A `null`
 * self-report means nobody looked; the cross-check has one input instead of two,
 * so it cannot run. That is different from running and disagreeing, and
 * collapsing the two is the same D3 provenance sin as collapsing `null` into
 * `[]`.
 */
export type DeprecatedCrossCheck =
  | { readonly kind: "unavailable" }
  | { readonly kind: "agrees" }
  | {
      readonly kind: "diverges";
      readonly computedOnly: readonly string[];
      readonly reportedOnly: readonly string[];
    };

/**
 * `Set` for membership on both sides, never an object literal keyed by a
 * component name. A component name comes off a consumer's report, so it is
 * arbitrary data -- and an object literal answers index lookups for keys nobody
 * set (`{}["constructor"]` is `Object`), which is exactly the CRITICAL that the
 * review caught in `versions-view.tsx`. A `Set` resolves only what was added.
 */
export function crossCheckDeprecated(
  computed: readonly string[],
  reported: readonly string[] | null,
): DeprecatedCrossCheck {
  if (reported === null) {
    return { kind: "unavailable" };
  }
  const computedSet = new Set(computed);
  const reportedSet = new Set(reported);
  const computedOnly = [...computedSet].filter((name) => !reportedSet.has(name));
  const reportedOnly = [...reportedSet].filter((name) => !computedSet.has(name));
  if (computedOnly.length === 0 && reportedOnly.length === 0) {
    return { kind: "agrees" };
  }
  return { kind: "diverges", computedOnly, reportedOnly };
}
