import { describe, expect, it } from "vitest";
import {
  computeDeprecatedInUse,
  deprecatedNamesFromManifest,
} from "../src/panel/deprecated-logic.js";

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
