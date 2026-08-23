// Pure: decides one component's manifest entry shape. Split out of
// build-manifest.js (which does dist IO at module load) so this decision is
// unit-testable without a real build — RF-AR04 needs both the "additive"
// case and the "byte-identical when absent" case proven directly.
/**
 * @param {import("../src/registry.js").ComponentRegistryEntry} entry
 * @param {{
 *   clientOnly: boolean,
 *   slots: readonly string[],
 *   variants: ReadonlyArray<{ axis: string, values: string[], default?: string }>,
 *   classNames: readonly string[],
 *   tokens: readonly string[],
 * }} derived
 */
export function buildManifestEntry(entry, derived) {
  // Additive only (RF-AR04 scenario 2): a registry entry with no `deprecated`
  // field produces a manifest entry with no `deprecated` key at all — never
  // `undefined` sitting in the JSON, never `null`. Today's exact 8-key shape.
  // The conditional spread (rather than an `if` + assignment) is what lets
  // TypeScript infer `deprecated` as optional on the return type instead of
  // absent entirely — an assignment after the literal narrows to "never had it".
  return {
    name: entry.name,
    className: entry.recipe.className,
    clientOnly: derived.clientOnly,
    import: "@zevaui/components",
    slots: derived.slots,
    variants: derived.variants,
    classNames: derived.classNames,
    tokens: derived.tokens,
    ...(entry.deprecated !== undefined ? { deprecated: entry.deprecated } : {}),
  };
}
