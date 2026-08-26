// This workflow declares NO top-level `permissions:` block, and that is a
// decision, not an omission. Both alternatives were measured against a real
// consumer, and both are broken:
//
//   permissions: contents: read, id-token: write
//     -> `startup_failure` in 2s for every caller that did not grant
//        id-token. A reusable workflow requesting more than its caller holds
//        is refused outright; there is no silent intersection.
//
//   permissions: contents: read
//     -> starts fine, but a caller that DOES grant id-token still cannot get
//        one: the called workflow's block decides what its jobs actually
//        receive, not merely a ceiling. `core.getIDToken()` fails with
//        "Unable to get ACTIONS_ID_TOKEN_REQUEST_URL", so opting into
//        submission (RF-AR06) can never work.
//
// With no block at all, the jobs inherit whatever the caller granted, and
// both consumers work: the one who adds nothing starts and skips submission,
// the one who grants id-token mints a token and submits. The cost is that a
// caller granting broad permissions passes them in, which is why this file
// does nothing with write scopes and checks out with persist-credentials:
// false.
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
 * Whether an unindented `key:` exists at the top level. Matched on the line
 * itself rather than anywhere in the text, so the consumer-facing
 * `permissions:` snippet inside this workflow's comments -- which has to stay
 * there, it is the instruction an opting-in caller follows -- does not count.
 */
function hasTopLevelBlock(key: string): boolean {
  return lines.includes(`${key}:`);
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

describe("audit-ds-usage.yml permissions contract (M.4/M.5 regression)", () => {
  it("declares no top-level permissions block, so jobs inherit the caller's grant", () => {
    // Both ways of writing this block were measured against a real consumer
    // and both broke a consumer -- see the header. Anything here caps what the
    // jobs receive, and there is no value that serves an opting-in caller and
    // a non-opting one at the same time.
    expect(hasTopLevelBlock("permissions")).toBe(false);
  });

  it("does not grant itself write scopes anywhere, since it now inherits them", () => {
    // Inheriting is what makes both consumers work, and it is also why this
    // file must not quietly start using a scope a broad caller happens to
    // pass in. Both checkouts drop the caller's credentials.
    // Directives only. The header explains this same setting in prose, and a
    // gate that counts its own documentation is a gate that fires on an edit
    // to a comment.
    const directives = lines.filter((line) => !line.trimStart().startsWith("#"));
    const persistCredentials = directives.filter((line) =>
      line.includes("persist-credentials: false"),
    );

    expect(persistCredentials).toHaveLength(2);
    expect(directives.some((line) => /\b(contents|packages|actions):\s*write/.test(line))).toBe(
      false,
    );
  });

  it("lets the OIDC minting step fail without failing the job", () => {
    // A consumer that sets registry-url without granting id-token makes this
    // step throw. Fire-and-tolerate (D6) says that costs a warning, never the
    // build: the step tolerates its own failure, the token output comes back
    // empty, and submit-report.js already warns and returns on an empty
    // token. Measured end to end -- the run stayed green and warned
    // "no OIDC token was available for the registry audience".
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
