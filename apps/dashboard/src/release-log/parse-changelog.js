// D5: pure, dependency-free changelog parser. RF-AP02's release log is
// derived from committed CHANGELOG.md files, never a runtime GitHub
// Releases API call and never a read of any repository release tag (see
// __tests__/no-git-tag-read.test.ts -- an explicit gate, not an
// assumption). Understands exactly the shape `changeset version` emits: a
// `#` package heading, `##` version headings, and `###` change-type
// subheadings with top-level `- ` bullets underneath.

const VERSION_HEADING = /^##\s+(\S+)\s*$/;
const CHANGE_TYPE_HEADING = /^###\s+(Major|Minor|Patch)\s+Changes\s*$/i;
const TOP_LEVEL_BULLET = /^-\s+(.*)$/;
const COMMIT_HASH_PREFIX = /^[0-9a-f]{7,40}:\s*/i;

/** @typedef {{ type: string, text: string }} ChangelogChange */
/** @typedef {{ version: string, changes: ChangelogChange[] }} ChangelogRelease */
/** @typedef {{ package: string, releases: ChangelogRelease[] }} ParsedChangelog */

/**
 * @param {string} markdown
 * @param {string} packageName
 * @returns {ParsedChangelog}
 */
export function parseChangelog(markdown, packageName) {
  /** @type {ChangelogRelease[]} */
  const releases = [];
  /** @type {ChangelogRelease | null} */
  let currentRelease = null;
  /** @type {string | null} */
  let currentType = null;

  for (const line of markdown.split("\n")) {
    const versionMatch = VERSION_HEADING.exec(line);
    if (versionMatch) {
      currentRelease = { version: versionMatch[1], changes: [] };
      releases.push(currentRelease);
      currentType = null;
      continue;
    }

    const typeMatch = CHANGE_TYPE_HEADING.exec(line);
    if (typeMatch) {
      currentType = typeMatch[1].toLowerCase();
      continue;
    }

    // Only a TOP-LEVEL bullet (no leading whitespace, matched against the
    // raw, unindented line) starts a new change entry -- an indented
    // continuation or nested-list line under it is intentionally not
    // surfaced: RF-AP02 asks for what changed, not a full re-rendering of
    // the changelog's own markdown tree.
    if (currentRelease && currentType) {
      const bulletMatch = TOP_LEVEL_BULLET.exec(line);
      if (bulletMatch) {
        const text = bulletMatch[1].replace(COMMIT_HASH_PREFIX, "").trim();
        currentRelease.changes.push({ type: currentType, text });
      }
    }
  }

  return { package: packageName, releases };
}
