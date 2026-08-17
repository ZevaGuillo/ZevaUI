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
  const selectorMatchers = classNames.map(
    (className) => new RegExp(`\\.${escapeForRegExp(className)}${CLASS_NAME_BOUNDARY}`),
  );

  const tokens = new Set<string>();
  for (const match of css.matchAll(/([^{}]*)\{/g)) {
    const selectorText = match[1];
    if (!selectorMatchers.some((matcher) => matcher.test(selectorText))) continue;

    const body = blockAt(css, (match.index ?? 0) + match[0].length - 1);
    for (const reference of body.matchAll(/var\((--zuip-[a-z0-9-]+)\)/g)) {
      const upstream = bridge.get(reference[1]);
      if (upstream !== undefined) tokens.add(upstream);
    }
    // A rule is free to reference the upstream contract directly; count that too.
    for (const reference of body.matchAll(/var\((--zui-[a-z0-9-]+)\)/g)) {
      tokens.add(reference[1]);
    }
  }
  return [...tokens].sort();
}
