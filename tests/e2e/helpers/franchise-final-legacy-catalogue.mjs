import { fixtureState, sourceCandidate, privateDirectory, actorSession, staffActor, persistPrivate } from './franchise-final-support.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const state = await fixtureState(), pin = await sourceCandidate();
if (pin.migrations.length < 559 || JSON.stringify(state.candidate.migrations) !== JSON.stringify(pin.migrations)) throw Error('REVIEWED_NATIVE_PRIMARY_LINK_REPAIR_SCHEMA_REQUIRED');
const directory = await privateDirectory(state), file = resolve(directory, 'actors.private.json'), cohort = JSON.parse(await readFile(file));
if (cohort.library.code !== 'TEST_PROVIDER_B9BD23E48232') throw Error('EXACT_RESERVED_TEST_LIBRARY_REQUIRED');
const owner = cohort.actors.find(value => value.label === 'owner'), mandate = cohort.mandates.find(value => value.label === 'FIRST');
const native = await actorSession(state, owner, file, cohort), reviewer = await staffActor(state, 'governance-reviewer');
if (owner.userId === reviewer.actor.userId) throw Error('DISTINCT_NATIVE_CATALOGUE_REVIEWER_REQUIRED');
const out = resolve(`docs/franchise-completion/evidence/browser/legacy-catalogue-${pin.commit.slice(0, 7)}`); await mkdir(out, { recursive: true });
const proof = { scope: 'GOVERNED_NEW_VERSIONS_REPAIR_HISTORICAL_TEST_PRIMARY_LINKS', candidate: pin.commit, appTree: pin.appTree, status: 'RUNNING', directLinkOrPublishedStateWrite: false, artificialParentChange: false, productionCatalogueTouched: false, commercialTranslatorCertified: false, steps: [] };
async function saveProof() { await writeFile(resolve(out, 'summary.json'), JSON.stringify(proof, null, 2) + '\n'); }
async function step(value) { proof.steps.push(value); await saveProof(); console.log(JSON.stringify({ stage: value.id, code: value.code, status: value.status })); }
async function readIdentity(id) { const r = await native.client.from('catalog_services').select('id,code,status,row_version,primary_subcategory_id,current_draft_version_id,current_published_version_id').eq('id', id).single(); if (r.error) throw Error('NATIVE_TEST_SERVICE_READ_FAILED:' + r.error.code); return r.data; }
async function readVersion(id) { const r = await native.client.from('catalog_service_versions').select('id,status,row_version,content_hash,created_by,name_fr,name_ar,short_description_fr,short_description_ar,translation_review_status').eq('id', id).single(); if (r.error) throw Error('NATIVE_TEST_VERSION_READ_FAILED:' + r.error.code); return r.data; }
async function primary(service) { const r = await native.client.from('catalog_service_subcategory_links').select('id,status,subcategory_id,current_version_id').eq('service_id', service.id).eq('link_type', 'PRIMARY').not('status', 'in', '(ARCHIVED,RETIRED)').maybeSingle(); if (r.error) throw Error('NATIVE_PRIMARY_LINK_READ_FAILED:' + r.error.code); return r.data; }
const origin = `http://127.0.0.1:${state.appPort}`, query = new URLSearchParams({ organizationId: owner.organizationId, franchiseId: mandate.activation.franchiseId });
const target = id => `${origin}/fr/franchise/services/${id}?${query}`;
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' }), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
await context.addCookies(native.cookies); const page = await context.newPage();
try {
  if (!cohort.legacyRegularization) {
    const found = await native.client.from('catalog_services').select('id,code,current_published_version_id').eq('library_id', cohort.library.id).eq('status', 'PUBLISHED').like('code', 'TEST_SERVICE_%_B9BD23E48232').order('code');
    if (found.error || found.data?.length !== 2) throw Error('EXACT_TWO_HISTORICAL_RESERVED_TEST_SERVICES_REQUIRED');
    cohort.legacyRegularization = [];
    for (const service of found.data) {
      const old = await readVersion(service.current_published_version_id);
      if (old.status !== 'PUBLISHED') throw Error('EXACT_PUBLISHED_HISTORY_REQUIRED');
      cohort.legacyRegularization.push({ id: service.id, code: service.code, originalVersionId: old.id, originalHash: old.content_hash, originalNameFr: old.name_fr, originalNameAr: old.name_ar, originalDescriptionFr: old.short_description_fr, originalDescriptionAr: old.short_description_ar });
    }
    await persistPrivate(file, cohort);
  }
  for (const intent of cohort.legacyRegularization) {
    let identity = await readIdentity(intent.id);
    if (!intent.draftId) {
      if (await primary(identity)) throw Error('INITIAL_MISSING_PRIMARY_TEST_PRECONDITION_CHANGED');
      await page.goto(target(intent.id), { waitUntil: 'networkidle', timeout: 90000 });
      const form = page.locator('form').filter({ has: page.locator('textarea[name="descriptionFr"]') }).first();
      const autosave = form.getByLabel('Enregistrer automatiquement le brouillon', { exact: true }); if (await autosave.count()) await autosave.uncheck();
      for (const name of ['fulfillmentConfig', 'visibilityRules']) { const input = form.locator(`textarea[name="${name}"]`); const value = JSON.parse(await input.inputValue()); if (!Object.hasOwn(value, 'schema_version')) { const details = input.locator('xpath=ancestor::details[1]'); if (await details.count() && !(await details.evaluate(element => element.open))) await details.locator('summary').first().click(); await input.fill(JSON.stringify({ ...value, schema_version: 1 }, null, 2)); } }
      const selectedParent = await form.locator('select[name="subcategoryId"]').inputValue();
      if (selectedParent !== identity.primary_subcategory_id) throw Error('PUBLISHED_PARENT_MUST_NOT_BE_CHANGED');
      await form.locator('input[name="changeReason"]').fill('TEST ONLY — nouvelle version gouvernée pour régulariser le lien primaire historique, parent inchangé.');
      await form.getByRole('button', { name: 'Enregistrer brouillon', exact: true }).click();
      await expect.poll(async () => { const id = (await readIdentity(intent.id)).current_draft_version_id; return typeof id === 'string' && id !== intent.originalVersionId; }, { timeout: 30000 }).toBe(true);
      identity = await readIdentity(intent.id); const draft = await readVersion(identity.current_draft_version_id), link = await primary(identity);
      if (!link || link.status !== 'DRAFT' || link.subcategory_id !== selectedParent || draft.status !== 'DRAFT' || draft.created_by !== owner.userId || draft.name_fr !== intent.originalNameFr || draft.name_ar !== intent.originalNameAr || draft.short_description_fr !== intent.originalDescriptionFr || draft.short_description_ar !== intent.originalDescriptionAr) throw Error('NATIVE_SAME_PARENT_DRAFT_AND_PRIMARY_LINK_REQUIRED');
      intent.draftId = draft.id; intent.primaryLinkId = link.id; intent.draftAtCandidate = pin.commit; await persistPrivate(file, cohort);
      await step({ id: 'PUBLISHED_TEST_SOURCE_TO_NEW_DRAFT_AND_PRIMARY_NATIVE_UI', code: intent.code, status: 'PASS', parentUnchanged: true, originalVersionRetained: true, primaryLinkStatus: link.status });
      await page.screenshot({ path: resolve(out, `${intent.code.toLowerCase()}-draft-fr-1440.png`), fullPage: true });
    }
    if (!intent.submitted) {
      await page.goto(target(intent.id), { waitUntil: 'networkidle', timeout: 90000 });
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Soumettre à Matricia', exact: true }) }).first();
      await form.locator('input[name="confirmed"]').check(); await form.getByRole('button', { name: 'Soumettre à Matricia', exact: true }).click();
      await expect.poll(async () => (await readVersion(intent.draftId)).status, { timeout: 30000 }).toBe('IN_REVIEW');
      intent.submitted = true; intent.submittedAtCandidate = pin.commit; await persistPrivate(file, cohort);
      await step({ id: 'NEW_VERSION_AND_PRIMARY_SUBMITTED_BY_UI', code: intent.code, status: 'PASS' });
    }
    if (!intent.approved) {
      const change = await reviewer.client.from('catalog_change_requests').select('id,row_version').eq('target_type', 'SERVICE').eq('target_id', intent.id).eq('target_version_id', intent.draftId).eq('status', 'IN_REVIEW').single();
      if (change.error) throw Error('EXACT_PENDING_CENTRAL_REVIEW_REQUIRED:' + change.error.code);
      const args = { p_change_request_id: change.data.id, p_decision: 'APPROVE', p_reason: 'TEST ONLY revue centrale indépendante de la nouvelle version et de son lien primaire inchangé.', p_expected_row_version: change.data.row_version, p_idempotency_key: randomUUID() };
      const own = await native.client.rpc('decide_catalog_change', args); if (own.error?.code !== '42501') throw Error('SERVICE_SELF_APPROVAL_MUST_BE_DENIED');
      const decision = await reviewer.client.rpc('decide_catalog_change', { ...args, p_idempotency_key: randomUUID() }); if (decision.error) throw Error('INDEPENDENT_SERVICE_APPROVAL_FAILED:' + decision.error.code);
      if ((await readVersion(intent.draftId)).status !== 'APPROVED' || (await primary(await readIdentity(intent.id)))?.status !== 'APPROVED') throw Error('BOTH_NEW_VERSION_AND_PRIMARY_MUST_BE_REVIEWED');
      intent.approved = true; intent.approvedAtCandidate = pin.commit; await persistPrivate(file, cohort); await step({ id: 'INDEPENDENT_CENTRAL_APPROVAL_OF_VERSION_AND_PRIMARY', code: intent.code, status: 'PASS', selfApprovalDenied: true });
    }
    if (!intent.arAttested) {
      const draft = await readVersion(intent.draftId);
      if (draft.name_ar !== intent.originalNameAr || draft.short_description_ar !== intent.originalDescriptionAr || !/[\u0600-\u06ff]/u.test(draft.name_ar)) throw Error('UNCHANGED_EXPLICIT_AR_TEST_TEXT_REQUIRED');
      const review = { scope: 'TEST_ONLY_INDEPENDENT_AR_REVIEW_OF_REGULARIZED_SERVICE_VERSION', candidate: pin.commit, originalVersionId: intent.originalVersionId, newVersionId: draft.id, contentHash: draft.content_hash, nameFr: draft.name_fr, nameAr: draft.name_ar, descriptionFr: draft.short_description_fr, descriptionAr: draft.short_description_ar, originalBilingualTextsPreserved: true, commercialTranslatorCertified: false };
      const bytes = Buffer.from(JSON.stringify(review, null, 2) + '\n'), hash = createHash('sha256').update(bytes).digest('hex'); await writeFile(resolve(out, `${intent.code.toLowerCase()}-ar-review.json`), bytes);
      const own = await native.client.rpc('attest_catalog_ar_translation', { p_object_type: 'SERVICE', p_version_id: draft.id, p_proof_hash: hash, p_expected_row_version: draft.row_version, p_idempotency_key: randomUUID() });
      if (own.error?.code !== '42501') throw Error('AR_SELF_REVIEW_MUST_BE_DENIED');
      const attested = await reviewer.client.rpc('attest_catalog_ar_translation', { p_object_type: 'SERVICE', p_version_id: draft.id, p_proof_hash: hash, p_expected_row_version: draft.row_version, p_idempotency_key: randomUUID() });
      if (attested.error || attested.data?.outcome !== 'CATALOG_AR_TRANSLATION_ATTESTED') throw Error('INDEPENDENT_AR_REVIEW_FAILED:' + attested.error?.code);
      intent.arAttested = true; intent.arAttestedAtCandidate = pin.commit; await persistPrivate(file, cohort); await step({ id: 'NATIVE_INDEPENDENT_AR_REVIEW', code: intent.code, status: 'PASS', selfReviewDenied: true, proofSha256: hash });
    }
    const old = await readVersion(intent.originalVersionId); if (old.content_hash !== intent.originalHash || old.name_fr !== intent.originalNameFr || old.name_ar !== intent.originalNameAr) throw Error('ORIGINAL_PUBLISHED_CONTENT_MUST_REMAIN_IMMUTABLE');
    await step({ id: 'HISTORICAL_PUBLISHED_VERSION_HASH_AND_TEXT_UNCHANGED', code: intent.code, status: 'PASS' });
  }
  proof.status = 'PASSED_NATIVE_REGULARIZATION_PUBLICATION_STILL_REQUIRES_RELEASE';
} catch (error) {
  proof.status = 'FAILED'; proof.failure = String(error).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu, '[REDACTED]').slice(0, 1600); proof.alerts = await page.locator('[role="alert"]').allTextContents().catch(() => []); await page.screenshot({ path: resolve(out, 'failure-fr-1440.png'), fullPage: true }).catch(() => {}); process.exitCode = 1;
} finally { await context.close(); await browser.close(); await saveProof(); console.log(JSON.stringify({ status: proof.status, stages: proof.steps.length, failure: proof.failure })); }
