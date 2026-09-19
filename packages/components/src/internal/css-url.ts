/**
 * The one place caller-supplied text in this package is written into a stylesheet.
 *
 * `Avatar` puts a consumer's `src` into a `background-image`, which is the only rendered output
 * here that crosses from data into CSS. Everything else a caller supplies lands in text content or
 * in an attribute, where the framework escapes it; a CSS value has no such guarantee.
 *
 * It lives in `internal/` rather than beside `Avatar.tsx` for the reason `recipe-class.ts` does:
 * it is a pure function with a security-relevant contract, and that contract deserves unit tests
 * of its own rather than assertions taken through a rendered DOM. That distinction turned out to
 * be load-bearing — jsdom's CSSOM REFUSES to parse a hostile value and hands back nothing, so a
 * DOM-level test would pass identically for an implementation that escaped correctly and one that
 * emitted no style at all.
 */

/**
 * Characters that would let a value escape the quoted CSS `url("…")` it is written into.
 *
 * A double quote closes the string, a backslash starts an escape sequence, and a raw newline or
 * carriage return terminates it — after which the remainder is parsed as CSS rather than as part
 * of the URL.
 */
const CSS_URL_BREAKOUT = /["\\\r\n]/g;

/**
 * `url` as a CSS `url()` value, with the breakout characters REMOVED rather than escaped.
 *
 * Removal is lossless for any URL that is actually valid: RFC 3986 has no place for a raw quote,
 * backslash, carriage return or newline, so a real URL carries them percent-encoded (`%22`,
 * `%5C`, `%0D`, `%0A`) and passes through untouched. Escaping them instead would faithfully
 * reproduce a string that was already malformed, which is a worse answer to the same question.
 *
 * `encodeURI` was the obvious alternative and is wrong here: it re-encodes `%` itself, so a URL
 * whose query string is already percent-encoded — which is most avatar URLs behind a CDN or a
 * signing proxy — would be double-encoded and stop resolving.
 *
 * What survives is a single, inert `url()` pointing somewhere that will not load. That is the
 * intended failure: the component draws its fallback, which is exactly what it does for any other
 * source that does not resolve.
 */
export const cssUrl = (url: string): string => `url("${url.replace(CSS_URL_BREAKOUT, "")}")`;
