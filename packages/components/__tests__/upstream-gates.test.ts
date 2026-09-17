// @vitest-environment jsdom
//
// G13 exists because `Toast` is the first component in this package built on an upstream export
// react-aria-components has NOT stabilised. Measured in the real `.d.ts`, not assumed, and
// measured twice — in the installed 1.20.0 and in 1.21.1, the newest published release:
//
//   export { UNSTABLE_Toast, UNSTABLE_ToastList, UNSTABLE_ToastRegion,
//            UNSTABLE_ToastContent, UNSTABLE_ToastStateContext } from '../src/Toast';
//   export { ToastQueue as UNSTABLE_ToastQueue } from 'react-stately/useToastState';
//
// Every RUNTIME toast export carries the prefix; only the TYPES are exported unprefixed. Adobe
// uses `UNSTABLE_` for exactly what it says — these names may change or disappear in a minor
// release, which semver would otherwise forbid for a stable export.
//
// That is a risk this package accepts deliberately rather than stumbles into. What it must not
// accept is the risk floating: `react-aria-components` is a direct DEPENDENCY here, so with an
// open-ended range a consumer installing @zevaui/components resolves whatever minor is newest on
// the day, and the day Adobe drops `UNSTABLE_Toast` that consumer's install breaks without this
// package publishing anything at all. Two assertions, one for each half of that sentence.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as reactAriaComponents from "react-aria-components";
import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));

const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};

/**
 * The exact names `toast/` imports. Listed here rather than derived from the import site, because
 * a gate that derived its expectations from the code it guards would pass by construction — it
 * would only ever assert that what is imported is what is imported.
 *
 * The cost of hand-listing is that the list can fall BEHIND the imports, and it already did once:
 * `UNSTABLE_ToastList` was missing while `ToastRegion.tsx` imported and rendered it, which left
 * the one export this gate did not name free to disappear in a minor without CI noticing. So the
 * two import sites are named here, and adding a sixth `UNSTABLE_` import to either one means
 * adding it here too: `ToastRegion.tsx` takes `Toast`, `ToastContent`, `ToastList` and
 * `ToastRegion`; `toast-queue.ts` takes `ToastQueue`.
 */
const REQUIRED_UNSTABLE_EXPORTS = [
  "UNSTABLE_Toast",
  "UNSTABLE_ToastContent",
  "UNSTABLE_ToastList",
  "UNSTABLE_ToastQueue",
  "UNSTABLE_ToastRegion",
] as const;

describe("G13: the unstable upstream this package builds Toast on", () => {
  // The loud failure. When Adobe renames or removes these, this breaks in CI with a message that
  // names the missing export — instead of a `TypeError: undefined is not a function` inside a
  // consumer's app, which is where it would otherwise surface first.
  it.each(REQUIRED_UNSTABLE_EXPORTS)("still exports %s", (name) => {
    expect({ [name]: typeof (reactAriaComponents as Record<string, unknown>)[name] }).not.toEqual({
      [name]: "undefined",
    });
  });

  // THE ASSERTION THAT PROTECTS A CONSUMER RATHER THAN THIS REPO. The gate above runs in CI
  // against whatever is in the lockfile; it cannot see what a consumer resolves months from now.
  // Only a closed range can, so the range must HAVE an upper bound — `^1.20.0` does not, it
  // admits every future 1.x.
  //
  // The cost is real and was accepted knowingly: this bound applies to the whole package, not
  // just Toast, so RAC patch and minor releases stop arriving on their own and have to be taken
  // deliberately. That is the trade for not letting an unstable import float.
  it("pins react-aria-components to a range with an upper bound", () => {
    const range = manifest.dependencies?.["react-aria-components"] ?? "";
    expect({ range, bounded: range.includes("<") }).toEqual({ range, bounded: true });
  });
});
