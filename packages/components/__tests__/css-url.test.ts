import { describe, expect, it } from "vitest";
import { cssUrl } from "../src/internal/css-url.js";

/**
 * TESTED AS A UNIT RATHER THAN THROUGH A RENDERED DOM, AND THAT IS NOT A STYLE PREFERENCE — the
 * DOM version was written first and was worthless.
 *
 * `Avatar` writes a consumer's `src` into a `background-image`, the only place in this package
 * where caller-supplied text reaches a stylesheet. The obvious test renders an avatar with a
 * hostile src and inspects the element. Measured in this repo's jsdom: the CSSOM REFUSES to parse
 * the hostile value and the style attribute comes back `null` — so the assertion passes
 * identically for an implementation that escapes correctly and one that emits nothing at all. A
 * test that cannot tell those two apart is not testing the thing it names.
 *
 * jsdom is also not evidence about browsers here. `url("/a.jpg); background: red")` is perfectly
 * valid CSS — a quoted URL string may contain `)` and `;` — so a real browser sets it as one inert
 * declaration pointing at a URL that will not resolve. The function's contract is about the STRING
 * it produces, so the string is what is asserted.
 */
describe("cssUrl", () => {
  it("wraps an ordinary URL in a quoted url()", () => {
    expect(cssUrl("/avatars/ana.jpg")).toBe('url("/avatars/ana.jpg")');
  });

  /**
   * The breakout the whole function exists for. A closing quote would end the string, after which
   * everything up to the next quote is parsed as CSS — `background: red` here, but an
   * `url(https://attacker.example/…)` just as easily, which turns every avatar on the page into a
   * request the consumer never made.
   *
   * With the quotes removed, the injected text stays INSIDE the string: the result is one
   * declaration whose URL happens to be nonsense, and the component draws its fallback exactly as
   * it would for any other source that does not resolve.
   */
  it("cannot be closed out of the url() it is written into", () => {
    const hostile = '/a.jpg"); background: red; --x: url("';
    const result = cssUrl(hostile);

    expect(result).toBe('url("/a.jpg); background: red; --x: url(")');

    // The structural claim, stated independently of the exact string: exactly two quotes survive —
    // the ones this function opens and closes with — so nothing the caller supplied can be outside
    // them. An assertion that the RESULT contains no quote at all would be wrong and would fail on
    // a correct implementation; the value BETWEEN them is what must be quote-free.
    expect(result.startsWith('url("')).toBe(true);
    expect(result.endsWith('")')).toBe(true);
    expect(result.slice('url("'.length, -'")'.length)).not.toContain('"');
  });

  it("strips a backslash, which would otherwise start an escape sequence", () => {
    expect(cssUrl("/a\\22 .jpg")).toBe('url("/a22 .jpg")');
  });

  it("strips the raw line breaks that terminate a declaration", () => {
    expect(cssUrl("/a.jpg\n}\r\nbody{background:red}")).toBe('url("/a.jpg}body{background:red}")');
  });

  /**
   * THE COUNTERPART THE STRIPPING MUST NOT BREAK, and the reason `encodeURI` is not used. Most
   * avatar URLs behind a CDN or a signing proxy carry a percent-encoded query string;
   * `encodeURI` re-encodes the `%` itself, so `%2F` becomes `%252F` and the image stops resolving
   * — a change that would look fine in every test written against a bare path.
   */
  it("leaves a percent-encoded URL exactly as it was given", () => {
    const src = "https://cdn.example.com/u%2F42.jpg?sig=a%2Bb%3Dc&w=96";
    expect(cssUrl(src)).toBe(`url("${src}")`);
  });

  it("leaves a data URI intact", () => {
    const src = "data:image/svg+xml;base64,PHN2Zy8+";
    expect(cssUrl(src)).toBe(`url("${src}")`);
  });

  // The empty case is not special-cased on purpose: `url("")` is a valid declaration that resolves
  // to nothing, which is the same outcome as any other source that does not load.
  it("produces an inert url() for an empty string", () => {
    expect(cssUrl("")).toBe('url("")');
  });
});
