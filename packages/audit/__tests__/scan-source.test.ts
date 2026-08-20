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
    const source = 'const s = \'import { Ghost } from "@zevaui/components";\';';
    const blanked = blankSource(source);
    expect(blanked).not.toContain("import");
  });

  it("blanks a template literal, including a nested ${} interpolation", () => {
    const source =
      "const s = `outer ${`inner import { Ghost } from \"@zevaui/components\"`} end`;";
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
    const source = 'const s = \'import { Ghost } from "@zevaui/components";\';';
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

  it("exposes the tracked specifier set for reuse", () => {
    expect(TRACKED_SPECIFIERS.has("@zevaui/components")).toBe(true);
    expect(TRACKED_SPECIFIERS.has("@zevaui/tokens")).toBe(true);
    expect(TRACKED_SPECIFIERS.has("react")).toBe(false);
  });
});
