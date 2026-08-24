import { describe, expect, it } from "vitest";
import { parseChangelog } from "../src/release-log/parse-changelog";

const SAMPLE = `# @zevaui/components

## 0.2.0

### Minor Changes

- 34dbdd3: Initial public release of the ZevaUI packages.

  - \`@zevaui/tokens\` — single source of truth for design tokens.
  - \`@zevaui/components\` — six core React components.

## 0.1.0

### Minor Changes

- aaa965d: Adds a bundle-size budget gate for RNF-02. Some more detail here
  that continues onto a second, indented line.
- Adds a second bullet with no commit-hash prefix at all.

### Patch Changes

- Updated dependencies [34dbdd3]
  - @zevaui/tokens@0.2.0
`;

describe("parseChangelog (RF-AP02: release log derived from committed CHANGELOG.md files)", () => {
  it("parses each version section and its top-level bullets, grouped by change type", () => {
    const result = parseChangelog(SAMPLE, "@zevaui/components");
    expect(result.package).toBe("@zevaui/components");
    expect(result.releases).toHaveLength(2);
    expect(result.releases[0]).toEqual({
      version: "0.2.0",
      changes: [{ type: "minor", text: "Initial public release of the ZevaUI packages." }],
    });
  });

  it("strips a leading commit-hash prefix but keeps a bullet with none", () => {
    const result = parseChangelog(SAMPLE, "@zevaui/components");
    const minorChanges = result.releases[1].changes.filter((change) => change.type === "minor");
    expect(minorChanges).toEqual([
      { type: "minor", text: "Adds a bundle-size budget gate for RNF-02. Some more detail here" },
      { type: "minor", text: "Adds a second bullet with no commit-hash prefix at all." },
    ]);
  });

  it("does not surface indented continuation/nested-list lines as separate changes", () => {
    const result = parseChangelog(SAMPLE, "@zevaui/components");
    const allText = result.releases.flatMap((release) => release.changes.map((c) => c.text));
    expect(allText.some((text) => text.includes("@zevaui/tokens@0.2.0"))).toBe(false);
  });

  it("groups Patch Changes separately from Minor Changes within the same version", () => {
    const result = parseChangelog(SAMPLE, "@zevaui/components");
    const patchChanges = result.releases[1].changes.filter((change) => change.type === "patch");
    expect(patchChanges).toEqual([{ type: "patch", text: "Updated dependencies [34dbdd3]" }]);
  });

  it("returns an empty releases array for a package with no version sections", () => {
    expect(parseChangelog("# @zevaui/empty\n", "@zevaui/empty")).toEqual({
      package: "@zevaui/empty",
      releases: [],
    });
  });
});
