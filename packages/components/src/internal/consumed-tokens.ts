// Resolves which upstream @zevaui/tokens custom properties a SINGLE component consumes, from
// the emitted stylesheet. Scoping matters: a package-wide scan of dist/styles.css happens to be
// right while only one component ships, and is wrong the moment a second one does — Button
// would claim Dialog's --zui-shadow-modal.
//
// Two hops are needed because Panda never emits `var(--zui-*)` inside a component rule: the
// recipe rules reference the prefixed `var(--zuip-*)` bridge, and the token layer declares
// `--zuip-x: var(--zui-y)`. So this selects the rule blocks belonging to the component's own
// class names, then walks each `--zuip-*` reference back through the bridge.

// A class name ends where an identifier character stops, so `.zui-card` never matches
// `.zui-card-header` and never swallows a sibling component's rules.
const CLASS_NAME_BOUNDARY = "(?![A-Za-z0-9_-])";

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches `className` used as a whole class inside a selector, wherever in the selector it sits.
 *
 * Exported because the CSS and manifest gates need exactly this question answered — "is this
 * class styled?" — and a looser `\.<class>\s*\{` misses any rule Panda collapsed into a shared
 * comma-separated selector list, while a looser boundary would let `.zui-card` claim
 * `.zui-card-header`'s rules. Slot class names make both traps easy to fall into.
 */
export const classSelectorPattern = (className: string): RegExp =>
  new RegExp(`\\.${escapeForRegExp(className)}${CLASS_NAME_BOUNDARY}`);

/** `--zuip-x: var(--zui-y)` bridge declarations, wherever the emitted CSS declares them. */
function bridgeDeclarations(css: string): Map<string, string> {
  const bridge = new Map<string, string>();
  for (const match of css.matchAll(/(--zuip-[a-z0-9-]+)\s*:\s*var\((--zui-[a-z0-9-]+)\)/g)) {
    bridge.set(match[1], match[2]);
  }
  return bridge;
}

/** Raw contents between the matching braces of the block opening at `openBraceIndex`. */
function blockAt(css: string, openBraceIndex: number): string {
  let depth = 0;
  for (let i = openBraceIndex; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") {
      depth -= 1;
      if (depth === 0) return css.slice(openBraceIndex + 1, i);
    }
  }
  throw new Error("emitted CSS has a rule block with no matching closing brace");
}

/**
 * The sorted `--zui-*` tokens referenced by the rules of `classNames` only.
 *
 * @param css - the emitted stylesheet (`dist/styles.css`).
 * @param classNames - every class the component can render, base plus variant derivatives.
 */
export function consumedTokens(css: string, classNames: readonly string[]): string[] {
  const bridge = bridgeDeclarations(css);
  const selectorMatchers = classNames.map(classSelectorPattern);

  const tokens = new Set<string>();
  // A selector is everything since the previous brace, either kind. The
  // obvious /([^{}]*)\{/g spelling of that is super-linear (Sonar S8786):
  // inside a huge brace-free rule body every position retries the scan to
  // the body's end, and the manifest test's 64 KiB body took ~3 s. One
  // explicit pass tracks the same segment boundary in linear time.
  let segmentStart = 0;
  for (let i = 0; i < css.length; i += 1) {
    const ch = css[i];
    if (ch === "}") {
      segmentStart = i + 1;
      continue;
    }
    if (ch !== "{") continue;
    const selectorText = css.slice(segmentStart, i);
    segmentStart = i + 1;
    if (!selectorMatchers.some((matcher) => matcher.test(selectorText))) continue;

    const body = blockAt(css, i);
    for (const reference of body.matchAll(/var\((--zuip-[a-z0-9-]+)\)/g)) {
      const upstream = bridge.get(reference[1]);
      if (upstream !== undefined) tokens.add(upstream);
    }
    // A rule is free to reference the upstream contract directly; count that too.
    for (const reference of body.matchAll(/var\((--zui-[a-z0-9-]+)\)/g)) {
      tokens.add(reference[1]);
    }
  }
  // UTF-16 code-unit order, explicit (Sonar S2871) — same defect class as the
  // audit report's component sort, fixed the same way. Not localeCompare:
  // token lists feed assertions against committed expectations, and an
  // ICU-dependent order would let two honest environments disagree.
  return [...tokens].sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}
