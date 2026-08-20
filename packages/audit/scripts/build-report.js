// Report shape and dsVersion resolution (binding decision #162, D8 — amends
// design #156 D5 from a declared-range-only value to a cascade).
//
// dsVersion resolves in two steps, and the report DECLARES which one fired:
//   1. `node_modules/@zevaui/components/package.json#version`, when present
//      — the exact installed version, satisfying RF-UAW07's literal "which
//      version is installed" ask.
//   2. The declared range in the consumer's own `package.json`
//      (dependencies -> devDependencies -> peerDependencies, first hit
//      wins), when node_modules is absent — e.g. a bare checkout with no
//      install step run yet.
//   3. Neither exists: fail closed (returns null). A guessed version is a
//      false audit signal, not a degraded one.
//
// Without declaring the source, the cascade would lie by omission: a
// consumer could not tell an exact "1.2.3" from a merely-declared "^1.2.0".
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
      // Corrupt/unreadable installed package.json is not proof of "not
      // installed" — fall through to the declared branch rather than
      // failing closed on a parse error alone.
    }
  }

  const consumerPackageJsonPath = path.join(consumerRoot, "package.json");
  if (existsSync(consumerPackageJsonPath)) {
    const consumerPackageJson = JSON.parse(readFileSync(consumerPackageJsonPath, "utf8"));
    for (const field of DECLARED_FIELDS) {
      const declared = consumerPackageJson[field]?.[DS_PACKAGE_NAME];
      if (typeof declared === "string" && declared.length > 0) {
        return { version: declared, source: "declared" };
      }
    }
  }

  return null;
}

// Exact 5-key shape (D8): no deprecation field, not even as `null` (D3 in
// #151 keeps "deprecated components used" out of v1 entirely).
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
    components: [...componentNames].sort(),
    generatedAt,
  };
}
