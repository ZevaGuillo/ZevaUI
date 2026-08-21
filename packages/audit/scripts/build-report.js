// Report shape and dsVersion resolution (decision #162, D8 — amends design
// #156 D5's declared-range-only value into a cascade): prefer the exact
// installed version (node_modules/@zevaui/components/package.json#version),
// fall back to the declared range (dependencies -> devDependencies ->
// peerDependencies, first hit wins) when node_modules is absent, fail
// closed (null) when neither exists. The source is DECLARED alongside the
// value — otherwise the cascade would lie by omission between an exact
// "1.2.3" and a merely-declared "^1.2.0".
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DECLARED_FIELDS = ["dependencies", "devDependencies", "peerDependencies"];
const DS_PACKAGE_NAME = "@zevaui/components";

export function resolveDsVersion({ consumerRoot }) {
  const installedPackageJsonPath = path.join(
    consumerRoot,
    "node_modules",
    "@zevaui",
    "components",
    "package.json",
  );
  if (existsSync(installedPackageJsonPath)) {
    try {
      const installed = JSON.parse(readFileSync(installedPackageJsonPath, "utf8"));
      if (typeof installed.version === "string" && installed.version.length > 0) {
        return { version: installed.version, source: "installed" };
      }
    } catch {
      // Corrupt/unreadable is not proof of "not installed" — fall through.
    }
  }

  const consumerPackageJsonPath = path.join(consumerRoot, "package.json");
  if (existsSync(consumerPackageJsonPath)) {
    let consumerPackageJson;
    try {
      consumerPackageJson = JSON.parse(readFileSync(consumerPackageJsonPath, "utf8"));
    } catch (error) {
      // Not the same call as the installed branch above. There, falling
      // through is honest: an unreadable node_modules copy is not proof the
      // package is absent, and the declared range is still to come. Here
      // there is no successor, so falling through would return null and the
      // caller would report "not installed and not declared" — a specific
      // claim about the consumer's manifest that this code just failed to
      // read. Naming the unreadable file is the only truthful answer.
      throw new Error(`${consumerPackageJsonPath} is not valid JSON: ${error.message}`);
    }
    for (const field of DECLARED_FIELDS) {
      const declared = consumerPackageJson[field]?.[DS_PACKAGE_NAME];
      if (typeof declared === "string" && declared.length > 0) {
        return { version: declared, source: "declared" };
      }
    }
  }

  return null;
}

// UTF-16 code-unit order, explicit. The default sort() happens to produce the
// same order for strings, but as an accident of coercion rather than a stated
// contract (Sonar S2871). NOT localeCompare: this array is deep-equalled
// against a committed expected report, and localeCompare without an explicit
// locale follows the runner's ICU — two honest runs could sort differently.
function byCodeUnit(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// Exact 5-key shape (D8): no deprecation field, not even as `null` (D3).
export function buildReport({ app, importsBySpecifier, dsVersion, dsVersionSource, generatedAt }) {
  const componentNames = new Set();
  for (const { specifier, names } of importsBySpecifier) {
    if (specifier !== DS_PACKAGE_NAME) continue;
    for (const name of names) componentNames.add(name);
  }

  return {
    app,
    dsVersion,
    dsVersionSource,
    components: [...componentNames].sort(byCodeUnit),
    generatedAt,
  };
}
