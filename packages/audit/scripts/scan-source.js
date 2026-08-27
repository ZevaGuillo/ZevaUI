// Two-stage import scanner (design #156 D2). Stage 1 (blankSource) blanks
// comments/strings/template literals/regex literals in place,
// offset-preserving, so a decoy import hidden inside one is structurally
// gone before stage 2 looks. Stage 2 (scanSource) locates genuine `import`
// and `export` keywords in the sanitized text and re-parses each declaration
// from the ORIGINAL source at that offset — the specifier string is real
// code there. `export ... from` counts because a consumer whose components
// flow through its own barrel uses them exactly as much as one that imports
// them; asserting it absent undercounted real adoption (ADR-0009 D5).
//
// Specifier match is exact equality, never a prefix: `@zevaui/components`
// exposes `./styles.css`/`./components.manifest.json` as real subpath
// exports carrying zero components (verified) — `startsWith` would phantom.
export const TRACKED_SPECIFIERS = new Set(["@zevaui/components", "@zevaui/tokens"]);

// Keywords after which `/` opens a regex, not a division — the standard
// previous-significant-token heuristic. Residual ambiguity (e.g. after `)`
// or `}`) is what spike S-B measures against real, unplanned source.
//
// `}` is excluded, so `const ratio = {a:1} / days / 7` stays division. That
// call is deliberately asymmetric: a real regex opening a statement after a
// block `}` now goes un-blanked, but the two mistakes do not cost the same.
// Blanking real code deletes a genuine import and the audit reports success
// with a shorter list — silent, and the exact failure this whole design
// exists to prevent. Leaving a regex un-blanked can at worst surface a
// decoy import as a phantom component, which is wrong out loud and gets
// noticed. When the heuristic must guess, it guesses toward the loud error.
const REGEX_CONTEXT_KEYWORDS = new Set([
  "return",
  "typeof",
  "instanceof",
  "in",
  "of",
  "new",
  "delete",
  "void",
  "throw",
  "yield",
  "case",
  "do",
  "else",
  "extends",
  "default",
]);

/** @param {string} prevToken */
function regexAllowed(prevToken) {
  if (prevToken === "") return true;
  if (/^[A-Za-z_$][\w$]*$/.test(prevToken)) return REGEX_CONTEXT_KEYWORDS.has(prevToken);
  if (/^[0-9]/.test(prevToken)) return false;
  return ![")", "]", "}", '"', "'", "`", "/"].includes(prevToken);
}

// The lexer below is one deliberate state machine, split so each lexical
// construct owns a named consumer (Sonar S3776 counted the original single
// function at 85/15). Every consume* helper blanks exactly what it consumed
// in `out` and returns the index just past it; the shared conventions are:
// `out` is the source split into characters, and blanking preserves offsets
// and newlines so stage 2 can re-read the original at the same positions.

/**
 * @param {string[]} out
 * @param {number} from
 * @param {number} to
 */
function blankRange(out, from, to) {
  for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
}

/**
 * Stack of open `${ }` interpolations: "template" = consuming literal
 * TEXT; a number = an open expression's own unmatched-brace depth (so a
 * nested object literal's braces don't close the `${ }` early).
 *
 * @typedef {Array<"template" | number>} TemplateStack
 */

/**
 * Consumes template-literal TEXT until the closing backtick, an opening
 * `${` (pushing a fresh expression depth), or end of input.
 *
 * @param {string} source
 * @param {string[]} out
 * @param {number} i
 * @param {TemplateStack} stack
 * @returns {number}
 */
function consumeTemplateText(source, out, i, stack) {
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === "\\") {
      blankRange(out, i, i + 2);
      i += 2;
      continue;
    }
    if (ch === "`") {
      blankRange(out, i, i + 1);
      stack.pop();
      return i + 1;
    }
    if (ch === "$" && source[i + 1] === "{") {
      blankRange(out, i, i + 2);
      stack.push(0);
      return i + 2;
    }
    blankRange(out, i, i + 1);
    i += 1;
  }
  return i;
}

/**
 * Consumes the line or block comment opening at `i`, or returns -1 if `i`
 * does not open one.
 *
 * @param {string} source
 * @param {string[]} out
 * @param {number} i
 * @returns {number}
 */
function consumeComment(source, out, i) {
  if (source[i] !== "/") return -1;
  const n = source.length;
  if (source[i + 1] === "/") {
    let end = i;
    while (end < n && source[end] !== "\n") end += 1;
    blankRange(out, i, end);
    return end;
  }
  if (source[i + 1] === "*") {
    let end = i + 2;
    while (end < n && !(source[end] === "*" && source[end + 1] === "/")) end += 1;
    end = Math.min(end + 2, n);
    blankRange(out, i, end);
    return end;
  }
  return -1;
}

/**
 * Consumes the quoted string opening at `i` (its quote character is
 * `source[i]`), through the matching close or end of input.
 *
 * @param {string} source
 * @param {string[]} out
 * @param {number} i
 * @returns {number}
 */
function consumeQuotedString(source, out, i) {
  const n = source.length;
  const quote = source[i];
  let end = i + 1;
  while (end < n && source[end] !== quote) end += source[end] === "\\" ? 2 : 1;
  end = Math.min(end + 1, n);
  blankRange(out, i, end);
  return end;
}

/**
 * Consumes the regex literal opening at `i`, flags included — or returns -1
 * when the line ends with no closing `/`, meaning this was never a regex
 * and the caller must treat the `/` as an ordinary (division) character.
 *
 * @param {string} source
 * @param {string[]} out
 * @param {number} i
 * @returns {number}
 */
function consumeRegexLiteral(source, out, i) {
  const n = source.length;
  let j = i + 1;
  let inClass = false;
  while (j < n && source[j] !== "\n") {
    if (source[j] === "\\") {
      j += 2;
      continue;
    }
    if (source[j] === "[") inClass = true;
    else if (source[j] === "]") inClass = false;
    else if (source[j] === "/" && !inClass) {
      let end = j + 1;
      while (end < n && /[a-z]/i.test(source[end])) end += 1; // flags
      blankRange(out, i, end);
      return end;
    }
    j += 1;
  }
  return -1;
}

/**
 * Tracks `{`/`}` against the innermost open `${ }` expression, popping the
 * stack when its own brace depth closes. A no-op while no expression is open.
 *
 * @param {TemplateStack} stack
 * @param {string} ch
 */
function trackExpressionDepth(stack, ch) {
  const openExpressionDepth = stack[stack.length - 1];
  if (typeof openExpressionDepth !== "number") return;
  if (ch === "{") stack[stack.length - 1] = openExpressionDepth + 1;
  else if (ch === "}") {
    if (openExpressionDepth === 0) stack.pop();
    else stack[stack.length - 1] = openExpressionDepth - 1;
  }
}

/**
 * @param {string} source
 * @param {number} i
 * @returns {number} index just past the identifier/number word at `i`, or `i` itself
 */
function endOfWord(source, i) {
  let end = i;
  while (end < source.length && /[A-Za-z0-9_$]/.test(source[end])) end += 1;
  return end;
}

/**
 * Consumes one token of ordinary (non-template-text) code at `i`: a comment,
 * string, template open, regex literal, or plain character — updating
 * `prevToken`, the regex-vs-division context the next `/` will be judged by.
 *
 * @param {string} source
 * @param {string[]} out
 * @param {number} i
 * @param {TemplateStack} stack
 * @param {string} prevToken
 * @returns {{ next: number, prevToken: string }}
 */
function consumeCodeToken(source, out, i, stack, prevToken) {
  const commentEnd = consumeComment(source, out, i);
  if (commentEnd !== -1) return { next: commentEnd, prevToken };

  const ch = source[i];
  if (ch === '"' || ch === "'") {
    return { next: consumeQuotedString(source, out, i), prevToken: ch };
  }
  if (ch === "`") {
    stack.push("template");
    blankRange(out, i, i + 1);
    return { next: i + 1, prevToken };
  }
  if (ch === "/" && regexAllowed(prevToken)) {
    const regexEnd = consumeRegexLiteral(source, out, i);
    if (regexEnd !== -1) return { next: regexEnd, prevToken: "/" };
    // Ran off the line without a closing `/` — not actually a regex. Fall
    // through and treat this `/` as an ordinary (division) character.
  }

  trackExpressionDepth(stack, ch);
  if (/\s/.test(ch)) return { next: i + 1, prevToken };
  const wordEnd = endOfWord(source, i);
  if (wordEnd > i) return { next: wordEnd, prevToken: source.slice(i, wordEnd) };
  return { next: i + 1, prevToken: ch };
}

/**
 * @param {string} source
 * @returns {string} same length and line count, literals blanked in place
 */
export function blankSource(source) {
  const n = source.length;
  const out = source.split("");
  /** @type {TemplateStack} */
  const stack = [];
  let prevToken = "";
  let i = 0;

  while (i < n) {
    if (stack[stack.length - 1] === "template") {
      i = consumeTemplateText(source, out, i, stack);
      continue;
    }
    const step = consumeCodeToken(source, out, i, stack, prevToken);
    prevToken = step.prevToken;
    i = step.next;
  }

  return out.join("");
}

// The whole import clause, anchored at the `import` keyword and ending at
// the specifier's closing quote — which is where an import declaration
// actually ends. Group 1 is the named list's contents when there is one,
// group 3 the specifier.
//
//   [default ,] ( { … } | * as ns | default )  from  "specifier"
//
// The alternation's members carry their own trailing separator because only
// `}` may abut `from` with no space (`import {a}from "x"` is legal).
//
// The `d` flag is load-bearing, not decoration: `indices[1]` is what lets the
// named list be re-read from the SANITIZED text at the same offsets. See
// parseImportDeclaration.
const IMPORT_DECLARATION =
  /^\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?(?:\{([^}]*)\}\s*|\*\s*as\s+[A-Za-z_$][\w$]*\s+|[A-Za-z_$][\w$]*\s+)from\s*(["'])([^"']*)\2/d;

// Parses one `import` declaration at `start` in the ORIGINAL source, within
// a 4000-char lookahead.
//
// This used to bound the declaration at the first `;`, which silently
// dropped every import written without one — ASI style, what Prettier with
// `semi: false` and Standard both emit. That is worse than reporting
// nothing: the consumer gets an empty `components[]`, exit 0, and no
// warning. Matching the clause shape is what delimits the declaration now,
// and anchoring at `^` is what replaces the `;` as a forward bound: a
// non-declaration `import` (`import.meta.url`, a dynamic `import(...)`)
// fails at the first token and cannot reach a LATER import's `from` clause.
/**
 * @typedef {{ specifier: string, names: string[] }} ScannedImport
 */

/**
 * @param {string} source
 * @param {string} sanitized
 * @param {number} start
 * @returns {ScannedImport | null}
 */
function parseImportDeclaration(source, sanitized, start) {
  const afterImport = source.slice(start, start + 4000).slice("import".length);

  const sideEffect = /^\s*(["'])([^"']*)\1/.exec(afterImport);
  if (sideEffect) return { specifier: sideEffect[2], names: [] };

  return parseFromClause(sanitized, afterImport, start + "import".length, IMPORT_DECLARATION, {
    // dynamic import(), not a declaration — bail before the clause even runs
    rejectRest: (rest) => rest.trimStart().startsWith("("),
    flagTripwire: "IMPORT_DECLARATION lost its `d` flag; named-list offsets are gone",
  });
}

// Reads a `{ ... }` named list back out of the SANITIZED text at the very
// same offsets. Stage 1 preserves offsets precisely so this is possible, and
// this is the one place it has to be used: a comment inside the list is
// already blanked there, whereas in the ORIGINAL it rides in the same
// comma-separated chunk as the name that follows it and drags that name out
// of the report. The specifier still comes from the original, because stage 1
// blanks the quotes too and there is nothing left to read there.
//
// The alias rule reads the FIRST identifier: in `import { Button as Btn }`
// and `export { Button as FancyButton } from ...` alike, the DS-exported
// name is the one before `as` — the local binding is the consumer's business.
/**
 * @param {string} sanitized
 * @param {number} from
 * @param {number} to
 * @returns {string[]}
 */
function namesFromList(sanitized, from, to) {
  return sanitized
    .slice(from, to)
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !/^type\s/.test(entry))
    .map((entry) => {
      const alias = /^([\w$]+)\s+as\s+[\w$]+$/.exec(entry);
      return alias ? alias[1] : entry;
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));
}

// The re-export clause, anchored at the `export` keyword: `{ ... } from` or
// `* [as ns] from`, then the specifier. Same shape discipline as
// IMPORT_DECLARATION — the clause itself delimits the declaration, so
// `export const`/`export default`/a local `export { X }` with no `from` all
// fail at the clause and never reach a later declaration's specifier. The
// `d` flag serves the same offset re-read as in imports.
const RE_EXPORT_DECLARATION =
  /^\s*(?:\{([^}]*)\}\s*|\*\s*(?:as\s+[A-Za-z_$][\w$]*\s*)?)from\s*(["'])([^"']*)\2/d;

/**
 * @param {string} source
 * @param {string} sanitized
 * @param {number} start
 * @returns {ScannedImport | null}
 */
function parseReExportDeclaration(source, sanitized, start) {
  const afterExport = source.slice(start, start + 4000).slice("export".length);
  return parseFromClause(sanitized, afterExport, start + "export".length, RE_EXPORT_DECLARATION, {
    flagTripwire: "RE_EXPORT_DECLARATION lost its `d` flag; named-list offsets are gone",
  });
}

// The shared tail of both declaration parsers, from the optional leading
// `type` modifier through the clause match to the named-list re-read. Both
// clause regexes agree by construction: group 1 is the named list, group 3
// the specifier, and both carry the `d` flag whose indices let the list be
// re-read from the SANITIZED text at the same offsets. A type-only
// declaration keeps its specifier and drops every name (RF-UAW05: type-only
// carries no runtime usage); a clause with no named list (namespace, star,
// default) reports the specifier alone.
/**
 * @param {string} sanitized
 * @param {string} afterKeyword the 4000-char window minus its keyword
 * @param {number} keywordEnd absolute offset just past the keyword
 * @param {RegExp} clause
 * @param {{ rejectRest?: (rest: string) => boolean, flagTripwire: string }} options
 * @returns {ScannedImport | null}
 */
function parseFromClause(sanitized, afterKeyword, keywordEnd, clause, options) {
  const typeOnly = /^\s+type\s/.exec(afterKeyword);
  const rest = afterKeyword.slice(typeOnly ? typeOnly[0].length : 0);
  const restOffset = keywordEnd + (typeOnly ? typeOnly[0].length : 0);
  if (options.rejectRest?.(rest)) return null;

  const declaration = clause.exec(rest);
  if (!declaration) return null;

  const specifier = declaration[3];
  if (typeOnly) return { specifier, names: [] };

  if (declaration.indices === undefined) {
    // Impossible while the clause carries its `d` flag — indices is what
    // that flag produces. A guard that quietly fell back would classify
    // every named list as absent and silently undercount, so this tripwire
    // is loud on purpose: it fires only if someone drops the flag.
    throw new Error(options.flagTripwire);
  }
  const namedListRange = declaration.indices[1];
  if (namedListRange === undefined) return { specifier, names: [] };

  return {
    specifier,
    names: namesFromList(sanitized, restOffset + namedListRange[0], restOffset + namedListRange[1]),
  };
}

/**
 * @param {string} source
 * @returns {ScannedImport[]}
 */
export function scanSource(source) {
  const sanitized = blankSource(source);
  const declarationKeyword = /\b(import|export)\b/g;
  const results = [];
  let match = declarationKeyword.exec(sanitized);
  while (match) {
    const parsed =
      match[1] === "import"
        ? parseImportDeclaration(source, sanitized, match.index)
        : parseReExportDeclaration(source, sanitized, match.index);
    if (parsed && TRACKED_SPECIFIERS.has(parsed.specifier)) results.push(parsed);
    match = declarationKeyword.exec(sanitized);
  }
  return results;
}
