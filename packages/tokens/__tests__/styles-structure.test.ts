import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../dist/styles.css", import.meta.url)), "utf8");

describe("styles.css theme structure", () => {
  it("has 3 theme blocks and exactly one gated dark media query, media before .theme-dark", () => {
    expect(css).toContain(":root {");
    expect(css).toContain(".theme-dark {");
    expect(css).toContain(".theme-high-contrast {");
    expect(css.match(/@media \(prefers-color-scheme: dark\)/g)).toHaveLength(1);
    expect(css).toContain(":root:not(.theme-light):not(.theme-high-contrast)");
    expect(css.indexOf("@media (prefers-color-scheme: dark)")).toBeLessThan(
      css.indexOf(".theme-dark {"),
    );
  });
});
