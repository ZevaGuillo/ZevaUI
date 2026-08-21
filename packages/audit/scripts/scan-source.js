// Two-stage import scanner (design #156 D2). Stage 1 (blankSource) blanks
// comments/strings/template literals/regex literals in place,
// offset-preserving, so a decoy import hidden inside one is structurally
// gone before stage 2 looks. Stage 2 (scanSource) locates genuine `import`
// keywords in the sanitized text and re-parses each declaration from the
// ORIGINAL source at that offset — the specifier string is real code there.
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

/**
 * @param {string} source
 * @returns {string} same length and line count, literals blanked in place
 */
export function blankSource(source) {
  const n = source.length;
  const out = source.split("");
  /** @type {(from: number, to: number) => void} */
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  // Stack of open `${ }` interpolations: "template" = consuming literal
  // TEXT; a number = an open expression's own unmatched-brace depth (so a
  // nested object literal's braces don't close the `${ }` early).
  /** @type {Array<"template" | number>} */
  const stack = [];
  let prevToken = "";
  let i = 0;

  while (i < n) {
    if (stack[stack.length - 1] === "template") {
      const ch = source[i];
      if (ch === "\\") {
        blank(i, i + 2);
        i += 2;
        continue;
      }
      if (ch === "`") {
        blank(i, i + 1);
        stack.pop();
        i += 1;
        continue;
      }
      if (ch === "$" && source[i + 1] === "{") {
        blank(i, i + 2);
        stack.push(0);
        i += 2;
        continue;
      }
      blank(i, i + 1);
      i += 1;
      continue;
    }

    const ch = source[i];

    if (ch === "/" && source[i + 1] === "/") {
      const start = i;
      while (i < n && source[i] !== "\n") i += 1;
      blank(start, i);
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      const start = i;
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i = Math.min(i + 2, n);
      blank(start, i);
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i += 1;
      while (i < n && source[i] !== quote) i += source[i] === "\\" ? 2 : 1;
      i = Math.min(i + 1, n);
      blank(start, i);
      prevToken = quote;
      continue;
    }
    if (ch === "`") {
      stack.push("template");
      blank(i, i + 1);
      i += 1;
      continue;
    }
    if (ch === "/" && regexAllowed(prevToken)) {
      const start = i;
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n && source[j] !== "\n") {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === "[") inClass = true;
        else if (source[j] === "]") inClass = false;
        else if (source[j] === "/" && !inClass) {
          closed = true;
          j += 1;
          break;
        }
        j += 1;
      }
      if (closed) {
        while (j < n && /[a-z]/i.test(source[j])) j += 1; // flags
        blank(start, j);
        prevToken = "/";
        i = j;
        continue;
      }
      // Ran off the line without a closing `/` — not actually a regex. Fall
      // through and treat this `/` as an ordinary (division) character.
    }

    const openExpressionDepth = stack[stack.length - 1];
    if (typeof openExpressionDepth === "number") {
      if (ch === "{") stack[stack.length - 1] = openExpressionDepth + 1;
      else if (ch === "}") {
        if (openExpressionDepth === 0) stack.pop();
        else stack[stack.length - 1] = openExpressionDepth - 1;
      }
    }

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[A-Za-z0-9_$]/.test(ch)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_$]/.test(source[i])) i += 1;
      prevToken = source.slice(start, i);
      continue;
    }
    prevToken = ch;
    i += 1;
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
  const window = source.slice(start, start + 4000);
  const afterImport = window.slice("import".length);

  const sideEffect = /^\s*(["'])([^"']*)\1/.exec(afterImport);
  if (sideEffect) return { specifier: sideEffect[2], names: [] };

  const typeOnly = /^\s+type\s/.exec(afterImport);
  const rest = afterImport.slice(typeOnly ? typeOnly[0].length : 0);
  const restOffset = start + "import".length + (typeOnly ? typeOnly[0].length : 0);
  if (rest.trimStart().startsWith("(")) return null; // dynamic import(), not a declaration

  const declaration = IMPORT_DECLARATION.exec(rest);
  if (!declaration) return null;

  const specifier = declaration[3];
  if (typeOnly) return { specifier, names: [] }; // RF-UAW05: whole import is type-only

  if (declaration.indices === undefined) {
    // Impossible while IMPORT_DECLARATION carries its `d` flag — indices is
    // what that flag produces. A guard that quietly fell back would classify
    // every named import as default-shaped and silently undercount, so this
    // tripwire is loud on purpose: it fires only if someone drops the flag.
    throw new Error("IMPORT_DECLARATION lost its `d` flag; named-list offsets are gone");
  }
  const namedListRange = declaration.indices[1];
  if (namedListRange === undefined) return { specifier, names: [] }; // default or namespace

  // Read the list back out of the SANITIZED text at the very same offsets.
  // Stage 1 preserves offsets precisely so this is possible, and this is the
  // one place it has to be used: a comment inside the list is already blanked
  // there, whereas in the ORIGINAL it rides in the same comma-separated chunk
  // as the name that follows it and drags that name out of the report. The
  // specifier still comes from the original, because stage 1 blanks the
  // quotes too and there is nothing left to read there.
  const names = sanitized
    .slice(restOffset + namedListRange[0], restOffset + namedListRange[1])
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !/^type\s/.test(entry))
    .map((entry) => {
      const alias = /^([\w$]+)\s+as\s+[\w$]+$/.exec(entry);
      return alias ? alias[1] : entry;
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));

  return { specifier, names };
}

/**
 * @param {string} source
 * @returns {ScannedImport[]}
 */
export function scanSource(source) {
  const sanitized = blankSource(source);
  const importKeyword = /\bimport\b/g;
  const results = [];
  let match = importKeyword.exec(sanitized);
  while (match) {
    const parsed = parseImportDeclaration(source, sanitized, match.index);
    if (parsed && TRACKED_SPECIFIERS.has(parsed.specifier)) results.push(parsed);
    match = importKeyword.exec(sanitized);
  }
  return results;
}
