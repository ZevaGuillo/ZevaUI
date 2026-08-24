import { pathToFileURL } from "node:url";

/**
 * Cross-platform "was this file invoked directly via `node <file>`?" check.
 *
 * The naive `import.meta.url === \`file://${process.argv[1]}\`` comparison
 * silently no-ops on Windows: `process.argv[1]` keeps its native backslash
 * separators (e.g. `D:\repo\scripts\build-release-log.ts`) while
 * `import.meta.url` is always a normalized forward-slash `file:///` URL, so
 * the two never match there. `pathToFileURL` performs the same
 * platform-aware normalization Node uses internally, so the comparison is
 * correct on every platform.
 */
export function isMainModule(moduleUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  return moduleUrl === pathToFileURL(argv1).href;
}
