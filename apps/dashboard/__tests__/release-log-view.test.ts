// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ReleaseLogView } from "../src/panel/release-log-view.jsx";

afterEach(cleanup);

const packages = [
  {
    package: "@zevaui/components",
    releases: [{ version: "0.2.0", changes: [{ type: "minor", text: "Initial public release." }] }],
  },
];

describe("ReleaseLogView (RF-AP01 scenario 1 / RF-AP02: release log)", () => {
  it("renders each package, version and change entry", () => {
    render(createElement(ReleaseLogView, { packages }));
    expect(screen.getByText("@zevaui/components")).toBeTruthy();
    expect(screen.getByText("0.2.0")).toBeTruthy();
    expect(screen.getByText(/Initial public release\./)).toBeTruthy();
  });

  it("renders an empty state with no packages", () => {
    render(createElement(ReleaseLogView, { packages: [] }));
    expect(screen.getByText(/no releases/i)).toBeTruthy();
  });

  // Threat Matrix: poisoned report XSS -- CHANGELOG text is rendered as
  // literal text, never markdown-to-HTML, never dangerouslySetInnerHTML.
  it("renders a change entry containing HTML as literal text, never as an element", () => {
    const payload = '<img src=x onerror="window.__pwned = true">';
    const { container } = render(
      createElement(ReleaseLogView, {
        packages: [
          {
            package: "@zevaui/example",
            releases: [{ version: "1.0.0", changes: [{ type: "minor", text: payload }] }],
          },
        ],
      }),
    );
    expect(container.textContent).toContain(payload);
    expect(container.querySelector("img")).toBeNull();
  });
});
