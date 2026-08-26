// M.4 found this the expensive way: a reusable workflow that declares
// `id-token: write` at workflow level does NOT quietly intersect with the
// caller's permissions. GitHub refuses the run outright -- `startup_failure`
// in two seconds, before a single step -- for every caller that did not grant
// it. A consumer who never opts into submission was paying for a feature it
// never asked for, with a red build.
//
// These are structural gates over the workflow text, not a YAML parser:
// @zevaui/audit is dependency-free by contract, the same reason the
// no-network-imports and tenant-name gates are hand-written.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.join(
  dirname,
  "..",
  "..",
  "..",
  ".github",
  "workflows",
  "audit-ds-usage.yml",
);
const workflow = readFileSync(workflowPath, "utf8");
const lines = workflow.split(/\r?\n/);

/**
 * The lines of a top-level block, by its unindented key. Comments and blank
 * lines are dropped so a gate never matches prose -- `id-token` is discussed
 * at length in this file's comments, and must be able to be, because the
 * consumer-facing instructions live there.
 */
function topLevelBlock(key: string): string[] {
  const start = lines.indexOf(`${key}:`);
  if (start === -1) throw new Error(`no top-level \`${key}:\` block in ${workflowPath}`);
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    if (!line.startsWith(" ")) break;
    body.push(line);
  }
  return body;
}

/** The lines of the step whose `- name:` matches, up to the next step. */
function stepBlock(nameFragment: string): string[] {
  const start = lines.findIndex(
    (line) => line.trimStart().startsWith("- name:") && line.includes(nameFragment),
  );
  if (start === -1) throw new Error(`no step named like "${nameFragment}" in ${workflowPath}`);
  const indent = lines[start].length - lines[start].trimStart().length;
  const body = [lines[start]];
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trimStart();
    const isNextStep = trimmed.startsWith("- ") && line.length - trimmed.length === indent;
    if (isNextStep) break;
    body.push(line);
  }
  return body;
}

describe("audit-ds-usage.yml permissions contract (M.4 regression)", () => {
  it("does not request id-token at workflow level, so a caller that never opts in still starts", () => {
    const permissions = topLevelBlock("permissions");

    expect(permissions.length).toBeGreaterThan(0);
    expect(permissions.some((line) => line.includes("id-token"))).toBe(false);
  });

  it("still requests contents: read, so the gate above cannot be satisfied by deleting the block", () => {
    expect(topLevelBlock("permissions").some((line) => line.includes("contents: read"))).toBe(true);
  });

  it("lets the OIDC minting step fail without failing the job", () => {
    // With id-token no longer granted by this workflow, a consumer that sets
    // registry-url WITHOUT granting the permission makes this step throw.
    // Fire-and-tolerate (D6) says that costs a warning, never the build:
    // the step tolerates its own failure, the token output comes back empty,
    // and submit-report.js already warns and exits 0 on an empty token.
    const step = stepBlock("Mint an OIDC token");

    expect(step.some((line) => line.includes("continue-on-error: true"))).toBe(true);
  });

  it("keeps both submission steps behind the opt-in guard", () => {
    for (const name of ["Mint an OIDC token", "Submit usage report to the registry"]) {
      expect(stepBlock(name).some((line) => line.includes("if: inputs.registry-url != ''"))).toBe(
        true,
      );
    }
  });
});
