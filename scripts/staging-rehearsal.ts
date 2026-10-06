import { spawnSync } from "node:child_process";

// Runs every authenticated browser suite against a freshly migrated schema while the production build
// connects with the least-privilege runtime database account. Local lab only; nothing is deployed.
const suites = ["--browser", "--planning-browser", "--search-browser", "--consignment-browser", "--labels-browser"];
const results: Array<[string, number]> = [];
for (const suite of suites) {
  console.log(`=== staging rehearsal ${suite}`);
  const run = spawnSync(process.execPath, ["--import", "tsx", "scripts/run-integration.ts", suite, "--scoped-runtime"], { stdio: "inherit" });
  results.push([suite, run.status ?? 1]);
}
for (const [suite, code] of results) console.log(`${code === 0 ? "PASS" : "FAIL"} ${suite}`);
process.exitCode = results.every(([, code]) => code === 0) ? 0 : 1;
