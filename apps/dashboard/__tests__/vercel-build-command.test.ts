// This app CANNOT be built by running its own `build` script alone, and the
// failure is measured, not theorised: from a clean checkout,
// `pnpm --filter @zevaui/dashboard build` dies with
//
//   Module not found: Can't resolve '@zevaui/components/components.manifest.json'
//
// because src/app/deprecated/page.tsx imports that manifest, and the manifest
// is a BUILD ARTIFACT of @zevaui/components (its export map points at
// dist/components.manifest.json, written by that package's own build).
//
// Vercel's default for a Next app is to run the app's build script in the
// Root Directory, which is exactly the command that fails. So the build has
// to be routed through turbo from the repo root, where `^build` pulls the
// workspace dependencies first. These gates keep it that way: the deploy
// breaks in a hosted build log, far from whoever "simplified" the command.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vercelConfig: {
  buildCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
} = JSON.parse(readFileSync(path.join(appRoot, "vercel.json"), "utf8"));

const manifestSpecifier = "@zevaui/components/components.manifest.json";

describe("vercel.json build contract", () => {
  it("routes the build through turbo, which is what pulls the workspace dependencies", () => {
    expect(vercelConfig.buildCommand).toBeDefined();
    expect(vercelConfig.buildCommand).toContain("turbo run build");
  });

  it("filters to this app, so a deploy does not build the whole monorepo", () => {
    expect(vercelConfig.buildCommand).toContain("@zevaui/dashboard");
  });

  it("installs from the repo root, where the pnpm workspace actually is", () => {
    // Vercel runs commands from the configured Root Directory (apps/dashboard).
    // A bare `pnpm install` there resolves no workspace and links no local
    // package, so both commands have to climb out first.
    expect(vercelConfig.installCommand).toContain("cd ../..");
    expect(vercelConfig.buildCommand).toContain("cd ../..");
  });

  it("keeps a frozen lockfile, so a deploy cannot silently resolve new versions", () => {
    expect(vercelConfig.installCommand).toContain("--frozen-lockfile");
  });

  it("still points at the import that makes all of the above necessary", () => {
    // If this import ever goes away, the gates above are cargo cult and should
    // be re-justified rather than kept out of habit.
    const page = readFileSync(path.join(appRoot, "src", "app", "deprecated", "page.tsx"), "utf8");

    expect(page).toContain(manifestSpecifier);
  });
});
