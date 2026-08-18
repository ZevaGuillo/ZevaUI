// Runnable entry for the bundle-budget gate (RNF-02). Bundles each declared entry through
// esbuild with React externalized, measures its gzip size, and compares it against
// bundle-budget.json. Reads `componentRegistry` from dist/registry.js via pathToFileURL, exactly
// as build-manifest.js does — hence the `size` turbo task's dependsOn: ["build"].
//
// `--record` re-measures every entry and rewrites its ledger fields (measuredGzipBytes,
// measuredAtCommit) only. It never overwrites an EXISTING maxGzipBytes, because a ceiling is a
// human decision (see bundle-budget.js); it computes one only the first time an entry has none,
// using the +25%/+10% multipliers from RF-QVB02 — admitted assumptions, not measurements.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { buildSync } from "esbuild";
import { budgetEntries, formatReport, verdict } from "./bundle-budget.js";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(packageRoot, "dist");
const CONSUMER_SPECIFIER = "@zevaui/components";
const CEILING_MULTIPLIER = { server: 1.25, client: 1.1, barrel: 1.1 };

function parseArgs(argv) {
  let budgetPath = join(packageRoot, "bundle-budget.json");
  let record = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--budget") {
      budgetPath = resolve(packageRoot, argv[index + 1]);
      index += 1;
    } else if (argv[index] === "--record") {
      record = true;
    }
  }
  return { budgetPath, record };
}

// esbuild's JS API measures a real consumer entry via `stdin`/`alias`, so nothing is ever
// written to disk (binding decision #101) and no pnpm-internal path is reached.
function measureGzipBytes(entry) {
  const importClause =
    entry.imports === "*"
      ? `export * from "${CONSUMER_SPECIFIER}";`
      : `export { ${entry.imports.join(", ")} } from "${CONSUMER_SPECIFIER}";`;

  const result = buildSync({
    stdin: { contents: importClause, resolveDir: packageRoot, loader: "js" },
    alias: { [CONSUMER_SPECIFIER]: join(distDir, "index.js") },
    bundle: true,
    minify: true,
    format: "esm",
    external: ["react", "react-dom", "react/jsx-runtime"],
    write: false,
  });

  const [output] = result.outputFiles;
  return gzipSync(output.contents, { level: 9 }).length;
}

function record(budgetPath, budget, entries, measurements) {
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: packageRoot })
    .toString()
    .trim();

  for (const entry of entries) {
    const jsonEntry = budget.entries[entry.name];
    const measured = measurements[entry.name];
    jsonEntry.measuredGzipBytes = measured;
    jsonEntry.measuredAtCommit = commit;
    if (jsonEntry.maxGzipBytes === undefined) {
      jsonEntry.maxGzipBytes = Math.ceil(measured * CEILING_MULTIPLIER[entry.kind]);
    }
  }

  writeFileSync(budgetPath, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`[bundle-budget] recorded ${entries.length} entries at ${commit}`);
}

async function main() {
  const { budgetPath, record: shouldRecord } = parseArgs(process.argv.slice(2));

  const budget = JSON.parse(readFileSync(budgetPath, "utf8"));
  const { componentRegistry } = await import(pathToFileURL(join(distDir, "registry.js")));

  const entries = budgetEntries(componentRegistry, budget);
  const measurements = {};
  for (const entry of entries) measurements[entry.name] = measureGzipBytes(entry);

  if (shouldRecord) {
    record(budgetPath, budget, entries, measurements);
    return;
  }

  const rows = verdict(entries, measurements);
  const report = formatReport(rows);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `\n\`\`\`\n${report}\n\`\`\`\n`, { flag: "a" });
  }

  const overEntries = rows.filter((row) => row.status === "OVER");
  if (overEntries.length > 0) {
    console.error(
      `\n[bundle-budget] OVER budget: ${overEntries.map((row) => row.name).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

main();
