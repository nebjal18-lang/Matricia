import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = fileURLToPath(new URL('./evidence/', import.meta.url));
async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    if (['node_modules', '.next', 'dist', '.git'].includes(entry.name)) continue;
    if (entry.isDirectory()) results.push(...await walk(join(path, entry.name)));
    else if (entry.isFile()) results.push(relative(root, join(path, entry.name)).replaceAll('\\', '/'));
  }
  return results;
}
const files = (await Promise.all(['apps', 'packages', 'tests', 'supabase'].map(path => walk(join(root, path))))).flat();
const pages = files.filter(file => /\/page\.tsx$/.test(file));
const routes = pages.map(file => ({ file, route: file.replace(/^apps\/web\/app/, '').replace(/\/\([^/]+\)/g, '').replace(/\/page\.tsx$/, '') }));
const migrationFiles = files.filter(file => /^supabase\/migrations\/.+\.sql$/.test(file));
const byVersion = new Map();
for (const file of migrationFiles) {
  const version = file.split('/').at(-1).split('_')[0];
  byVersion.set(version, [...(byVersion.get(version) || []), file]);
}
const { stdout } = await execute('docker', ['exec', 'supabase_db_Matricia', 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', 'select version from supabase_migrations.schema_migrations order by 1;'], { windowsHide: true });
const applied = new Set(stdout.trim().split(/\r?\n/));
const packageFiles = files.filter(file => /(?:^|\/)package\.json$/.test(file));
const packages = [];
for (const file of packageFiles) {
  const manifest = JSON.parse(await readFile(join(root, file), 'utf8'));
  packages.push({ file, name: manifest.name, scripts: manifest.scripts, dependencies: Object.keys(manifest.dependencies || {}) });
}
const gold = await readFile(join(root, 'Matricia_GOLD_MASTER_PROMPT_UNIQUE_CODEX_V4_FINAL_2026-09-10.md'), 'utf8');
const registry = gold.slice(gold.indexOf('# 31 BIS.'), gold.indexOf('# ANNEXE A —'));
const coverage = await readFile(join(root, 'docs/traceability/REQUIREMENTS_COVERAGE.md'), 'utf8');
const requirements = [...registry.matchAll(/\| `?(MAT-FUNC-\d{3})`? \| ([^|]+) \| ([^|]+) \|/g)].map(match => {
  const row = coverage.split(/\r?\n/).find(line => line.startsWith(`| ${match[1]} |`));
  return { id: match[1], name: match[2].trim(), acceptance: match[3].trim(), declaredStatus: row?.split('|')[2]?.trim() || 'NOT_FOUND',
    documentationRow: row || null, statusThisAudit: 'Not certified end-to-end; use executed evidence and requirement matrix' };
});
const dependencies = JSON.parse(await readFile(join(evidence, 'dependencies.log'), 'utf8'));
const advisories = Object.values(dependencies.advisories || {}).map(item => ({ id: item.github_advisory_id, title: item.title, severity: item.severity, affected: item.vulnerable_versions, patched: item.patched_versions, url: item.url, references: item.references }));
const result = { generatedAt: new Date().toISOString(), routes, pages: pages.length,
  routeCounts: Object.fromEntries(['administration', 'client', 'sous-traitant', 'franchise'].map(space => [space, routes.filter(route => route.route.startsWith(`/[locale]/${space}/`) || route.route === `/[locale]/${space}`).length])),
  apiRoutes: files.filter(file => /\/route\.ts$/.test(file)), packages,
  testFiles: { web: files.filter(file => file.startsWith('apps/web/') && /\.test\.tsx?$/.test(file)).length,
    worker: files.filter(file => file.startsWith('apps/worker/') && /\.test\.ts$/.test(file)).length,
    e2e: files.filter(file => file.startsWith('tests/e2e/') && /\.spec\.ts$/.test(file)).length,
    sql: files.filter(file => file.startsWith('supabase/tests/') && /\.test\.sql$/.test(file)).length },
  migrations: { fileCount: migrationFiles.length, uniqueVersions: byVersion.size, locallyAppliedVersionCount: applied.size,
    duplicateVersions: [...byVersion].filter(([, value]) => value.length > 1).map(([version, paths]) => ({ version, paths })),
    notAppliedInLocalSnapshot: [...byVersion].filter(([version]) => !applied.has(version)).map(([version, paths]) => ({ version, paths })) },
  requirements, advisories };
await writeFile(join(evidence, 'inventory.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ pages: result.pages, routeCounts: result.routeCounts, apiRoutes: result.apiRoutes.length,
  packages: packages.length, testFiles: result.testFiles, migrations: result.migrations,
  requirementCount: requirements.length, declaredVerified: requirements.filter(r => r.declaredStatus === 'VERIFIED').map(r => r.id), advisories }, null, 2));
