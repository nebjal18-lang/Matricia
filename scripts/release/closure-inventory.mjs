import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const requestedTemplates = [
  '/[locale]/client/abonnement/cycles/[cycleId]',
  '/[locale]/franchise/finance/releves/[closureId]',
  '/[locale]/sous-traitant/[...slug]',
  '/[locale]/sous-traitant/consultations/[consultationId]',
  '/[locale]/sous-traitant/facturation/[invoiceId]',
];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const segment = value => typeof value === 'string' && value.length > 0 && value.length <= 200 && !['.', '..'].includes(value) && !/[\\/\s?#%\u0000-\u001f]/u.test(value);

// Inventory only real page files; route groups and parallel slots are not URL segments.
export async function inventoryPages(appRoot) {
  const pages = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('_') && !/^\(\./u.test(entry.name)) await visit(target);
      } else if (/^page\.(tsx?|jsx?)$/u.test(entry.name)) {
        const parts = relative(appRoot, directory).split(/[\\/]/u).filter(part => part && !part.startsWith('@') && !/^\(.*\)$/u.test(part));
        pages.push({ template: '/' + parts.join('/'), file: relative(appRoot, target).replaceAll('\\', '/') });
      }
    }
  }
  await visit(appRoot);
  return pages.sort((a, b) => a.template.localeCompare(b.template));
}

export function collectScopedSeeds(pages, manifest = {}) {
  const actors = manifest.actors ?? {};
  const seeds = [], rejected = [];
  const known = new Set(pages.map(page => page.template));
  for (const row of manifest.seeds ?? []) {
    const actor = actors[row.actor];
    let reason;
    if (!known.has(row.template)) reason = 'UNKNOWN_ROUTE_TEMPLATE';
    else if (!actor || !uuid.test(actor.organizationId ?? '') || row.organizationId !== actor.organizationId) reason = 'TENANT_SCOPE_MISMATCH';
    else if (row.template.includes('/franchise/') && (!uuid.test(row.franchiseId ?? '') || !actor.franchiseIds?.includes(row.franchiseId))) reason = 'FRANCHISE_SCOPE_MISMATCH';
    else if (/\/franchise\/(services|questionnaires)\//u.test(row.template) && (!uuid.test(row.libraryId ?? '') || !actor.libraryIds?.includes(row.libraryId))) reason = 'WORKSPACE_LIBRARY_REQUIRED';
    const parameters = [...String(row.template).matchAll(/\[(\.\.\.)?([^\]]+)\]/gu)].filter(match => match[2] !== 'locale');
    if (!reason && parameters.some(([, catchAll, key]) => {
      const value = row.params?.[key];
      return catchAll ? !Array.isArray(value) || value.length === 0 || !value.every(segment) : !segment(value) || (/(?:^id$|Id$)/u.test(key) && !uuid.test(value));
    })) reason = 'INVALID_ROUTE_PARAMETERS';
    if (reason) { rejected.push({ template: row.template, actor: row.actor, reason }); continue; }
    for (const locale of ['fr', 'ar']) {
      let path = row.template.replace('[locale]', locale);
      for (const [, catchAll, key] of parameters) {
        const value = row.params[key];
        path = path.replace(catchAll ? `[...${key}]` : `[${key}]`, catchAll ? value.map(encodeURIComponent).join('/') : encodeURIComponent(value));
      }
      const query = new URLSearchParams({ organizationId: actor.organizationId });
      if (row.franchiseId) query.set('franchiseId', row.franchiseId);
      for (const width of [360, 1280]) seeds.push({ template: row.template, actor: row.actor, locale, width, path: path + '?' + query, status: 'NOT_RUN' });
    }
  }
  return { seeds, rejected, missingSeedTemplates: requestedTemplates.filter(template => !seeds.some(seed => seed.template === template)),
    scopeEvidence: 'Manifest scope matching only; database ownership, RLS and HTTP behavior require native authenticated tests.' };
}

export function releaseConditions(registry) {
  return registry.split(/\r?\n/u).filter(line => /^\| (MAT-FUNC|MARKETING)-\d{3} \|/u.test(line)).map(line => {
    const [, id, status, ...columns] = line.split('|').map(value => value.trim());
    return { id, status, classification: status === 'VERIFIED' ? 'EXISTING_EVIDENCE_REQUIRES_CURRENT_COMMIT_REVIEW' : 'MISSING_EVIDENCE_OR_SIGNOFF', implementationReferences: columns[0], testReferences: columns[1], evidenceReferences: columns[2], owner: columns[3], releaseSignoff: columns[4], note: 'Classification follows the registry claim; it does not prove implementation completeness or an external approval.' };
  });
}

export async function closureInventory(root, manifest = {}) {
  const pages = await inventoryPages(resolve(root, 'apps/web/app'));
  const registry = await readFile(resolve(root, 'docs/traceability/REQUIREMENTS_COVERAGE.md'), 'utf8');
  const environment = await readFile(resolve(root, '.env.example'), 'utf8');
  return { schemaVersion: 1, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    gate: 'NOT_CERTIFIED', productionModified: false, liveTestsRun: false,
    pages, ...collectScopedSeeds(pages, manifest), conditions: releaseConditions(registry),
    variables: [...environment.matchAll(/^([A-Z][A-Z0-9_]*)=/gmu)].map(([, name]) => ({ name, documented: true, stagingPresence: 'NOT_OBSERVED', productionPresence: 'NOT_OBSERVED' })),
    externalDecisions: { signatureProvider: 'Yousign', signatureEnvironment: 'sandbox', realAdapterValidated: false, stagingIdentityConfirmed: false, legalApprovalsObserved: false },
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const seedIndex = process.argv.indexOf('--seed-manifest');
  const manifest = seedIndex < 0 ? {} : JSON.parse(await readFile(process.argv[seedIndex + 1], 'utf8'));
  const outIndex = process.argv.indexOf('--output');
  const output = resolve(root, outIndex < 0 ? 'work/v1-closure/inventory.json' : process.argv[outIndex + 1]);
  const report = await closureInventory(root, manifest);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ pages: report.pages.length, plannedCases: report.seeds.length, missingSeedTemplates: report.missingSeedTemplates, rejected: report.rejected.length, conditions: report.conditions.length, output }));
  if (report.rejected.length) process.exitCode = 1;
}
