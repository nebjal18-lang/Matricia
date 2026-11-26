// Independent oracle: run with a Node executable shipping the pinned IANA release.
// node22 tests/remediation/verify-display-iana.mjs
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";

const root = process.cwd();
const folder = readdirSync("node_modules/.pnpm").filter(name => name.startsWith("esbuild@")).sort().at(-1);
const { build } = createRequire(path.join(root, "node_modules/.pnpm", folder, "loader.cjs"))("esbuild");
const bundled = await build({ stdin: { contents: 'export * from "./display"; export * from "./display-casablanca-data";', resolveDir: path.join(root, "apps/web/modules/shared/lib/format"), loader: "ts" }, bundle: true, write: false, format: "cjs", platform: "node" });
const module = { exports: {} };
runInNewContext(bundled.outputFiles[0].text, { module, exports: module.exports, Date, Intl });
const { formatDateTimeCasablanca, casablancaTransitions, casablancaTzdbVersion } = module.exports;
assert.equal(process.versions.tz, casablancaTzdbVersion, "Use an independent Node runtime with the pinned tzdb version as oracle");
let checks = 0;
for (const [instant] of casablancaTransitions) {
  for (const delta of [-1000, 0, 1000]) {
    const date = new Date(instant * 1000 + delta);
    for (const locale of ["fr", "ar"]) {
      const oracle = new Intl.DateTimeFormat(`${locale}-MA`, { timeZone: "Africa/Casablanca", calendar: "gregory", numberingSystem: "latn", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
      assert.equal(formatDateTimeCasablanca(date.toISOString(), locale), oracle, `${locale} ${date.toISOString()}`);
      checks++;
    }
  }
}
console.log(JSON.stringify({ node: process.versions.node, icu: process.versions.icu, tz: process.versions.tz, transitions: casablancaTransitions.length, checks, status: "passed" }));
