---
"@zevaui/components": patch
"@zevaui/constraints": patch
"@zevaui/mcp": patch
"@zevaui/tokens": patch
---

Every published tarball now carries `NOTICE`. No API changes — this release exists so the
attribution ships with the code instead of staying behind in the git repository.

**The gap, measured on a real tarball rather than inferred.** `ADR-0022` added a root `NOTICE`
recording shadcn/ui's MIT attribution per Apache-2.0 §4(d), and recorded as a known follow-up that
`"files": ["dist"]` would not carry it into any package. npm auto-includes `LICENSE`; it does not
auto-include `NOTICE`. `@zevaui/constraints@1.0.0` shipped on 2026-10-15 and its tarball holds
`LICENSE`, `README.md`, `dist/contract.json` and `package.json` — nothing else. A consumer
installing from the registry received the license and no attribution.

**Committed copies, following the precedent already set for the other half of the obligation.**
All four publishable packages already carried a byte-identical committed copy of the root
`LICENSE`, so `NOTICE` gets the same treatment and `"NOTICE"` joins each `files` array. Copies
rather than symlinks because npm follows neither into a tarball.

**The gate asks npm instead of reading npm's documentation.** Four copies of two files is a drift
surface, and the `LICENSE` half of it had no gate at all until now.
`packages/config/__tests__/legal-files-reach-tarballs.test.ts` derives the publishable set from
the workspace — so a fifth publishable package is covered the day it appears, rather than shipping
bare behind a green suite — asserts every copy byte-identical against the root, and then runs
`npm pack --dry-run` to ask npm's own packer what would ship. That last step is the expensive one
and it is the point: this gap was born from trusting a reading of npm's packing rules. Run against
the tree before the fix, the gate failed 8 of its 13 assertions, each naming the package and the
missing file.
