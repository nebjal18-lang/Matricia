import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const auditDir = fileURLToPath(new URL('.', import.meta.url));
const execute = promisify(execFile);
const { stdout } = await execute(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'corepack pnpm exec supabase status --output json'], { cwd: root, windowsHide: true });
const local = JSON.parse(stdout.slice(stdout.indexOf('{')));
const values = Object.entries(local).filter(([name, value]) => /KEY|TOKEN|SECRET|PASSWORD|DB_URL/.test(name) && typeof value === 'string' && value.length >= 8).map(([, value]) => value);
const require = createRequire(join(root, 'package.json'));
const testPackage = require.resolve('@playwright/test/package.json');
const playwrightPackage = createRequire(testPackage).resolve('playwright/package.json');
const corePackage = createRequire(playwrightPackage).resolve('playwright-core/package.json');
const { yauzl, yazl } = require(join(dirname(corePackage), 'lib/utilsBundle.js'));
const modified = [];
let textFilesScanned = 0, traceArchivesScanned = 0, traceResourcesScanned = 0;
async function filesIn(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) files.push(...await filesIn(join(dir, entry.name)));
    else files.push(join(dir, entry.name));
  }
  return files;
}
function clean(buffer) {
  if (!values.some(value => buffer.includes(Buffer.from(value)))) return { buffer, replaced: false };
  let text = buffer.toString('utf8');
  for (const value of values) text = text.split(value).join('[REDACTED_LOCAL_CREDENTIAL]');
  return { buffer: Buffer.from(text), replaced: true };
}
async function cleanZip(path) {
  traceArchivesScanned++;
  const archive = await new Promise((resolve, reject) => yauzl.open(path, { lazyEntries: true }, (error, result) => error ? reject(error) : resolve(result)));
  const entries = []; let replacements = 0;
  await new Promise((resolve, reject) => {
    archive.on('error', reject); archive.on('end', resolve);
    archive.on('entry', entry => {
      if (entry.fileName.endsWith('/')) { entries.push({ name: entry.fileName, directory: true }); archive.readEntry(); return; }
      archive.openReadStream(entry, async (error, stream) => {
        if (error) { reject(error); return; }
        try {
          const chunks = []; for await (const chunk of stream) chunks.push(chunk);
          traceResourcesScanned++;
          const result = clean(Buffer.concat(chunks)); if (result.replaced) replacements++;
          entries.push({ name: entry.fileName, data: result.buffer }); archive.readEntry();
        } catch (error) { reject(error); }
      });
    });
    archive.readEntry();
  });
  if (!replacements) return;
  const output = new yazl.ZipFile(); const chunks = [];
  const completed = new Promise((resolve, reject) => { output.outputStream.on('data', chunk => chunks.push(chunk)); output.outputStream.on('end', resolve); output.outputStream.on('error', reject); });
  for (const entry of entries) entry.directory ? output.addEmptyDirectory(entry.name) : output.addBuffer(entry.data, entry.name);
  output.end(); await completed; await writeFile(path, Buffer.concat(chunks));
  modified.push({ path: relative(auditDir, path).replaceAll('\\', '/'), archiveResourcesRedacted: replacements });
}
for (const path of await filesIn(auditDir)) {
  if (path.endsWith('.zip')) { await cleanZip(path); continue; }
  if (!/\.(?:log|json|md|mjs|ts|sql|txt|yaml)$/.test(path)) continue;
  textFilesScanned++;
  const result = clean(await readFile(path));
  if (result.replaced) { await writeFile(path, result.buffer); modified.push({ path: relative(auditDir, path).replaceAll('\\', '/'), textRedacted: true }); }
}
const result = { generatedAt: new Date().toISOString(), scope: 'Only this audit folder; exact local credential comparison and removal from supported text and ZIP trace resources; no production credentials read; no application files modified; not a universal secret scan', textFilesScanned, traceArchivesScanned, traceResourcesScanned, modified };
await writeFile(join(auditDir, 'evidence/sanitization.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ sanitizedFiles: modified.length, modifiedPaths: modified.map(item => item.path) }));
