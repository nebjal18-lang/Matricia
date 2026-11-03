import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const roots = ["apps/web", "apps/worker", "packages", "supabase", "tests"].filter((path) => {
  try { return statSync(path).isDirectory(); } catch { return false; }
});
const extensions = new Set([".ts", ".tsx", ".sql"]);
const unfinishedMarker = /\b(?:TODO|FIXME|TBD)\b|(?:\/\/|\/\*|--|^\s*\*)\s*(?:todo|fixme|tbd)\b/m;
const explicitSentinel = /(?<![A-Za-z0-9_$])PLACEHOLDER(?![A-Za-z0-9_$])/;
const forbidden = (source: string) => unfinishedMarker.test(source) || explicitSentinel.test(source);
const violations: string[] = [];

function visit(path: string) {
  for (const entry of readdirSync(path)) {
    if (["node_modules", "dist", ".next", ".vinext", "coverage"].includes(entry)) continue;
    const target = join(path, entry);
    if (statSync(target).isDirectory()) visit(target);
    else if (!/\.(?:test|spec)\.tsx?$/.test(entry) && extensions.has(extname(target)) && forbidden(readFileSync(target, "utf8"))) violations.push(target);
  }
}
roots.forEach(visit);
if (violations.length) throw new Error(`Marqueurs interdits: ${violations.join(", ")}`);
console.log("Aucun marqueur incomplet dans le périmètre applicatif.");
