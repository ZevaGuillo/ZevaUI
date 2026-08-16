import { readFileSync, rmSync, writeFileSync } from "node:fs";
import StyleDictionary from "style-dictionary";

const THEMES = ["light", "dark", "high-contrast"];
const themeKeyOf = Object.fromEntries(
  THEMES.map((id) => [id, id === "high-contrast" ? "highContrast" : id]),
);
const acc = { light: {}, dark: {}, highContrast: {}, primitives: [] };

const kebab = (s) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
const nameOf = (path) => path.map(kebab).join("-");
const cssVarOf = (path) => `--zui-${nameOf(path)}`;

StyleDictionary.registerFormat({
  name: "json/zevaui-collect",
  format: ({ dictionary, options }) => {
    const key = themeKeyOf[options.theme];
    for (const t of dictionary.allTokens) {
      if (t.isSource) {
        const ref = /^\{(.+)\}$/.exec(t.original.$value)?.[1].split(".") ?? [];
        acc[key][nameOf(t.path)] = {
          path: t.path,
          type: t.$type,
          value: String(t.$value),
          references: ref,
        };
      } else if (options.theme === "light") {
        acc.primitives.push({
          path: t.path,
          name: nameOf(t.path),
          type: t.$type,
          value: String(t.$value),
          cssVar: cssVarOf(t.path),
          isSemantic: false,
        });
      }
    }
    return "";
  },
});

const sdFor = (theme) =>
  new StyleDictionary({
    usesDtcg: true,
    include: ["tokens/primitives/**/*.json"],
    source: [`tokens/themes/${theme}.json`],
    platforms: {
      css: {
        transformGroup: "css",
        prefix: "zui",
        buildPath: "dist/",
        files: [
          {
            destination: `tokens-${theme}.css`,
            format: "css/variables",
            options: {
              selector: theme === "light" ? ":root" : `.theme-${theme}`,
              outputReferences: true,
              showFileHeader: false,
            },
          },
        ],
      },
      collect: {
        buildPath: "dist/",
        files: [
          {
            destination: `.collect-${theme}`,
            format: "json/zevaui-collect",
            options: { theme },
          },
        ],
      },
    },
  });

rmSync("dist", { recursive: true, force: true });
for (const t of THEMES) await sdFor(t).buildAllPlatforms();

const read = (f) => readFileSync(`dist/${f}`, "utf8");
const declsOf = (css) => css.slice(css.indexOf("{") + 1, css.lastIndexOf("}")).trimEnd();
const darkDecls = declsOf(read("tokens-dark.css"))
  .split("\n")
  .map((l) => `  ${l}`)
  .join("\n");
const media = `@media (prefers-color-scheme: dark) {\n  :root:not(.theme-light):not(.theme-high-contrast) {${
  darkDecls ? `\n${darkDecls}` : ""
}\n  }\n}`;

writeFileSync(
  "dist/styles.css",
  [
    read("tokens-light.css").trimEnd(),
    media,
    read("tokens-dark.css").trimEnd(),
    read("tokens-high-contrast.css").trimEnd(),
  ].join("\n\n") + "\n",
);

const flat = (theme) =>
  Object.fromEntries(Object.entries(acc[theme]).map(([n, t]) => [n, t.value]));
const tokens = Object.fromEntries(THEMES.map((id) => [themeKeyOf[id], flat(themeKeyOf[id])]));
writeFileSync(
  "dist/index.js",
  `export const themeIds = ${JSON.stringify(THEMES, null, 2)};\n\n` +
    `export const themeKeyOf = ${JSON.stringify(themeKeyOf, null, 2)};\n\n` +
    `export const tokens = ${JSON.stringify(tokens, null, 2)};\n\n` +
    `export default tokens;\n`,
);

const names = Object.keys(acc.light);
const dtsLines = names.map((n) => `  '${n}': string;`).join("\n");
const idsType = THEMES.map((id) => `'${id}'`).join(", ");
const keyLines = THEMES.map((id) => `  '${id}': '${themeKeyOf[id]}';`).join("\n");
const tokenFields = THEMES.map((id) => `  ${themeKeyOf[id]}: ZevauiThemeTokens;`).join("\n");
const dts =
  `type ZevauiThemeTokens = {\n${dtsLines}\n};\n\n` +
  `declare const themeIds: readonly [${idsType}];\n\n` +
  `declare const themeKeyOf: {\n${keyLines}\n};\n\n` +
  `declare const tokens: {\n${tokenFields}\n};\n\n` +
  `export { themeIds, themeKeyOf };\nexport default tokens;\n`;
writeFileSync("dist/index.d.ts", dts);

const manifest = {
  version: "1.0.0",
  generated: new Date().toISOString(),
  themes: ["light", "dark", "high-contrast"],
  tokens: names.map((name) => ({
    path: acc.light[name].path,
    name,
    type: acc.light[name].type,
    cssVar: cssVarOf(acc.light[name].path),
    values: {
      light: acc.light[name].value,
      dark: acc.dark[name].value,
      highContrast: acc.highContrast[name].value,
    },
    references: {
      light: acc.light[name].references,
      dark: acc.dark[name].references,
      highContrast: acc.highContrast[name].references,
    },
    isSemantic: true,
  })),
  primitives: acc.primitives,
};
writeFileSync("dist/tokens.manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

for (const t of THEMES) rmSync(`dist/tokens-${t}.css`, { force: true });
for (const t of THEMES) rmSync(`dist/.collect-${t}`, { force: true });
