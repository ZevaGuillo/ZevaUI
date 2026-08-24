// @vitest-environment jsdom
//
// JSX is intentionally NOT used in this file (stays `.test.ts`, not `.test.tsx`) --
// see the same rationale in packages/components/__tests__/button.test.ts.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { VersionsView } from "../src/panel/versions-view";

afterEach(cleanup);

const report = {
  repository: "acme/web",
  app: "web",
  dsVersion: "1.4.0",
  dsVersionSource: "installed",
  components: ["Button"],
  deprecatedComponents: [],
  generatedAt: "2026-01-01T00:00:00.000Z",
};

describe("VersionsView (RF-AP01 scenario 1: versions per app, no auth)", () => {
  it("renders one row per report with repository, app, version and source", () => {
    render(createElement(VersionsView, { reports: [report] }));
    const row = screen.getByRole("row", { name: /acme\/web/ });
    expect(row.textContent).toContain("web");
    expect(row.textContent).toContain("1.4.0");
    expect(row.textContent).toContain("installed");
  });

  it("renders an empty state with no reports", () => {
    render(createElement(VersionsView, { reports: [] }));
    expect(screen.getByText(/no reports/i)).toBeTruthy();
  });

  // Threat Matrix: poisoned report (XSS) -- app/dsVersion carrying HTML must
  // render as literal text, never become a real DOM element.
  it("renders a payload app/dsVersion as literal text, never as an element (XSS)", () => {
    const payload = '<img src=x onerror="window.__pwned = true">';
    const { container } = render(
      createElement(VersionsView, {
        reports: [{ ...report, app: payload, dsVersion: payload }],
      }),
    );
    expect(container.textContent).toContain(payload);
    expect(container.querySelector("img")).toBeNull();
  });
});
