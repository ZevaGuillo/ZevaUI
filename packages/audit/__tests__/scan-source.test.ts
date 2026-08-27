import { describe, expect, it } from "vitest";
import { blankSource, scanSource, TRACKED_SPECIFIERS } from "../scripts/scan-source.js";

describe("blankSource", () => {
  it("blanks a line comment, preserving length and line count", () => {
    const source = 'const a = 1; // import { Ghost } from "@zevaui/components"\nconst b = 2;';
    const blanked = blankSource(source);
    expect(blanked.length).toBe(source.length);
    expect(blanked).not.toContain("import");
    expect(blanked.split("\n")).toHaveLength(2);
  });

  it("blanks a block comment spanning multiple lines", () => {
    const source = '/*\nimport { Ghost } from "@zevaui/components";\n*/\nconst x = 1;';
    const blanked = blankSource(source);
    expect(blanked).not.toContain("import");
    expect(blanked.split("\n")).toHaveLength(source.split("\n").length);
  });

  it("blanks a string literal containing an import-shaped decoy", () => {
    const source = "const s = 'import { Ghost } from \"@zevaui/components\";';";
    const blanked = blankSource(source);
    expect(blanked).not.toContain("import");
  });

  it("blanks a template literal, including a nested ${} interpolation", () => {
    const source = 'const s = `outer ${`inner import { Ghost } from "@zevaui/components"`} end`;';
    const blanked = blankSource(source);
    expect(blanked).not.toContain("import");
  });

  it("resumes real-code scanning after a template literal closes", () => {
    const source = 'const s = `hi ${name}`;\nimport { Button } from "@zevaui/components";';
    const blanked = blankSource(source);
    expect(blanked).toContain("import");
    expect(blanked).toContain("Button");
  });

  it("blanks a real regex literal without eating the next line's division", () => {
    const source = "const pattern = /a\\/b/;\nconst ratio = width / height;";
    const blanked = blankSource(source);
    expect(blanked).not.toContain("pattern = /a");
    expect(blanked).toContain("width / height");
  });

  it("treats a slash after a closing brace as division, not as a regex opener", () => {
    const source = "const ratio = {a:1} / days / 7;";
    expect(blankSource(source)).toBe(source);
  });
});

describe("scanSource", () => {
  it("finds a single-line named import", () => {
    expect(scanSource('import { Button } from "@zevaui/components";')).toEqual([
      { specifier: "@zevaui/components", names: ["Button"] },
    ]);
  });

  it("finds a multi-line named import", () => {
    const source = 'import {\n  Button,\n  Card,\n} from "@zevaui/components";';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Button", "Card"] },
    ]);
  });

  it("reports an aliased import under its real (DS-exported) name", () => {
    expect(scanSource('import { Button as Btn } from "@zevaui/components";')).toEqual([
      { specifier: "@zevaui/components", names: ["Button"] },
    ]);
  });

  it("strips an inline `type` modifier but keeps its sibling value import", () => {
    const source = 'import { type Variant, Button } from "@zevaui/components";';
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/components", names: ["Button"] }]);
  });

  it("drops a whole `import type { ... }` declaration entirely", () => {
    const source = 'import type { ButtonProps } from "@zevaui/components";';
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/components", names: [] }]);
  });

  it("does not resolve names for a namespace import", () => {
    expect(scanSource('import * as Zui from "@zevaui/components";')).toEqual([
      { specifier: "@zevaui/components", names: [] },
    ]);
  });

  it("does not match a dynamic import() call (no `from` clause)", () => {
    const source = 'const mod = await import("@zevaui/components");';
    expect(scanSource(source)).toEqual([]);
  });

  it("ignores an import commented out", () => {
    const source = '// import { Ghost } from "@zevaui/components";';
    expect(scanSource(source)).toEqual([]);
  });

  it("ignores an import-shaped string literal", () => {
    const source = "const s = 'import { Ghost } from \"@zevaui/components\";';";
    expect(scanSource(source)).toEqual([]);
  });

  it("matches the tracked specifier by exact equality, never by prefix", () => {
    const source =
      'import "@zevaui/components/styles.css";\n' +
      'import manifest from "@zevaui/components/components.manifest.json";';
    expect(scanSource(source)).toEqual([]);
  });

  it("ignores a real import from an unrelated package", () => {
    expect(scanSource('import { Button } from "some-unrelated-package";')).toEqual([]);
  });

  it("extracts names from @zevaui/tokens too (build-report projects only components)", () => {
    const source = 'import { spacingScale } from "@zevaui/tokens";';
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/tokens", names: ["spacingScale"] }]);
  });

  it("records a side-effect import with no names", () => {
    expect(scanSource('import "@zevaui/components";')).toEqual([
      { specifier: "@zevaui/components", names: [] },
    ]);
  });

  it("finds a named import written with no terminating semicolon (ASI)", () => {
    expect(scanSource('import { Button } from "@zevaui/components"')).toEqual([
      { specifier: "@zevaui/components", names: ["Button"] },
    ]);
  });

  it("finds a semicolon-free import followed by more semicolon-free code", () => {
    const source =
      'import { Button } from "@zevaui/components"' + "\n\nexport const App = () => Button\n";
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/components", names: ["Button"] }]);
  });

  it("finds every declaration form in a wholly semicolon-free file", () => {
    const source =
      'import { Button } from "@zevaui/components"\n' +
      'import { spacingScale } from "@zevaui/tokens"\n' +
      'import Zui from "@zevaui/components"\n' +
      'import * as All from "@zevaui/components"\n' +
      'import Default, { Card } from "@zevaui/components"\n';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Button"] },
      { specifier: "@zevaui/tokens", names: ["spacingScale"] },
      { specifier: "@zevaui/components", names: [] },
      { specifier: "@zevaui/components", names: [] },
      { specifier: "@zevaui/components", names: ["Card"] },
    ]);
  });

  it("finds a multi-line named import with no terminating semicolon", () => {
    const source = 'import {\n  Button,\n  Card,\n} from "@zevaui/components"\n';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Button", "Card"] },
    ]);
  });

  it("drops a semicolon-free type-only declaration entirely", () => {
    const source = 'import type { ButtonProps } from "@zevaui/components"';
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/components", names: [] }]);
  });

  it("does not let a non-declaration import reach forward into a later from clause", () => {
    const source =
      "const here = import.meta.url\n" + 'import { Button } from "@zevaui/components"\n';
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/components", names: ["Button"] }]);
  });

  // A comment inside a named list is ordinary code that people write. The
  // list is captured from the ORIGINAL source, where an unblanked comment
  // rides in the same comma-separated chunk as the name after it — and takes
  // that name down with it. Silent undercount, exit 0, nobody the wiser.
  it("keeps every name when a line comment trails a comma inside the list", () => {
    const source = 'import {\n  Button, // the button\n  Card,\n} from "@zevaui/components";';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Button", "Card"] },
    ]);
  });

  it("keeps every name when a line comment sits on its own line inside the list", () => {
    const source = 'import {\n  // the button\n  Button,\n  Card,\n} from "@zevaui/components";';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Button", "Card"] },
    ]);
  });

  it("keeps every name when a block comment sits between two names", () => {
    const source = 'import { Button, /* why */ Card } from "@zevaui/components";';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Button", "Card"] },
    ]);
  });

  it("keeps every name when a comment sits inside a semicolon-free list", () => {
    const source = 'import {\n  Button, // the button\n  Card,\n} from "@zevaui/components"\n';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Button", "Card"] },
    ]);
  });

  // Barrel re-exports moved from the RF-UAW05 ceiling into scope: a consumer
  // whose components flow through its own barrel (`export { Button } from
  // "@zevaui/components"`) uses those components exactly as much as one that
  // imports them, and the old tripwires asserting absence undercounted real
  // adoption (the gap ADR-0009 D5 records the reliability lens finding).
  it("detects a barrel re-export's names like an import's", () => {
    expect(scanSource('export { Button } from "@zevaui/components";')).toEqual([
      { specifier: "@zevaui/components", names: ["Button"] },
    ]);
  });

  it("reports an aliased re-export under its real (DS-exported) name", () => {
    expect(scanSource('export { Button as FancyButton } from "@zevaui/components";')).toEqual([
      { specifier: "@zevaui/components", names: ["Button"] },
    ]);
  });

  it("strips an inline `type` modifier in a re-export list, keeps the value sibling", () => {
    const source = 'export { type ButtonProps, Button } from "@zevaui/components";';
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/components", names: ["Button"] }]);
  });

  it("drops a whole `export type { ... }` re-export's names entirely", () => {
    const source = 'export type { ButtonProps } from "@zevaui/components";';
    expect(scanSource(source)).toEqual([{ specifier: "@zevaui/components", names: [] }]);
  });

  it("records a star re-export at specifier level only, with or without a semicolon", () => {
    const source = 'export * from "@zevaui/components";\nexport * from "@zevaui/tokens"\n';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: [] },
      { specifier: "@zevaui/tokens", names: [] },
    ]);
  });

  it("records a namespace star re-export at specifier level only", () => {
    expect(scanSource('export * as Zui from "@zevaui/components";')).toEqual([
      { specifier: "@zevaui/components", names: [] },
    ]);
  });

  it("does not detect a local export with no from clause", () => {
    const source = "export { Button }\nexport const x = 1\nexport default Button\n";
    expect(scanSource(source)).toEqual([]);
  });

  it("ignores a re-export from an unrelated package", () => {
    expect(scanSource('export { Button } from "some-unrelated-package";')).toEqual([]);
  });

  it("finds both a re-export and an import in the same file", () => {
    const source =
      'export { Menu } from "@zevaui/components";\nimport { Button } from "@zevaui/components";';
    expect(scanSource(source)).toEqual([
      { specifier: "@zevaui/components", names: ["Menu"] },
      { specifier: "@zevaui/components", names: ["Button"] },
    ]);
  });

  it("ignores a re-export commented out or inside a string literal", () => {
    const source =
      '// export { Ghost } from "@zevaui/components";\n' +
      "const s = 'export { Ghost } from \"@zevaui/components\";';";
    expect(scanSource(source)).toEqual([]);
  });

  it("exposes the tracked specifier set for reuse", () => {
    expect(TRACKED_SPECIFIERS.has("@zevaui/components")).toBe(true);
    expect(TRACKED_SPECIFIERS.has("@zevaui/tokens")).toBe(true);
    expect(TRACKED_SPECIFIERS.has("react")).toBe(false);
  });
});
