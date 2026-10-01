// The dashboard's CSS foundation, asserted as source rather than trusted.
//
// Every invariant here fails SILENTLY in a browser -- the page still renders,
// it just renders unreadable -- which is exactly why it is a test and not a
// comment. There is no visual gate and no axe gate on this app (the 231
// baselines and the a11y run both belong to apps/storybook), so this file is
// the only thing standing between a reordered import and a 1.05:1 label.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (...segments: string[]) => readFileSync(path.join(dirname, "..", ...segments), "utf8");

const layout = read("src", "app", "layout.tsx");
const globals = read("src", "app", "globals.css");
const manifest: { dependencies?: Record<string, string> } = JSON.parse(read("package.json"));

/**
 * The layout's side-effect imports, in source order.
 *
 * Matched as STATEMENTS rather than searched for as substrings, which is not
 * pedantry: the comment above those imports names both stylesheets in prose, in
 * the opposite order, to explain why the order matters -- so a substring search
 * reads the explanation instead of the code and fails on a correct file.
 */
const sideEffectImports = [...layout.matchAll(/^import\s+"([^"]+)";/gm)].map(
  (match) => match[1] as string,
);

describe("the token layer is a real dependency, not an ambient one", () => {
  // @zevaui/components depends on @zevaui/tokens for its own build, so the
  // stylesheet would resolve through the workspace even unlisted -- and then
  // break the day the components package stops hoisting it. Declared because
  // this app imports it directly.
  it("declares @zevaui/tokens", () => {
    expect(manifest.dependencies?.["@zevaui/tokens"]).toBeDefined();
  });

  // THE ONE THAT ONLY `next build` WOULD OTHERWISE CATCH, and it caught it once.
  //
  // tsconfig.base.json aliases `@zevaui/components` to that package's `src`,
  // which Turbopack cannot resolve (its imports use `.js` specifiers for `.ts`
  // files). `tsc` is happy either way, so a typecheck and a full test run both
  // pass while the production build fails on all 29 exports. Pinning the alias to
  // `dist` is what makes the bundler and the typechecker agree -- see the comment
  // in tsconfig.json for the whole story.
  it("pins the workspace aliases to dist, which is what the bundler can resolve", () => {
    // JSONC: tsconfig.json carries comments, so the line ones are stripped
    // before parsing rather than the file being kept comment-free.
    const tsconfig: { compilerOptions?: { paths?: Record<string, string[]> } } = JSON.parse(
      read("tsconfig.json").replace(/^\s*\/\/.*$/gm, ""),
    );
    const paths = tsconfig.compilerOptions?.paths ?? {};

    expect(paths["@zevaui/components"]).toEqual(["../../packages/components/dist"]);
    expect(paths["@zevaui/tokens"]).toEqual(["../../packages/tokens/dist"]);
  });
});

describe("the stylesheet import order, which is load-bearing (ADR-0004 D2)", () => {
  it("imports both layers", () => {
    expect(sideEffectImports).toContain("@zevaui/tokens/styles.css");
    expect(sideEffectImports).toContain("@zevaui/components/styles.css");
  });

  // `@zevaui/components/styles.css` is a chain of `var(--zui-*)` pointers that
  // resolve only once the token layer's custom properties exist. Reversed, the
  // components ship with unresolved variables. Canonical reference for this
  // order: apps/storybook/.storybook/preview.ts:1-6.
  it("imports the token layer BEFORE the component layer", () => {
    expect(sideEffectImports.indexOf("@zevaui/tokens/styles.css")).toBeLessThan(
      sideEffectImports.indexOf("@zevaui/components/styles.css"),
    );
  });
});

describe("the theme is a class on <html>, and the canvas is actually painted", () => {
  // Not a data attribute and not a provider: `.theme-dark` is the selector
  // packages/tokens/dist/styles.css:324 emits. `.theme-light` emits no rules of
  // its own (`:root` IS light), so a light island inside a dark page cannot
  // exist -- the theme is a document-level decision here.
  it("puts theme-dark on the html element", () => {
    expect(layout).toMatch(/<html[^>]*className="theme-dark"/);
  });

  // WITHOUT THIS THE PAGE IS UNREADABLE AND NOTHING ELSE SAYS SO. `.theme-dark`
  // only redefines custom properties; it paints nothing. A dark token set on a
  // browser-default white canvas puts Input's label at 1.05:1 -- measured in
  // this repo, not estimated.
  it("paints body from the canvas and default-text tokens", () => {
    expect(globals).toMatch(/background-color:\s*var\(--zui-color-bg-canvas\)/);
    expect(globals).toMatch(/color:\s*var\(--zui-color-text-default\)/);
  });

  it("is imported by the layout", () => {
    expect(sideEffectImports).toContain("./globals.css");
  });
});

describe("the app's own CSS stays on the token scale", () => {
  // The library owns every visual value; the app owns only layout (there is no
  // Stack/Grid/Box primitive, and `className: never` keeps ZevaUI components
  // sealed). A raw colour or a raw spacing value in here is the design system
  // being forked by accident, one declaration at a time.
  it("declares no literal colour", () => {
    const literals = globals.match(/(oklch|rgba?|hsla?)\(|#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(literals).toEqual([]);
  });

  // Layout primitives (`100%`, `1fr`, `0`, `auto`, `ch`) are structure, not
  // scale, so only px/rem/em lengths are policed -- those are the ones the space
  // and font-size tokens already answer. At-rule preludes are skipped because
  // the token set ships no breakpoint scale, so a media query's threshold has
  // nowhere else to come from (see the note above the @media in globals.css).
  it("declares no raw px/rem length outside the token scale", () => {
    // COMMENTS ARE STRIPPED FIRST, because this gate scans DECLARATIONS and a
    // comment is not one. The pattern below keys off a `:` followed by a length,
    // which prose hits constantly and legitimately: "measures 1.24:1", "the 1px
    // border-strong edge", "`space-32` is 128px". Without this strip the gate
    // reported five offenders for a correct stylesheet, every one of them an
    // explanation of why a value is on the scale -- so it punished exactly the
    // comments it most wants written, and the cheapest way to stay green was to
    // stop explaining. Removing comments narrows what is scanned, never what is
    // enforced: a comment cannot declare anything.
    const declarations = globals.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@media[^{]*/g, "");
    const offenders = (declarations.match(/:\s*[^;{]*?-?\d*\.?\d+(px|rem|em)\b/g) ?? []).filter(
      (declaration) => !declaration.includes("var(--zui-"),
    );
    expect(offenders).toEqual([]);
  });

  // A `var()` pointing at a token that does not exist fails the way CSS always
  // fails -- silently, falling back to the inherited value or to nothing. The
  // colour and length rules above cannot see it, because the typo IS a
  // `var(--zui-*)` reference. Caught the first invented token this file had
  // (`--zui-letter-spacing-wide`), so it stays.
  it("references only tokens the token layer actually defines", () => {
    const stylesheet = readFileSync(
      path.join(dirname, "..", "..", "..", "packages", "tokens", "dist", "styles.css"),
      "utf8",
    );
    const defined = new Set(stylesheet.match(/--zui-[\w-]+(?=\s*:)/g) ?? []);
    expect(defined.size).toBeGreaterThan(0);

    // Comments stripped for the same reason as the length gate above, and here
    // the collision is sharper: the clearest way to document a token that does
    // NOT exist is to name it, and `.group-title` does exactly that about
    // `--zui-letter-spacing-wide` -- the invented token this very test was
    // written to catch. Scanning prose would fail the file for explaining the
    // bug. A `var()` in a comment resolves nothing, so nothing is lost.
    const referenced = new Set(
      globals.replace(/\/\*[\s\S]*?\*\//g, "").match(/--zui-[\w-]+/g) ?? [],
    );
    const undeclared = [...referenced].filter((token) => !defined.has(token));
    expect(undeclared).toEqual([]);
  });
});
