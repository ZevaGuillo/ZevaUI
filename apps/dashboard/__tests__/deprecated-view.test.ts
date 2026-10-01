// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { DeprecatedView } from "../src/panel/deprecated-view";

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

  // Rewritten for the grouped-panel layout this screen now uses. The old
  // assertion read a `<table>` row by its accessible name, which no longer
  // exists -- but its INTENT was never about the table: the two sources must be
  // two separately addressable elements, so that a reader (and this test) can
  // tell which one saw what. Querying each side by its own provenance attribute
  // asserts that directly instead of inferring it from a row's concatenated text.
  it("renders the computed set and the self-report as two distinct, separately addressable elements", () => {
    const { container } = render(
      createElement(DeprecatedView, {
        entries: [{ ...base, deprecatedInUse: ["OldMenu"], reportedDeprecated: ["OldMenu"] }],
      }),
    );
    const computed = container.querySelector('[data-computed="known"]');
    const reported = container.querySelector('[data-provenance="known"]');

    expect(computed).not.toBeNull();
    expect(reported).not.toBeNull();
    expect(computed).not.toBe(reported);
    expect(computed?.textContent).toContain("OldMenu");
    expect(reported?.textContent).toContain("OldMenu");
  });

  // THE REGRESSION BEHIND THE ATTRIBUTE SPLIT, pinned so it cannot come back.
  //
  // `data-provenance` means "how much do we know about this value", and only the
  // self-report has that question -- the computed side is intersected from two
  // always-present inputs. An earlier spelling of the view put
  // `data-provenance="computed-none"` on the computed side as well, which made
  // the single-node `querySelector("[data-provenance]")` above return the
  // COMPUTED side and quietly turned the null-vs-[] assertion into "none" versus
  // "none". It still passed on text, so only an explicit count catches it.
  it("puts data-provenance on the self-report alone, so the attribute identifies one element", () => {
    const { container } = render(
      createElement(DeprecatedView, {
        entries: [{ ...base, deprecatedInUse: ["OldMenu"], reportedDeprecated: null }],
      }),
    );
    expect(container.querySelectorAll("[data-provenance]")).toHaveLength(1);
    expect(container.querySelector("[data-provenance]")?.getAttribute("data-provenance")).toBe(
      "unknown",
    );
  });

  it("names both the repository and the app, because neither identifies an entry alone", () => {
    render(
      createElement(DeprecatedView, {
        entries: [
          { ...base, reportedDeprecated: [] },
          { repository: "acme/other", app: "web", deprecatedInUse: [], reportedDeprecated: [] },
        ],
      }),
    );
    expect(screen.getByRole("heading", { name: "acme/web / web" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "acme/other / web" })).toBeTruthy();
  });

  it("renders an empty state with no entries", () => {
    render(createElement(DeprecatedView, { entries: [] }));
    expect(screen.getByText(/no reports yet/i)).toBeTruthy();
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

// ADR-0014 risk 3 predicts that the two sources disagree. The verdict is the
// screen's answer to that, and the three kinds must stay three kinds: an
// absence ("cannot be cross-checked") is not a disagreement, and rendering it
// as one would invent a conflict out of a missing report.
describe("DeprecatedView: the cross-check verdict", () => {
  const verdictOf = (container: HTMLElement) =>
    container.querySelector("[data-verdict]")?.getAttribute("data-verdict");

  it("reports 'unavailable' for a null self-report, and does not call it a disagreement", () => {
    const { container } = render(
      createElement(DeprecatedView, {
        entries: [{ ...base, deprecatedInUse: ["OldMenu"], reportedDeprecated: null }],
      }),
    );
    expect(verdictOf(container)).toBe("unavailable");
    expect(container.textContent).not.toMatch(/disagree/i);
  });

  it("reports 'agrees' when both sources name the same set, regardless of order", () => {
    const { container } = render(
      createElement(DeprecatedView, {
        entries: [
          {
            ...base,
            deprecatedInUse: ["OldMenu", "OldDialog"],
            reportedDeprecated: ["OldDialog", "OldMenu"],
          },
        ],
      }),
    );
    expect(verdictOf(container)).toBe("agrees");
  });

  it("reports 'diverges' and names BOTH sides when the two sets differ", () => {
    const { container } = render(
      createElement(DeprecatedView, {
        entries: [{ ...base, deprecatedInUse: ["OldMenu"], reportedDeprecated: ["OldDialog"] }],
      }),
    );
    expect(verdictOf(container)).toBe("diverges");
    const verdict = container.querySelector("[data-verdict]")?.textContent ?? "";
    expect(verdict).toContain("OldMenu");
    expect(verdict).toContain("OldDialog");
  });

  it("reports 'agrees' when both sources are empty -- measured zero on both sides", () => {
    const { container } = render(
      createElement(DeprecatedView, { entries: [{ ...base, reportedDeprecated: [] }] }),
    );
    expect(verdictOf(container)).toBe("agrees");
  });
});

// THE GEOMETRY IS THE CONTRACT, SO THE TWO FILES HAVE TO AGREE.
//
// Every provenance state is distinguished by SHAPE -- a hatched area, a baseline
// rule, a plain list -- and that shape lives in globals.css keyed off the
// `data-provenance` value this component emits. Rename either side and nothing
// here looks wrong: the view still renders, the attribute is still present, the
// tests above still pass, and the three states quietly collapse into three
// identical blocks of text. Which is the exact failure ADR-0011 D5 exists to
// prevent, so it gets a gate rather than a comment.
describe("the provenance geometry in globals.css covers every state the view emits", () => {
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const globals = readFileSync(path.join(dirname, "..", "src", "app", "globals.css"), "utf8");

  // The two states carried by a shape rather than by their own text content.
  // `known` is a plain list and needs no rule of its own, which is the point:
  // it is the baseline the other two differ FROM.
  it.each(["unknown", "known-none"])('styles [data-provenance="%s"]', (state) => {
    expect(globals).toContain(`[data-provenance="${state}"]`);
  });

  it("gives the unknown state a texture, not a flat fill (a grey box reads as empty)", () => {
    const rule = globals.slice(globals.indexOf('[data-provenance="unknown"]'));
    expect(rule.slice(0, rule.indexOf("}"))).toMatch(/repeating-linear-gradient/);
  });
});
