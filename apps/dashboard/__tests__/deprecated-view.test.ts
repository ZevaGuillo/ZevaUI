// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DeprecatedView } from "../src/panel/deprecated-view.jsx";

afterEach(cleanup);

const base = { repository: "acme/web", app: "web", deprecatedInUse: [] };

describe("DeprecatedView (RF-13/D3: null vs [] provenance honesty)", () => {
  it("renders an 'unknown' state for a null self-reported value", () => {
    const { container } = render(
      createElement(DeprecatedView, { entries: [{ ...base, reportedDeprecated: null }] }),
    );
    expect(container.querySelector('[data-provenance="unknown"]')).not.toBeNull();
    expect(container.querySelector('[data-provenance="known-none"]')).toBeNull();
  });

  it("renders a 'known-none' state for an empty-array self-reported value", () => {
    const { container } = render(
      createElement(DeprecatedView, { entries: [{ ...base, reportedDeprecated: [] }] }),
    );
    expect(container.querySelector('[data-provenance="known-none"]')).not.toBeNull();
    expect(container.querySelector('[data-provenance="unknown"]')).toBeNull();
  });

  it("never renders the same text for the null state and the [] state", () => {
    const { container: unknownContainer } = render(
      createElement(DeprecatedView, { entries: [{ ...base, reportedDeprecated: null }] }),
    );
    const unknownText = unknownContainer.querySelector("[data-provenance]")?.textContent;
    cleanup();

    const { container: noneContainer } = render(
      createElement(DeprecatedView, { entries: [{ ...base, reportedDeprecated: [] }] }),
    );
    const noneText = noneContainer.querySelector("[data-provenance]")?.textContent;

    expect(unknownText).toBeTruthy();
    expect(noneText).toBeTruthy();
    expect(unknownText).not.toEqual(noneText);
  });

  it("renders the computed deprecated-in-use list distinctly from the self-reported cross-check", () => {
    render(
      createElement(DeprecatedView, {
        entries: [{ ...base, deprecatedInUse: ["OldMenu"], reportedDeprecated: ["OldMenu"] }],
      }),
    );
    const row = screen.getByRole("row", { name: /acme\/web/ });
    expect(row.textContent).toContain("OldMenu");
  });

  // Threat Matrix: poisoned report (XSS) -- component names carrying HTML
  // must render as literal text, never as a real DOM element.
  it("renders a payload component name as literal text, never as an element (XSS)", () => {
    const payload = '<img src=x onerror="window.__pwned = true">';
    const { container } = render(
      createElement(DeprecatedView, {
        entries: [
          {
            repository: "acme/web",
            app: "web",
            deprecatedInUse: [payload],
            reportedDeprecated: [payload],
          },
        ],
      }),
    );
    expect(container.textContent).toContain(payload);
    expect(container.querySelector("img")).toBeNull();
  });
});
