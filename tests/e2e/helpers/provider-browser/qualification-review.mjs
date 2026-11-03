import { requireDevelopment, loadOwnState } from './safety.mjs';
import { nativeBrowserActor, preserveBrowserSession, safeError } from './browser-session.mjs';
import { scanKnownProviderDocuments } from './known-provider-scan.mjs';
import { localFixturePdf } from '../local-fixture-pdf.mjs';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
requireDevelopment();
const state = await loadOwnState();
const questionnaire = JSON.parse(await readFile(resolve(state.directory, 'questionnaire/summary.json')));
const fixture = JSON.parse(await readFile(resolve(state.directory, 'catalogue-fixture-provenance.json')));
const resumeQualification=process.argv.includes('--resume-qualification');
const priorQuestionnaireAllowed=resumeQualification&&state.previousCandidates?.some(pin=>pin.commit===questionnaire.candidate&&pin.appTree===questionnaire.appTree);
if (questionnaire.status !== 'PASSED' || (questionnaire.appTree !== state.candidate?.appTree&&!priorQuestionnaireAllowed)) throw new Error('ACTUAL_PROVIDER_QUESTIONNAIRE_SUBMISSION_REQUIRED');
const owner = await nativeBrowserActor(state, 'provider-owner'), reviewer = await nativeBrowserActor(state, 'compliance-reviewer');
if (owner.actor.userId === reviewer.actor.userId) throw new Error('INDEPENDENT_NATIVE_PROVIDER_REVIEW_REQUIRED');
const { chromium, expect } = createRequire(resolve('package.json'))('@playwright/test');
const origin = `http://127.0.0.1:${state.appPort}`;
const proof = {
  scope: 'NATIVE_PROVIDER_PARTNER_DOCUMENT_AND_INDEPENDENT_QUALIFICATION_REVIEW',
  status: 'RUNNING', candidate: state.candidate.commit, appTree: state.candidate.appTree, steps: [],
  partnerSignatureSource: 'HISTORICAL_TEST_LEGAL_SIGNATURE_PREREQUISITE_NOT_CERTIFIED',
  legalSignatureCertified: false, physicalAntivirusCertified: false, catalogueGovernanceCertified: false,
};
const resumeReview=process.argv.includes('--resume-review');let previous;
if(resumeReview){previous=JSON.parse(await readFile(resolve(state.directory,'qualification-reviewed.json')));if(previous.appTree!==state.candidate.appTree||previous.status!=='FAILED'||previous.failureStage!=='company-attestation'||previous.steps.length!==1||!previous.partnerDocument?.id)throw Error('EXACT_PARTNER_REVIEW_CHECKPOINT_REQUIRED');const existing=await owner.client.from('provider_document_versions').select('id,status,content_hash').eq('provider_organization_id',owner.actor.organizationId).eq('content_hash',previous.partnerDocument.sha256).eq('status','VERIFIED').single();if(existing.error||existing.data.status!=='VERIFIED'||existing.data.content_hash!==previous.partnerDocument.sha256)throw Error('ACTUAL_ALREADY_REVIEWED_PARTNER_FILE_REQUIRED');proof.partnerDocument={...previous.partnerDocument,reviewedVersionId:existing.data.id};proof.steps.push(...previous.steps);}
if(resumeQualification){previous=JSON.parse(await readFile(resolve(state.directory,'qualification-reviewed.json')));if(previous.status!=='FAILED'||previous.failureStage!=='human-service-APPROVED'||previous.steps.length!==3||(!state.previousCandidates?.some(pin=>pin.appTree===previous.appTree)&&previous.appTree!==state.candidate.appTree))throw Error('EXACT_PENDING_SERVICE_REVIEW_CHECKPOINT_REQUIRED');const session=await owner.client.from('questionnaire_sessions').select('organization_id,status,audience,is_simulation').eq('id',questionnaire.sessionId).single(),identity=await owner.client.rpc('get_my_provider_legal_identity_v1',{p_organization_id:owner.actor.organizationId}),partner=await owner.client.from('provider_profiles').select('partner_contract_status').eq('provider_organization_id',owner.actor.organizationId).single();if(session.error||session.data.organization_id!==owner.actor.organizationId||session.data.status!=='SUBMITTED'||session.data.audience!=='PROVIDER'||session.data.is_simulation||identity.error||!identity.data.currently_verified||partner.data?.partner_contract_status!=='SIGNED')throw Error('PERSISTED_NATIVE_ENTRY_AND_REVIEW_MUST_REMAIN_VALID');proof.steps.push(...previous.steps.map(step=>({...step,candidate:step.candidate??previous.candidate})));proof.partnerDocument=previous.partnerDocument;proof.sourceQuestionnaireCandidate=questionnaire.candidate;}
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
let context, activeLabel = 'provider-owner', stage = 'partner-document';
async function call(client, name, input) { const r = await client.rpc(name, input); if (r.error) throw new Error(`NATIVE_PROVIDER_${name}:${r.error.code}`); return r.data; }
async function openFormDetails(form) { const ancestors=form.locator('xpath=ancestor::details');for(let i=0;i<await ancestors.count();i++){const details=ancestors.nth(i);if(!(await details.evaluate(element=>element.open)))await details.locator(':scope > summary').click();} }
try {
 if(!resumeReview&&!resumeQualification){
  context = await browser.newContext({ viewport: { width: 390, height: 960 }, hasTouch: true, serviceWorkers: 'block' });
  await context.addCookies(owner.cookies);
  let page = await context.newPage();
  await page.goto(`${origin}/fr/sous-traitant/qualification?organizationId=${owner.actor.organizationId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const bytes = localFixturePdf([
    'TEST ONLY / NON_CONTRACTUAL_DEMO / NOT AN OFFICIAL DOCUMENT',
    'Synthetic representation of a pre-existing signed partnership for TEST acceptance only.',
    'No legal execution or official publisher is certified by this fixture.',
    `Organization: ${owner.actor.organizationId}`,
  ]);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const upload = page.locator('form').filter({ has: page.locator('input[name="documentFile"]') });
  await upload.locator('[name="documentFile"]').setInputFiles({ name: 'TEST_NON_CONTRACTUAL_DEMO_PARTNER.pdf', mimeType: 'application/pdf', buffer: bytes });
  await upload.locator('[name="documentKind"]').selectOption('PARTNER_CONTRACT');
  await upload.locator('[name="code"]').fill(`TEST_PARTNER_${state.token.replaceAll('-', '').slice(0, 8).toUpperCase()}`);
  await upload.locator('[name="issuerName"]').fill('TEST uniquement — précondition historique non contractuelle');
  await upload.locator('[name="referenceNumber"]').fill('NON_CONTRACTUAL_DEMO');
  await upload.locator('[name="changeReason"]').fill('TEST uniquement — représentation synthétique de la signature juridique historique, non certifiée par cette recette.');
  await upload.getByRole('button').last().tap();
  await expect.poll(async () => { const r = await owner.client.from('provider_document_versions').select('id').eq('provider_organization_id', owner.actor.organizationId).eq('content_hash', sha256).eq('status', 'SUBMITTED'); return r.error ? -1 : r.data.length; }, { timeout: 25000 }).toBe(1);
  const original = await owner.client.from('provider_document_versions').select('id,storage_object_path').eq('provider_organization_id', owner.actor.organizationId).eq('content_hash', sha256).eq('status', 'SUBMITTED').single();
  if (original.error) throw new Error('ACTUAL_PARTNER_TEST_DOCUMENT_REQUIRED');
  const document = { id: original.data.id, path: original.data.storage_object_path, sha256, sizeBytes: bytes.length };
  const scan = await scanKnownProviderDocuments(state, [document]);
  await call(reviewer.client, 'review_provider_document', { p_document_version_id: document.id, p_status: 'VERIFIED', p_rationale: 'TEST uniquement — reçu documentaire non contractuel de la précondition historique, pas une signature juridique certifiée.', p_rule_version: 'TEST-NATIVE-PARTNER', p_idempotency_key: `native-partner-review-${document.id}` });
  proof.partnerDocument = { id: document.id, sha256, scan };
  proof.steps.push({ step: 'actual_private_partner_upload_scan_and_independent_document_review', passed: true });
  await preserveBrowserSession(state, activeLabel, context); await context.close();
 }
  activeLabel = 'compliance-reviewer';
  context = await browser.newContext({ viewport: { width: 768, height: 1024 }, hasTouch: true, serviceWorkers: 'block' });
  await context.addCookies(reviewer.cookies); let page = await context.newPage();
 if(!resumeQualification){
  stage = 'company-attestation';
  await page.goto(`${origin}/fr/administration/providers`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const company = page.locator('form').filter({ has: page.locator(`input[name="organizationId"][value="${owner.actor.organizationId}"]`) }).filter({ has: page.locator('select[name="companyStatus"]') });
  await openFormDetails(company);
  await company.locator('[name="companyStatus"]').selectOption('VERIFIED');
  await company.locator('[name="partnerContractStatus"]').selectOption('SIGNED');
  await company.locator('[name="ruleVersion"]').fill('TEST-NATIVE-PARTNER');
  await company.locator('[name="reason"]').fill('TEST uniquement — attestation administrative de la précondition historique de partenariat. Le PDF NON_CONTRACTUAL_DEMO ne certifie aucune signature juridique.');
  await company.getByRole('button').last().tap();
  await expect.poll(async () => { const r = await owner.client.from('provider_profiles').select('partner_contract_status').eq('provider_organization_id', owner.actor.organizationId).single(); return r.data?.partner_contract_status; }, { timeout: 20000 }).toBe('SIGNED');
  proof.steps.push({ step: 'independent_admin_ui_attests_test_historical_partnership_without_direct_sql_state_write', passed: true });
  stage = 'current-identity-recheck';
  await page.goto(`${origin}/fr/administration/providers/${owner.actor.organizationId}/identite`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('input[name="confirmed"]').check();
  await page.locator('textarea[name="reason"]').fill('TEST uniquement — revalidation du profil exact après la nouvelle décision administrative de partenariat.');
  await page.getByRole('button', { name: 'Vérifier l’identité courante', exact: true }).tap();
  await expect.poll(async () => (await call(owner.client, 'get_my_provider_legal_identity_v1', { p_organization_id: owner.actor.organizationId })).currently_verified, { timeout: 20000 }).toBe(true);
  proof.steps.push({ step: 'current_identity_revalidated_after_company_decision_change', passed: true });
 }
  const qualifications = await owner.client.from('provider_qualifications').select('id,service_id,row_version').eq('provider_organization_id', owner.actor.organizationId);
  if (qualifications.error || qualifications.data.length !== 2) throw new Error('TWO_NATIVE_REQUESTED_SERVICE_QUALIFICATIONS_REQUIRED');
  for (const [serviceId, status] of [[fixture.ids.serviceA, 'APPROVED'], [fixture.ids.serviceB, 'INFORMATION_REQUIRED']]) {
    stage = `human-service-${status}`;
    const row = qualifications.data.find(value => value.service_id === serviceId);
    await page.goto(`${origin}/fr/administration/providers`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const form = page.locator('form').filter({ has: page.locator(`input[name="qualificationId"][value="${row.id}"]`) });
    await openFormDetails(form);
    await form.locator('[name="status"]').selectOption(status);
    if (status === 'APPROVED') {
      await form.getByRole('button', { name: 'Charger les questionnaires soumis', exact: true }).tap();
      const deposit = form.getByLabel('Dépôt à examiner');
      await expect(deposit).toBeEnabled({ timeout: 25000 });
      await deposit.selectOption(questionnaire.sessionId);
      await expect(form.locator('[name="questionnaireSessionId"]')).toHaveValue(questionnaire.sessionId);
      await expect(form.locator('[name="reviewedManifestHash"]')).toHaveValue(/^[a-f0-9]{64}$/u);
      const answers = form.getByRole('region', { name: 'Questions et réponses déposées', exact: true });
      await expect(answers).toBeVisible();
      await expect(answers).toContainText('Score du moteur figé');
      if (await answers.locator('li').count() < 1) throw Error('ACTUAL_FROZEN_PROVIDER_ANSWERS_REQUIRED_BEFORE_HUMAN_REVIEW');
      await form.locator('[name="scorePercent"]').fill('80');
      await form.locator('[name="evidenceConfirmed"]').check();
      proof.reviewedQuestionnaire = { sessionId: questionnaire.sessionId, explicitSelection: true, frozenQuestionsDisplayed: true, manifestHash: await form.locator('[name="reviewedManifestHash"]').inputValue(), engineScoreDisplayed: true, humanScorePercent: '80' };
      await page.screenshot({ path: resolve(state.directory, 'qualification-evidence-explicit-fr-768.png'), fullPage: true });
    }
    else await form.locator('[name="blockingConditions"]').fill('TEST uniquement — pièce complémentaire propre au service B à fournir.');
    await form.locator('[name="rationale"]').fill(`TEST uniquement — revue indépendante du questionnaire Provider et des pièces actuelles : ${status}.`);
    await form.getByRole('button').last().tap();
    await expect.poll(async () => { const r = await owner.client.rpc('explain_provider_service_eligibility', { p_provider_organization_id: owner.actor.organizationId, p_service_id: serviceId }); return r.data?.qualification_status; }, { timeout: 20000 }).toBe(status);
  }
  const eligible = await call(owner.client, 'explain_provider_service_eligibility', { p_provider_organization_id: owner.actor.organizationId, p_service_id: fixture.ids.serviceA });
  const needsInformation = await call(owner.client, 'explain_provider_service_eligibility', { p_provider_organization_id: owner.actor.organizationId, p_service_id: fixture.ids.serviceB });
  if (eligible.eligible !== true || needsInformation.eligible !== false) throw new Error('ACTUAL_SERVICE_SPECIFIC_ELIGIBILITY_REQUIRED:' + JSON.stringify({ a: eligible.reasons, b: needsInformation.reasons }));
  proof.steps.push({ step: 'native_independent_service_A_approval_and_service_B_information_required_remain_separate', passed: true });
  const row = qualifications.data.find(value => value.service_id === fixture.ids.serviceA);
  const self = await owner.client.rpc('decide_provider_qualification', { p_qualification_id: row.id, p_status: 'APPROVED', p_questionnaire_session_id: questionnaire.sessionId, p_score_basis_points: 8000, p_mandatory_checks: [{ check: 'TEST', passed: true }], p_blocking_conditions: [], p_rationale: 'TEST self-qualification must remain denied', p_rule_version: 'TEST-NATIVE-PROVIDER', p_expires_at: null, p_expected_row_version: row.row_version, p_idempotency_key: randomUUID() });
  if (self.error?.code !== '42501') throw new Error('PROVIDER_SELF_QUALIFICATION_MUST_BE_DENIED');
  proof.steps.push({ step: 'provider_owner_cannot_self_approve_service', passed: true });
  proof.status = 'PASSED';
  await page.screenshot({ path: resolve(state.directory, 'qualification-independent-admin-fr-768.png'), fullPage: true });
} catch (error) {
  proof.status = 'FAILED'; proof.failureStage = stage; proof.failure = safeError(error.message); process.exitCode = 1;
  await context?.pages().at(-1)?.screenshot({ path: resolve(state.directory, 'qualification-current-failure-fr-768.png'), fullPage: true }).catch(() => {});
} finally {
  if (context) await preserveBrowserSession(state, activeLabel, context).catch(() => {});
  await browser.close();
  await writeFile(resolve(state.directory, 'qualification-reviewed.json'), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify({ status: proof.status, steps: proof.steps.length, failureStage: proof.failureStage, failure: proof.failure }));
}
