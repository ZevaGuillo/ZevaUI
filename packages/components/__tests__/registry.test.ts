import { describe, expect, it } from "vitest";
import { componentRegistry, isSlotRecipe } from "../src/registry.js";

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
