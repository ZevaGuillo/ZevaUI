import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("../dist/styles.css", import.meta.url)), "utf8");

const VARS = [
  "--zui-color-text-default",
  "--zui-color-bg-canvas",
  "--zui-color-border-subtle",
  "--zui-color-accent-default",
  "--zui-space-card-px",
  "--zui-radius-button",
];

const bodyOf = (sel: string) =>
  css.slice(css.indexOf(`${sel} {`), css.indexOf("\n}", css.indexOf(`${sel} {`)));

for (const sel of [":root", ".theme-dark", ".theme-high-contrast"]) {
  it(`${sel} declares semantic vars as var() chains`, () => {
    const body = bodyOf(sel);
    for (const v of VARS) expect(body).toContain(`${v}: var(--zui-`);
  });
}
