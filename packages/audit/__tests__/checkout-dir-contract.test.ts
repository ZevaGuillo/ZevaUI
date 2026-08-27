// ADR-0009 D4: `.zevaui-audit` is a CONTRACT between the workflow YAML and the
// scanner. The workflow checks this design system out INSIDE the consumer's
// workspace; `WORKFLOW_DS_CHECKOUT_DIR` in walk-source-tree.js is what prunes
// that directory from the walk. Change one side without the other and every
// consumer's report silently gains our own components (measured: a consumer
// using only Button got back Alert, Button, Dialog).
//
// The constant's pruning behavior is unit-covered in walk-source-tree.test.ts;
// what nothing gated until now is the IDENTITY between the constant and the
// YAML text. These are structural gates over the workflow text, not a YAML
// parser: @zevaui/audit is dependency-free by contract, the same reason the
// permissions and no-network-imports gates are hand-written.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WORKFLOW_DS_CHECKOUT_DIR } from "../scripts/walk-source-tree.js";

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
const directives = lines.filter((line) => !line.trimStart().startsWith("#"));

describe("audit-ds-usage.yml checkout-dir contract (ADR-0009 D4)", () => {
  it("checks the design system out at exactly WORKFLOW_DS_CHECKOUT_DIR", () => {
    // The DS checkout is the step that names this repository. Its `path:` is
    // the one directive the scanner's pruning depends on.
    const dsCheckoutIndex = directives.findIndex((line) =>
      line.trimStart().startsWith("repository: ZevaGuillo/ZevaUI"),
    );
    expect(dsCheckoutIndex).toBeGreaterThan(-1);

    const followingBlock = directives.slice(dsCheckoutIndex, dsCheckoutIndex + 4);
    expect(followingBlock.some((line) => line.trim() === `path: ${WORKFLOW_DS_CHECKOUT_DIR}`)).toBe(
      true,
    );
  });

  it("invokes every scanner script through WORKFLOW_DS_CHECKOUT_DIR", () => {
    // The run: lines that execute audit scripts resolve them under the same
    // directory the checkout created. A rename that misses one of these fails
    // at runtime in every consumer, not here at home.
    const scriptInvocations = directives.filter((line) => line.includes("packages/audit/scripts/"));

    expect(scriptInvocations.length).toBeGreaterThan(0);
    for (const line of scriptInvocations) {
      expect(line).toContain(`node ${WORKFLOW_DS_CHECKOUT_DIR}/packages/audit/scripts/`);
    }
  });

  it("never mentions the checkout dir in a directive under any other spelling", () => {
    // The two gates above pin the load-bearing sites. This one catches the
    // future site: any directive referencing the checkout dir must use the
    // constant's exact spelling, so a partial rename cannot leave a stale
    // reference behind a step this file does not know about yet.
    const spelledOut = directives.filter((line) => /zevaui-audit/i.test(line));
    for (const line of spelledOut) {
      expect(line).toContain(WORKFLOW_DS_CHECKOUT_DIR);
    }
  });
});
