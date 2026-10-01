import { describe, expect, it } from "vitest";
import {
  computeDeprecatedInUse,
  crossCheckDeprecated,
  deprecatedNamesFromManifest,
} from "../src/panel/deprecated-logic";

describe("deprecatedNamesFromManifest (D7: manifest is the deprecation source of truth)", () => {
  it("collects only component names that declare a deprecated field", () => {
    const names = deprecatedNamesFromManifest({
      components: [{ name: "Button" }, { name: "OldMenu", deprecated: { since: "1.4.0" } }],
    });
    expect(names).toEqual(new Set(["OldMenu"]));
  });

  it("returns an empty set when the manifest lists no components", () => {
    expect(deprecatedNamesFromManifest({})).toEqual(new Set());
  });
});

describe("computeDeprecatedInUse (D5: intersect a report's components with the deprecated set)", () => {
  it("intersects a report's components with the manifest's deprecated set", () => {
    const deprecatedNames = new Set(["OldMenu"]);
    expect(computeDeprecatedInUse(["Button", "OldMenu"], deprecatedNames)).toEqual(["OldMenu"]);
  });

  it("returns an empty array, never null, when nothing in use is deprecated", () => {
    expect(computeDeprecatedInUse(["Button"], new Set(["OldMenu"]))).toEqual([]);
  });
});

// ADR-0014 risk 3 predicts that the manifest and a consumer's self-report
// disagree: they are measured at different times by different code. The
// cross-check's job is to say WHICH source saw what, never to pick a winner.
describe("crossCheckDeprecated (ADR-0014 risk 3: the two sources can legitimately disagree)", () => {
  // THE DISTINCTION THE WHOLE MODULE EXISTS FOR, asserted at the logic layer and
  // not only through the rendered output: `null` means the cross-check has one
  // input instead of two, so it cannot RUN. That is not the same as running and
  // disagreeing, and collapsing the two is the same D3 sin as collapsing `null`
  // into `[]`.
  it("is 'unavailable' for a null self-report, even when the computed side is non-empty", () => {
    expect(crossCheckDeprecated(["OldMenu"], null)).toEqual({ kind: "unavailable" });
  });

  it("is 'unavailable' for a null self-report even when the computed side is empty too", () => {
    expect(crossCheckDeprecated([], null)).toEqual({ kind: "unavailable" });
  });

  it("is 'agrees' when both sides are empty -- measured zero on both sides is agreement", () => {
    expect(crossCheckDeprecated([], [])).toEqual({ kind: "agrees" });
  });

  it("is 'agrees' on the same set in a different order", () => {
    expect(crossCheckDeprecated(["OldMenu", "OldDialog"], ["OldDialog", "OldMenu"])).toEqual({
      kind: "agrees",
    });
  });

  it("is 'agrees' when a side repeats a name -- these are SETS, not lists", () => {
    expect(crossCheckDeprecated(["OldMenu", "OldMenu"], ["OldMenu"])).toEqual({ kind: "agrees" });
  });

  it("names both sides of a disagreement, and attributes each name to its own source", () => {
    expect(crossCheckDeprecated(["OldMenu"], ["OldDialog"])).toEqual({
      kind: "diverges",
      computedOnly: ["OldMenu"],
      reportedOnly: ["OldDialog"],
    });
  });

  it("reports a one-sided disagreement with an empty list on the other side, not a missing field", () => {
    expect(crossCheckDeprecated(["OldMenu"], [])).toEqual({
      kind: "diverges",
      computedOnly: ["OldMenu"],
      reportedOnly: [],
    });
    expect(crossCheckDeprecated([], ["OldMenu"])).toEqual({
      kind: "diverges",
      computedOnly: [],
      reportedOnly: ["OldMenu"],
    });
  });

  // A component name comes off a consumer-supplied report, so it is arbitrary
  // data -- and an object literal keyed by one answers lookups for keys nobody
  // set (`{}["constructor"]` is `Object`, not undefined). That is the CRITICAL
  // the review caught in versions-view.tsx, and this is the same shape of code,
  // so it gets the same test rather than the same bug.
  it.each(["constructor", "toString", "hasOwnProperty", "valueOf", "__proto__"])(
    "treats the prototype-chain name %s as ordinary data on both sides",
    (name) => {
      expect(crossCheckDeprecated([name], [name])).toEqual({ kind: "agrees" });
      expect(crossCheckDeprecated([name], [])).toEqual({
        kind: "diverges",
        computedOnly: [name],
        reportedOnly: [],
      });
    },
  );
});
