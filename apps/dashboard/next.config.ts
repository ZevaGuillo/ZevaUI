import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Defect 1 follow-on: this repo's TypeScript convention (see
  // tsconfig.base.json's `moduleResolution: "bundler"`) imports a sibling
  // `.ts`/`.tsx` file via a `.js`/`.jsx` specifier (e.g.
  // `import x from "./foo.js"` where only `foo.ts` exists). `tsc` and
  // Vitest already resolve this correctly, but Next.js's webpack bundler
  // does NOT alias `.js`/`.jsx` specifiers to `.ts`/`.tsx` files unless
  // told to -- `next build` never ran anywhere in this repo before this
  // fix, so the gap was never exercised. Enabling it here keeps every
  // existing `.js`-specifier import in apps/dashboard/src unchanged.
  //
  // Turbopack (the `next build` default as of Next 16) does not honor this
  // option for this cross-extension case at all -- verified empirically:
  // the same `.js`-specifier imports fail to resolve under Turbopack both
  // with and without this option set. `package.json`'s `build` script
  // therefore passes `--webpack` explicitly.
  experimental: {
    extensionAlias: {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    },
  },
};

export default nextConfig;
