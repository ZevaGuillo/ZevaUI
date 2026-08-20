// Two-stage import scanner (design #156 D2). Stage 1 (blankSource) blanks
// comments, string/template literals (including nested `${}`) and regex
// literals in place, offset-preserving — a decoy import hidden inside one of
// those is gone before stage 2 ever looks, not filtered, structurally
// invisible. Stage 2 (scanSource) then locates genuine `import` keywords in
// the sanitized text and re-parses each declaration from the ORIGINAL source
// at that same offset: the declaration's own specifier string is real code,
// not a decoy, so reading it from the original text is correct.
//
// Specifier matching is exact equality, never a prefix: `@zevaui/components`
// exposes `./styles.css` and `./components.manifest.json` as real, resolvable
// subpath exports carrying zero components (packages/components/package.json
// exports map, verified) — a `startsWith` filter would emit a phantom entry
// for each.
export const TRACKED_SPECIFIERS = new Set(["@zevaui/components", "@zevaui/tokens"]);

// Keywords after which a following `/` starts a regex literal, not a
// division. Not exhaustive — this is the standard previous-significant-token
// heuristic every hand-rolled tokenizer uses; its residual ambiguity (e.g.
// after `)` or `}`) is exactly what spike S-B measures against real,
// unplanned source rather than only this package's fixture.
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

function regexAllowed(prevToken) {
  if (prevToken === "") return true;
  if (/^[A-Za-z_$][\w$]*$/.test(prevToken)) return REGEX_CONTEXT_KEYWORDS.has(prevToken);
  if (/^[0-9]/.test(prevToken)) return false;
  return ![")", "]", '"', "'", "`", "/"].includes(prevToken);
}

export function blankSource(source) {
  const n = source.length;
  const out = source.split("");
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== "\n") out[k] = " ";
  };

  // Stack of open `${ }` template interpolations: "template" means we are
  // currently consuming template-literal TEXT (not inside `${ }`); a number
  // is an open expression's own unmatched-brace depth, needed so a nested
  // object literal's braces inside `${ }` don't close it early.
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

    if (typeof stack[stack.length - 1] === "number") {
      if (ch === "{") stack[stack.length - 1] += 1;
      else if (ch === "}") {
        if (stack[stack.length - 1] === 0) stack.pop();
        else stack[stack.length - 1] -= 1;
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

// Parses one `import` declaration starting at `start` in the ORIGINAL
// source. Bounded to a 4000-char lookahead and to the first `;` within it —
// a real import statement is always short and always terminates there, and
// bounding the search this way is what keeps a dynamic `import(...)` call
// (no declaration, no terminating `from`) from accidentally matching a
// LATER, unrelated import's `from` clause inside the lookahead window.
function parseImportDeclaration(source, start) {
  const window = source.slice(start, start + 4000);
  const afterImport = window.slice("import".length);

  const sideEffect = /^\s*(["'])([^"']*)\1/.exec(afterImport);
  if (sideEffect) return { specifier: sideEffect[2], names: [] };

  const typeOnly = /^\s+type\s/.exec(afterImport);
  const rest = afterImport.slice(typeOnly ? typeOnly[0].length : 0);
  if (rest.trimStart().startsWith("(")) return null; // dynamic import(), not a declaration

  const statementEnd = rest.indexOf(";");
  if (statementEnd === -1) return null;
  const statement = rest.slice(0, statementEnd).trimEnd();

  const from = /from\s*(["'])([^"']*)\1$/.exec(statement);
  if (!from) return null;
  if (typeOnly) return { specifier: from[2], names: [] }; // RF-UAW05: whole import is type-only

  const namedList = /\{([^}]*)\}/.exec(statement.slice(0, from.index));
  if (!namedList) return { specifier: from[2], names: [] }; // default or namespace: no static names

  const names = namedList[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0 && !/^type\s/.test(entry))
    .map((entry) => {
      const alias = /^([\w$]+)\s+as\s+[\w$]+$/.exec(entry);
      return alias ? alias[1] : entry;
    })
    .filter((name) => /^[A-Za-z_$][\w$]*$/.test(name));

  return { specifier: from[2], names };
}

export function scanSource(source) {
  const sanitized = blankSource(source);
  const importKeyword = /\bimport\b/g;
  const results = [];
  let match = importKeyword.exec(sanitized);
  while (match) {
    const parsed = parseImportDeclaration(source, match.index);
    if (parsed && TRACKED_SPECIFIERS.has(parsed.specifier)) results.push(parsed);
    match = importKeyword.exec(sanitized);
  }
  return results;
}
