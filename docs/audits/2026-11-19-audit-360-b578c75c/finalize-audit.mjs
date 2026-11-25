import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../../../', import.meta.url));
const validation = JSON.parse(await readFile(join(dir, 'evidence/audit-validation.json'), 'utf8'));
if (!validation.passed) throw new Error('Audit validation must pass before evidence is sealed');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const staged = execFileSync('git', ['diff', '--cached', '--binary'], { cwd: root, windowsHide: true });
const stagedDiffSha256 = createHash('sha256').update(staged).digest('hex');
const build = JSON.parse(await readFile(join(dir, 'evidence/report-build.json'), 'utf8'));
if (head !== build.head || stagedDiffSha256 !== build.stagedDiffSha256) throw new Error('Candidate changed since report generation');
async function walk(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const name = join(path, entry.name);
    if (entry.isDirectory()) result.push(...await walk(name));
    else result.push(name);
  }
  return result;
}
const files = [];
for (const path of (await walk(dir)).sort()) {
  if (path === join(dir, 'evidence-manifest.json')) continue;
  const data = await readFile(path);
  files.push({ path: relative(dir, path).replaceAll('\\', '/'), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
const manifest = { generatedAt: new Date().toISOString(), purpose: 'AUDIT_EVIDENCE_NOT_A_RELEASE_APPROVAL', candidate: { head, stagedDiffSha256, includesTwoPreExistingStagedCorrections: true }, files, filesCount: files.length, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), productionChanged: false, applicationChangedByAudit: false };
await writeFile(join(dir, 'evidence-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ files: manifest.filesCount, totalBytes: manifest.totalBytes, evidenceManifestSha256: createHash('sha256').update(await readFile(join(dir, 'evidence-manifest.json'))).digest('hex') }));
