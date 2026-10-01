// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ReleaseLogView } from "../src/panel/release-log-view";

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

// THE DATE IS OPTIONAL IN THE DATA AND MUST STAY OPTIONAL ON SCREEN.
//
// `parse-changelog.ts` only produces a `date` when the version heading carries a
// `(YYYY-MM-DD)` suffix, which `changeset version` does not emit yet (ADR-0019
// P0). So today almost every release arrives WITHOUT one, and the failure mode
// worth gating is not a missing date -- it is the page inventing one, or
// rendering an empty `<time>` that announces a date and then says nothing.
describe("the release date, which the log does not always have", () => {
  const withDate = [
    {
      package: "@zevaui/tokens",
      releases: [
        { version: "0.2.0", date: "2026-08-24", changes: [{ type: "minor", text: "Released." }] },
      ],
    },
  ];

  it("renders no <time> element at all when the release has no date", () => {
    const { container } = render(createElement(ReleaseLogView, { packages }));
    expect(container.querySelector("time")).toBeNull();
  });

  it("renders the date in a machine-readable <time> when the log carries one", () => {
    const { container } = render(createElement(ReleaseLogView, { packages: withDate }));
    const time = container.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe("2026-08-24");
    expect(time?.textContent).toBe("2026-08-24");
  });

  // The ISO day is rendered VERBATIM, never through toLocaleDateString: this is
  // a server component, and a locale- or timezone-dependent format produces one
  // string on the server and another in the browser -- a hydration mismatch, and
  // the same reason versions-view slices its ISO instant instead of formatting it.
  it("renders the date exactly as stored, with no locale formatting applied", () => {
    render(createElement(ReleaseLogView, { packages: withDate }));
    expect(screen.getByText("2026-08-24")).toBeTruthy();
  });
});

describe("the change-type tag and the version anchor", () => {
  // major/minor/patch is a CATEGORY, not a severity. Colouring "major" as danger
  // would editorialise a changelog this panel only reports -- so the tag carries
  // Badge's neutral tone, and the assertion is on the emitted class rather than
  // on a colour nothing in jsdom can measure.
  it("tags the change type with Badge's neutral tone, never a severity tone", () => {
    const { container } = render(createElement(ReleaseLogView, { packages }));
    const badge = container.querySelector(".zui-badge");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("minor");
    expect(badge?.className).toContain("tone_neutral");
    for (const severity of ["tone_danger", "tone_warning", "tone_success"]) {
      expect(badge?.className).not.toContain(severity);
    }
  });

  // Cross-screen linking is the only navigation this design has, so a version
  // heading has to be addressable. Package AND version, because a bare version
  // collides the moment two packages both ship 0.2.0 -- which is exactly what
  // this fixture asserts rather than describes.
  it("gives every version heading an id scoped by package, so two packages at 0.2.0 do not collide", () => {
    const { container } = render(
      createElement(ReleaseLogView, {
        packages: [
          ...packages,
          {
            package: "@zevaui/tokens",
            releases: [{ version: "0.2.0", changes: [{ type: "minor", text: "Also released." }] }],
          },
        ],
      }),
    );
    expect(container.querySelector("#\\@zevaui\\/components\\@0\\.2\\.0")).not.toBeNull();
    expect(container.querySelector("#\\@zevaui\\/tokens\\@0\\.2\\.0")).not.toBeNull();

    const ids = [...container.querySelectorAll("[id]")].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
