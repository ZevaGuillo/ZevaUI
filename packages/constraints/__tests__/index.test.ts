import { describe, expect, it } from "vitest";

describe("index / public surface", () => {
  it("exports exactly validateTheme at runtime", async () => {
    const mod = await import("../src/index.js");
    expect(Object.keys(mod)).toEqual(["validateTheme"]);
  });
});
