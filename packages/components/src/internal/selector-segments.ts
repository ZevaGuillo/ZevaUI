// Splits a stylesheet into the head of every rule it opens — the one question the CSS gates and
// the token resolver both need answered before they can ask anything else.

/** A rule's head, and the position of the brace that opens its block. */
export type SelectorSegment = {
  /** Everything since the previous brace of either kind: the selector, or an at-rule head. */
  readonly selector: string;
  /** Index of the `{` this head opens, so a caller can read the block that follows. */
  readonly openBraceIndex: number;
};

/**
 * Every rule head in `css`, in source order, in ONE LINEAR PASS.
 *
 * THE OBVIOUS SPELLING OF THIS IS A PERFORMANCE BUG, and it has bitten this package twice.
 * `/([^{}]*)\{/g` is super-linear (Sonar S8786): inside a large brace-free rule body every
 * position retries the scan to the body's end. The manifest test's 64 KiB body took ~3 s that
 * way, and the same regex in the CSS gates cost O(classes x stylesheet) because it was re-run per
 * class — ~159 classes against ~23 KB, which timed out at Vitest's 5 s default on CI.
 *
 * The failure grows with the component count, so both times the fix that lasts is this one:
 * track the segment boundary explicitly, and hand callers the heads to filter.
 *
 * A closing brace resets the boundary, which is what keeps a rule BODY from bleeding into the
 * next rule's head. A head is returned WHOLE, comma-separated lists included, because Panda
 * collapses rules that share a declaration block into one list and a class is styled when it
 * appears anywhere in that list.
 */
export function selectorSegments(css: string): SelectorSegment[] {
  const segments: SelectorSegment[] = [];
  let segmentStart = 0;

  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "}") {
      segmentStart = i + 1;
      continue;
    }
    if (ch !== "{") continue;

    segments.push({ selector: css.slice(segmentStart, i), openBraceIndex: i });
    segmentStart = i + 1;
  }

  return segments;
}
