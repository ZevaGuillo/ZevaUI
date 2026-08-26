// @vitest-environment jsdom
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { type ComponentType, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

const MUTATION_ELEMENT_SELECTOR = "form, button, input, textarea, select";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const panelDir = path.join(dirname, "..", "src", "panel");
const appDir = path.join(dirname, "..", "src", "app");

// Views are DISCOVERED from src/panel, never hand-listed (ADR-0011 named the
// fourth view as the trigger for this): a new `*-view.tsx` file enters this
// gate automatically instead of silently escaping it.
const viewFiles = readdirSync(panelDir).filter((file) => file.endsWith("-view.tsx"));

// Representative props per discovered view, keyed by file name. A view absent
// here still renders (with empty props) and still gets scanned — it fails
// loudly rather than skipping.
const VIEW_PROPS: Record<string, object> = {
  "versions-view.tsx": {
    reports: [
      {
        repository: "acme/web",
        app: "web",
        dsVersion: "1.4.0",
        dsVersionSource: "installed",
        components: ["Button"],
        deprecatedComponents: [],
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
  "deprecated-view.tsx": {
    entries: [
      {
        repository: "acme/web",
        app: "web",
        deprecatedInUse: ["OldMenu"],
        reportedDeprecated: null,
      },
    ],
  },
  "release-log-view.tsx": {
    packages: [
      {
        package: "@zevaui/components",
        releases: [{ version: "0.2.0", changes: [{ type: "minor", text: "Initial." }] }],
      },
    ],
  },
};

// RF-AP01 scenario 2: no visitor interaction may result in a write to the
// registry. Proven by a DOM scan of every rendered panel view (no
// form/button/input/textarea/select element exists at all) plus a source
// scan (below) -- not by assertion in a comment.
describe("RF-AP01 scenario 2: no mutation affordance in any rendered panel view", () => {
  it("discovers the panel views (a renamed directory or suffix must fail here, not scan nothing)", () => {
    expect(viewFiles.length).toBeGreaterThanOrEqual(3);
  });

  it.each(viewFiles)("%s renders no interactive/write element", async (file) => {
    const basename = file.slice(0, -".tsx".length);
    const module: Record<string, unknown> = await import(`../src/panel/${basename}.tsx`);
    const views = Object.values(module).filter((value) => typeof value === "function");
    expect(views.length).toBeGreaterThan(0);
    for (const View of views as ComponentType<object>[]) {
      const { container } = render(createElement(View, VIEW_PROPS[file] ?? {}));
      expect(container.querySelectorAll(MUTATION_ELEMENT_SELECTOR)).toHaveLength(0);
    }
  });
});

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...listSourceFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

// The panel's only write path is the OIDC-authenticated POST
// /api/v1/reports route under src/app/api -- not a UI affordance a panel
// visitor can trigger, so it is excluded from this scan on purpose.
function nonApiAppFiles(): string[] {
  return listSourceFiles(appDir).filter((file) => !file.includes(`${path.sep}api${path.sep}`));
}

describe("RF-AP01 scenario 2: source scan finds no write trigger in panel source", () => {
  it("panel views and non-API pages contain no form, onSubmit, or POST/PUT/PATCH/DELETE fetch call", () => {
    const forbidden = [/<form\b/i, /onSubmit/, /method\s*[:=]\s*["'](post|put|patch|delete)["']/i];
    const files = [...listSourceFiles(panelDir), ...nonApiAppFiles()];
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return forbidden.some((pattern) => pattern.test(source));
    });
    expect(offenders).toEqual([]);
  });
});
