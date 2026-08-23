import { describe, expect, it } from "vitest";
import { buildManifestEntry } from "../scripts/manifest-entry.js";

// RF-AR04: `deprecated` flows into the manifest additively — present only
// when the registry entry declares it, and byte-identical to today's shape
// when it does not (design D7). Pure function, no dist reads: the derived
// fields (`clientOnly`, `slots`, `variants`, `classNames`, `tokens`) are
// exactly what build-manifest.js already computes from the built artifacts;
// this is the one place that decides the manifest entry's final shape.
const baseEntry = {
  name: "Widget",
  recipeKey: "widget",
  recipe: { className: "zui-widget", variants: {} },
  modulePath: "widget/Widget.js",
  clientOnly: true,
};

const derived = {
  clientOnly: true,
  slots: [],
  variants: [],
  classNames: ["zui-widget"],
  tokens: ["--zui-color-x"],
};

describe("buildManifestEntry (RF-AR04, D7)", () => {
  it("omits `deprecated` entirely when the registry entry has none — today's exact 8-key shape", () => {
    const manifestEntry = buildManifestEntry(baseEntry, derived);
    // toEqual on the exact object (no `deprecated` key anywhere) proves both
    // "the key is absent" AND "no other field drifted" in one assertion.
    expect(manifestEntry).toEqual({
      name: "Widget",
      className: "zui-widget",
      clientOnly: true,
      import: "@zevaui/components",
      slots: [],
      variants: [],
      classNames: ["zui-widget"],
      tokens: ["--zui-color-x"],
    });
  });

  it("includes `deprecated` verbatim when the registry entry declares the full D7 shape", () => {
    const deprecated = { since: "1.4.0", replacement: "NewWidget", note: "use NewWidget instead" };
    const manifestEntry = buildManifestEntry({ ...baseEntry, deprecated }, derived);
    expect(manifestEntry.deprecated).toEqual(deprecated);
  });

  it("includes `deprecated` with only the required `since` key", () => {
    const manifestEntry = buildManifestEntry(
      { ...baseEntry, deprecated: { since: "2.0.0" } },
      derived,
    );
    expect(manifestEntry.deprecated).toEqual({ since: "2.0.0" });
  });
});
