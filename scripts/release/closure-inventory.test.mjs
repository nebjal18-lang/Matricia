import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inventoryPages, collectScopedSeeds, requestedTemplates, releaseConditions } from './closure-inventory.mjs';
const org = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const actors = { client: { organizationId: org }, franchise: { organizationId: org, franchiseIds: [org], libraryIds: [org] } };
test('filesystem inventory excludes groups, private folders and invented routes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'closure-pages-'));
  try {
    for (const folder of ['[locale]/(public)/contact', '[locale]/client/abonnement/cycles/[cycleId]', '_private/example']) {
      await mkdir(join(root, folder), { recursive: true }); await writeFile(join(root, folder, 'page.tsx'), 'export default function Page(){}');
    }
    const pages = await inventoryPages(root);
    assert.deepEqual(pages.map(x => x.template), ['/[locale]/client/abonnement/cycles/[cycleId]', '/[locale]/contact']);
    assert.equal(pages.some(x => x.template.includes('/administration/operations/')), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});
const pages = requestedTemplates.map(template => ({ template }));
const seed = { template: requestedTemplates[0], actor: 'client', organizationId: org, params: { cycleId: org } };
test('same-tenant seed generates four cases without pretending they passed', () => {
  const report = collectScopedSeeds(pages, { actors, seeds: [seed] });
  assert.equal(report.seeds.length, 4); assert.deepEqual(new Set(report.seeds.map(x => x.status)), new Set(['NOT_RUN']));
  assert.equal(report.missingSeedTemplates.length, 4);
});
test('foreign organization cannot fill a missing seed', () => {
  const report = collectScopedSeeds(pages, { actors, seeds: [{ ...seed, organizationId: other }] });
  assert.equal(report.seeds.length, 0); assert.equal(report.rejected[0].reason, 'TENANT_SCOPE_MISMATCH');
  assert.equal(report.missingSeedTemplates.length, 5);
});
test('phantom templates cannot enter the inventory through manifests', () => {
  const report = collectScopedSeeds(pages, { actors, seeds: [{ ...seed, template: '/[locale]/administration/operations/[id]' }] });
  assert.equal(report.rejected[0].reason, 'UNKNOWN_ROUTE_TEMPLATE');
});
test('franchise seed must belong to the assigned franchise', () => {
  const row = { ...seed, actor: 'franchise', template: requestedTemplates[1], franchiseId: other, params: { closureId: org } };
  assert.equal(collectScopedSeeds(pages, { actors, seeds: [row] }).rejected[0].reason, 'FRANCHISE_SCOPE_MISMATCH');
  const report = collectScopedSeeds(pages, { actors, seeds: [{ ...row, franchiseId: org }] });
  assert.equal(report.seeds.length, 4); assert.ok(report.seeds.every(x => x.path.includes('franchiseId=' + org)));
});
test('catalogue ID from a foreign library cannot fill a franchise workspace', () => {
  const template = '/[locale]/franchise/services/[serviceId]';
  const row = { ...seed, template, actor: 'franchise', franchiseId: org, libraryId: other, params: { serviceId: org } };
  assert.equal(collectScopedSeeds([{ template }], { actors, seeds: [row] }).rejected[0].reason, 'WORKSPACE_LIBRARY_REQUIRED');
});
test('catch-all paths reject traversal and report missing data honestly', () => {
  for (const slug of [['..'], ['a/b'], [], ['%2e%2e'], ['a?x=1']]) {
    const row = { ...seed, template: requestedTemplates[2], params: { slug } };
    assert.equal(collectScopedSeeds(pages, { actors, seeds: [row] }).rejected[0].reason, 'INVALID_ROUTE_PARAMETERS');
  }
});
test('release registry preserves statuses without promoting evidence', () => {
  const rows = releaseConditions('| MAT-FUNC-001 | IN_PROGRESS | source |\n| MAT-FUNC-002 | VERIFIED | source |');
  assert.deepEqual(rows.map(x => x.status), ['IN_PROGRESS', 'VERIFIED']);
});
test('enum route parameters remain valid while identifiers require UUIDs', () => {
  const template='/[locale]/franchise/questionnaires/[questionnaireId]/[tool]';
  const row={template,actor:'franchise',organizationId:org,franchiseId:org,libraryId:org,params:{questionnaireId:org,tool:'apercu'}};
  assert.equal(collectScopedSeeds([{template}],{actors,seeds:[row]}).seeds.length,4);
  assert.equal(collectScopedSeeds([{template}],{actors,seeds:[{...row,params:{...row.params,questionnaireId:'not-an-id'}}]}).rejected[0].reason,'INVALID_ROUTE_PARAMETERS');
});
