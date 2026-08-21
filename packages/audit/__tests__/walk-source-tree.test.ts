import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_SCANNED_FILES, walkAndScan } from "../scripts/walk-source-tree.js";

type FakeEntry = {
  name: string;
  kind: "file" | "dir" | "symlink" | "other";
  contents?: string;
  size?: number;
};

type FakeTree = Record<string, FakeEntry[] | "unreadable">;

// A fake filesystem, because the two skip paths under test cannot be produced
// portably: this repo's Windows dev machines refuse symlinkSync with EPERM,
// and an unreadable directory has no portable recipe at all. A test that only
// runs on one OS would leave exactly the paths that lied still unproven.
function fakeIo(tree: FakeTree) {
  const at = (dir: string) => tree[dir.split(path.sep).join("/")];
  // Indexed by name, not scanned linearly: the overflow case builds 20001
  // entries and a per-lookup scan would make the fake quadratic, timing out
  // the test for a reason that has nothing to do with the walk.
  const byName = new Map<string, Map<string, FakeEntry>>();
  for (const [dir, entries] of Object.entries(tree)) {
    if (entries === "unreadable") continue;
    byName.set(dir, new Map(entries.map((entry) => [entry.name, entry])));
  }
  const findEntry = (filePath: string) =>
    byName.get(path.dirname(filePath).split(path.sep).join("/"))?.get(path.basename(filePath));

  return {
    readdirSync(dir: string) {
      const entries = at(dir);
      if (entries === undefined) throw new Error(`ENOENT: ${dir}`);
      if (entries === "unreadable") throw new Error(`EACCES: ${dir}`);
      return entries.map((entry) => ({
        name: entry.name,
        isSymbolicLink: () => entry.kind === "symlink",
        isDirectory: () => entry.kind === "dir",
        isFile: () => entry.kind === "file",
      }));
    },
    statSync(filePath: string) {
      return { size: findEntry(filePath)?.size ?? 0 };
    },
    readFileSync(filePath: string) {
      const entry = findEntry(filePath);
      if (entry?.contents === undefined) throw new Error(`EIO: ${filePath}`);
      return entry.contents;
    },
  };
}

const IMPORT_LINE = 'import { Button } from "@zevaui/components";\n';

describe("walkAndScan", () => {
  it("scans ordinary source files and returns their tracked imports", () => {
    const io = fakeIo({
      "/repo": [{ name: "a.tsx", kind: "file", contents: IMPORT_LINE, size: 40 }],
    });

    const { imports, skipped } = walkAndScan("/repo", io);

    expect(imports).toEqual([{ specifier: "@zevaui/components", names: ["Button"] }]);
    expect(skipped).toEqual([]);
  });

  // The whole point: an unscanned file must be NAMED. The step summary's
  // "skipped files" count is the only signal a consumer ever sees, so a skip
  // that never reaches this array is an audit that under-reports and looks
  // clean doing it.
  it("names a symlinked source file instead of dropping it silently", () => {
    const io = fakeIo({
      "/repo": [
        { name: "real.tsx", kind: "file", contents: IMPORT_LINE, size: 40 },
        { name: "link.tsx", kind: "symlink" },
      ],
    });

    const { imports, skipped } = walkAndScan("/repo", io);

    expect(imports).toHaveLength(1);
    expect(skipped).toEqual(["link.tsx"]);
  });

  it("names a symlinked directory instead of dropping the whole subtree silently", () => {
    const io = fakeIo({
      "/repo": [{ name: "linked", kind: "symlink" }],
    });

    expect(walkAndScan("/repo", io).skipped).toEqual(["linked"]);
  });

  it("names an unreadable directory instead of dropping it silently", () => {
    const io = fakeIo({
      "/repo": [
        { name: "ok", kind: "dir" },
        { name: "denied", kind: "dir" },
      ],
      "/repo/ok": [{ name: "a.tsx", kind: "file", contents: IMPORT_LINE, size: 40 }],
      "/repo/denied": "unreadable",
    });

    const { imports, skipped } = walkAndScan("/repo", io);

    expect(imports).toHaveLength(1);
    expect(skipped).toEqual(["denied"]);
  });

  it("names an entry that is neither a file nor a directory", () => {
    const io = fakeIo({ "/repo": [{ name: "a.sock", kind: "other" }] });

    expect(walkAndScan("/repo", io).skipped).toEqual(["a.sock"]);
  });

  // Pruned directories and non-allowlisted extensions are DELIBERATE
  // exclusions, documented and stable. Counting them would drown the signal
  // that "skipped" exists to carry: things we could not read.
  it("does not count a pruned directory or a non-allowlisted file as skipped", () => {
    const io = fakeIo({
      "/repo": [
        { name: "node_modules", kind: "dir" },
        { name: "notes.mdx", kind: "file", contents: IMPORT_LINE, size: 40 },
        { name: "a.tsx", kind: "file", contents: IMPORT_LINE, size: 40 },
      ],
      "/repo/node_modules": [{ name: "ghost.tsx", kind: "file", contents: IMPORT_LINE, size: 40 }],
    });

    const { imports, skipped } = walkAndScan("/repo", io);

    expect(imports).toHaveLength(1);
    expect(skipped).toEqual([]);
  });

  it("names a file that is over the size cap", () => {
    const io = fakeIo({
      "/repo": [{ name: "huge.tsx", kind: "file", contents: IMPORT_LINE, size: 5 * 1024 * 1024 }],
    });

    const { imports, skipped } = walkAndScan("/repo", io);

    expect(imports).toEqual([]);
    expect(skipped).toEqual(["huge.tsx"]);
  });

  it("names a file it could not read", () => {
    const io = fakeIo({ "/repo": [{ name: "a.tsx", kind: "file", size: 40 }] });

    expect(walkAndScan("/repo", io).skipped).toEqual(["a.tsx"]);
  });

  it("signals overflow rather than reporting a partial scan as a whole one", () => {
    const entries: FakeEntry[] = Array.from({ length: MAX_SCANNED_FILES + 1 }, (_, index) => ({
      name: `f${index}.tsx`,
      kind: "file" as const,
      contents: IMPORT_LINE,
      size: 40,
    }));

    expect(walkAndScan("/repo", fakeIo({ "/repo": entries })).overflowed).toBe(true);
  });

  it("does not signal overflow for an ordinary tree", () => {
    const io = fakeIo({
      "/repo": [{ name: "a.tsx", kind: "file", contents: IMPORT_LINE, size: 40 }],
    });

    expect(walkAndScan("/repo", io).overflowed).toBe(false);
  });
});
