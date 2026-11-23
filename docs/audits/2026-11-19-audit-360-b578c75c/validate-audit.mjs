import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = path => readFile(path, 'utf8');
const json = async name => JSON.parse(await read(join(dir, name)));
const reports = ['EXECUTIVE_SUMMARY.md', 'SCOPE_AND_COVERAGE.md', 'FINDINGS.md', 'TEST_EVIDENCE.md', 'DESIGN_UX_A11Y.md', 'SECURITY_DATA_FINANCE.md', 'ARCHITECTURE_OPERATIONS.md', 'PRODUCT_STRATEGY.md', 'REMEDIATION_PLAN.md'];
const failures = [];
let linksChecked = 0, sourceReferences = 0, jsonFiles = 0;
async function walk(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const name = join(path, entry.name);
    if (entry.isDirectory()) result.push(...await walk(name));
    else result.push(name);
  }
  return result;
}
const findings = await json('findings.json');
if (findings.length !== 36 || new Set(findings.map(f => f.id)).size !== 36) failures.push('Finding count or duplicate IDs');
const expected = { Haute: 10, Moyenne: 25, Faible: 1 };
for (const [severity, count] of Object.entries(expected)) if (findings.filter(f => f.severity === severity).length !== count) failures.push(`Severity ${severity}`);
for (const finding of findings) {
  for (const [source, line] of finding.sources) {
    try {
      const lines = (await read(join(root, source))).split('\n');
      if (!Number.isInteger(line) || line < 1 || line > lines.length) failures.push(`Invalid source line ${finding.id} ${source}:${line}`);
      sourceReferences++;
    } catch { failures.push(`Missing source ${finding.id} ${source}`); }
  }
  for (const path of finding.evidence) {
    try { await stat(join(dir, path)); } catch { failures.push(`Missing evidence ${finding.id} ${path}`); }
  }
}
for (const name of reports) {
  const path = join(dir, name);
  let text;
  try { text = await read(path); } catch { failures.push(`Missing report ${name}`); continue; }
  if (text.length < 1000 || text.includes('\ufffd')) failures.push(`Short or invalid UTF-8 report ${name}`);
  for (const match of text.matchAll(/\]\((<[^>\r\n]+>|[^)\r\n]+)\)/g)) {
    let target = match[1].replace(/^<|>$/g, '');
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [filePart, anchor] = target.split('#');
    const lineMatch = filePart.match(/:(\d+)$/);
    const stripped = decodeURIComponent(filePart.replace(/:\d+$/, ''));
    const destination = stripped ? resolve(dirname(path), stripped) : path;
    try {
      const info = await stat(destination);
      if (lineMatch && info.isFile()) {
        const count = (await read(destination)).split('\n').length;
        if (+lineMatch[1] > count) failures.push(`Link line out of range ${name} ${target}`);
      }
      if (anchor && destination.endsWith('FINDINGS.md')) {
        const destinationText = await read(destination);
        if (!destinationText.includes(`<a id="${anchor}"></a>`)) failures.push(`Missing finding anchor ${name} ${target}`);
      }
      linksChecked++;
    } catch { failures.push(`Missing link ${name} ${target}`); }
  }
}
const inventory = await json('evidence/inventory.json');
if (inventory.requirements.length !== 68 || new Set(inventory.requirements.map(r => r.id)).size !== 68) failures.push('Requirement matrix inventory');
const scope = await read(join(dir, 'SCOPE_AND_COVERAGE.md'));
if ([...scope.matchAll(/^\| MAT-FUNC-\d{3} \|/gm)].length !== 68) failures.push('Requirement matrix report count');
if ([...scope.matchAll(/^\| \d+ \|/gm)].length !== 26) failures.push('E2E scenario matrix report count');
const sql = await json('evidence/sql-all-files.json');
if (sql.files !== 383 || sql.passed !== 364 || sql.failed !== 10 || sql.errors !== 9 || sql.records.length !== 383) failures.push('SQL full run count');
const summary = await json('evidence/summary.json');
if (summary.browser.pages !== 140 || summary.browser.axeScans !== 56 || summary.browser.violations.length) failures.push('Browser count or axe summary');
const build = await json('evidence/report-build.json');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const staged = execFileSync('git', ['diff', '--cached', '--binary'], { cwd: root, windowsHide: true });
if (head !== build.head || createHash('sha256').update(staged).digest('hex') !== build.stagedDiffSha256) failures.push('Candidate HEAD/index drift');
const changed = execFileSync('git', ['diff', 'HEAD', '--name-only'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/).filter(Boolean).sort();
const baseline = ['apps/web/modules/admin/data/spaces/demo-franchise-applications.ts', 'apps/web/modules/franchise/data/crm/repository.ts'].sort();
if (JSON.stringify(changed) !== JSON.stringify(baseline)) failures.push('Tracked changes differ from pre-existing baseline');
const unstaged = execFileSync('git', ['diff', '--name-only'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
if (unstaged) failures.push('Unstaged tracked source modifications');
for (const path of await walk(dir)) if (path.endsWith('.json')) {
  try { JSON.parse(await read(path)); jsonFiles++; } catch { failures.push(`Invalid JSON ${relative(dir, path)}`); }
}
const result = { generatedAt: new Date().toISOString(), passed: failures.length === 0, reports: reports.length, findings: findings.length, requirements: inventory.requirements.length, sourceReferences, linksChecked, jsonFiles, head, preservesPreExistingIndex: head === build.head && createHash('sha256').update(staged).digest('hex') === build.stagedDiffSha256, failures };
await writeFile(join(dir, 'evidence/audit-validation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
