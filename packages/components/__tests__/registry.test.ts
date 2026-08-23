import { describe, expect, it } from "vitest";
import { type ComponentRegistryEntry, componentRegistry, isSlotRecipe } from "../src/registry.js";

// `slots` is the only structural difference between the two recipe shapes Panda accepts, and it
// is what decides `theme.recipes` vs `theme.slotRecipes` in panda.config.ts plus the manifest's
// derived `slots` array. Keeping the discriminator in one tested place stops each consumer from
// re-inventing the check.
describe("isSlotRecipe", () => {
  it("recognises a slot recipe by its declared slots", () => {
    expect(isSlotRecipe({ className: "zui-fixture", slots: ["root"], variants: {} })).toBe(true);
  });

  it("rejects a single-part recipe, which declares no slots", () => {
    expect(isSlotRecipe({ className: "zui-fixture", variants: {} })).toBe(false);
  });

  it("classifies every registered recipe without throwing", () => {
    expect(componentRegistry.length).toBeGreaterThan(0);
    for (const entry of componentRegistry) {
      expect(typeof isSlotRecipe(entry.recipe)).toBe("boolean");
    }
  });
});

// RF-AR04/D7: `deprecated` is optional and, when present, the richer
// `{ since, replacement?, note? }` object — never a boolean. No component
// sets it in this PR; these fixtures prove the type accepts the shape.
describe("ComponentRegistryEntry.deprecated (D7 additive shape)", () => {
  it("accepts the full object shape with replacement and note", () => {
    const fixture: ComponentRegistryEntry = {
      name: "Fixture",
      recipeKey: "fixture",
      recipe: { className: "zui-fixture", variants: {} },
      modulePath: "fixture/Fixture.js",
      clientOnly: true,
      deprecated: { since: "1.4.0", replacement: "NewFixture", note: "use NewFixture instead" },
    };
    expect(fixture.deprecated).toEqual({
      since: "1.4.0",
      replacement: "NewFixture",
      note: "use NewFixture instead",
    });
  });

  it("accepts deprecated with only the required `since` key", () => {
    const fixture: ComponentRegistryEntry = {
      name: "Fixture2",
      recipeKey: "fixture2",
      recipe: { className: "zui-fixture2", variants: {} },
      modulePath: "fixture2/Fixture2.js",
      clientOnly: true,
      deprecated: { since: "2.0.0" },
    };
    expect(fixture.deprecated).toEqual({ since: "2.0.0" });
    expect(fixture.deprecated?.replacement).toBeUndefined();
  });
});

// No component is deprecated in this PR; the byte-identical manifest case
// is covered end-to-end by __tests__/manifest-entry.test.ts.
