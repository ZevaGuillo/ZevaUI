// D5: public, no session anywhere in this tree -- RF-AP01 scenario 2.
//
// Order matters: `@zevaui/components/styles.css` is a chain of `var(--zui-*)`
// pointers (ADR-0004 D2) that resolve only once the token layer's custom
// properties exist. Reversing these two ships components with unresolved CSS
// variables. Canonical reference: apps/storybook/.storybook/preview.ts:1-6.
// Asserted in __tests__/theme-foundation.test.ts, because nothing about a
// reversed order LOOKS wrong -- the page renders, unstyled.
import "@zevaui/tokens/styles.css";
import "@zevaui/components/styles.css";
import "./globals.css";

import { Link, Separator } from "@zevaui/components";
import type { ReactNode } from "react";

export const metadata = { title: "ZevaUI Adoption Panel" };

/**
 * The source list. Data rather than markup so the nav has exactly one shape, and
 * every entry is an anchor -- which is the whole product constraint rather than a
 * styling choice: RF-AP01 scenario 2 forbids any mutation affordance, so there is
 * no button, no form and no filter control anywhere in this panel. Sorting and
 * every other view change travels by URL.
 */
const SOURCES: readonly { readonly href: string; readonly label: string }[] = [
  { href: "/", label: "Versions" },
  { href: "/deprecated", label: "Deprecated in use" },
  { href: "/releases", label: "Release log" },
];

/**
 * `.theme-dark` IS THE THEME -- a class on <html>, not a data attribute and not a
 * provider, because that is the selector packages/tokens emits. `.theme-light`
 * emits no rules of its own (`:root` is already light), so a light island inside
 * a dark page is not expressible: the theme is a document-level decision here,
 * and pretending otherwise would mean a toggle that half-works.
 */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en" className="theme-dark">
      <body>
        <div className="shell">
          {/* `aria-label` rather than a visible heading: the wordmark names the
              product, not this landmark, and two navs would be indistinguishable
              in a landmark list without it. */}
          <nav className="shell__nav" aria-label="Panel sections">
            <p className="wordmark">ZevaUI Adoption</p>
            <Separator decorative />
            <div>
              <p className="source-list__label">Sections</p>
              <ul className="source-list">
                {SOURCES.map((source) => (
                  <li key={source.href}>
                    <Link href={source.href} tone="neutral" underline="hover">
                      {source.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <main className="shell__content">{children}</main>
        </div>
      </body>
    </html>
  );
}
