import { requireDevelopment, loadOwnState } from './safety.mjs';
import { nativeBrowserActor, preserveBrowserSession, safeError } from './browser-session.mjs';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
requireDevelopment();
const state = await loadOwnState();
const quotes = JSON.parse(await readFile(resolve(state.directory, 'quotes/summary.json')));
const upstream = JSON.parse(await readFile(resolve(state.directory, 'quote-prerequisites.private.json')));
if (quotes.status !== 'PASSED' || quotes.appTree !== state.candidate?.appTree || upstream.status !== 'READY') throw Error('ACTUAL_PUBLISHED_NATIVE_PROVIDER_QUOTE_REQUIRED');
const directory = resolve(state.directory, 'quote-revision');
await mkdir(directory, { recursive: true });
const resumePrivate=process.argv.includes('--resume-private-version');
const resume = process.argv.includes('--resume-provider-revision')||resumePrivate;
const previous = resume ? JSON.parse(await readFile(resolve(directory, 'summary.json'))) : null;
if(resume && (previous.status!=='FAILED'||previous.failureStage!=='provider-new-version'||previous.steps.length!==1||previous.appTree!==state.candidate.appTree||previous.originalVersionId!==quotes.versionOneId||!previous.revisionRequest?.revision_request_id))throw Error('EXACT_CLIENT_REQUESTED_REVISION_CHECKPOINT_REQUIRED');
if(!resume)try { await access(resolve(directory, 'summary.json')); throw Error('PRESERVE_EXISTING_NATIVE_REVISION_CHECKPOINT'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const owner = await nativeBrowserActor(state, 'provider-owner'), client = await nativeBrowserActor(state, 'client-owner');
const { chromium, expect } = createRequire(resolve('package.json'))('@playwright/test');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
const origin = `http://127.0.0.1:${state.appPort}`;
const proof = { scope: 'NATIVE_CLIENT_REVISION_REQUEST_AND_PROVIDER_UI_REPLACEMENT', candidate: state.candidate.commit, appTree: state.candidate.appTree, status: 'RUNNING', quoteId: quotes.quoteId, originalVersionId: quotes.versionOneId, steps: [], idempotencyKey: randomUUID() };
const save = () => writeFile(resolve(directory, 'summary.json'), JSON.stringify(proof, null, 2));
let context, clientContext, stage = 'client-revision-request';
await save();
try {
  const before = await owner.client.from('quote_versions').select('id,version_number,solution_fr,total_minor,content_hash').eq('id', quotes.versionOneId).single();
  if (before.error) throw Error('EXACT_ORIGINAL_PUBLISHED_QUOTE_REQUIRED');
  if(resume){const request=await client.client.from('quote_revision_requests').select('id,quote_id,requested_from_version_id,requested_by').eq('id',previous.revisionRequest.revision_request_id).single(),q=await owner.client.from('quotes').select('current_version_id,status').eq('id',quotes.quoteId).single();if(request.error||request.data.quote_id!==quotes.quoteId||request.data.requested_from_version_id!==quotes.versionOneId||request.data.requested_by!==client.actor.userId||q.error||q.data.current_version_id!==(resumePrivate?previous.revisedVersionId:quotes.versionOneId)||q.data.status!==(resumePrivate?'REVISED':'REVISION_REQUESTED'))throw Error('EXACT_PERSISTED_NATIVE_CLIENT_REVISION_REQUEST_REQUIRED');proof.revisionRequest=previous.revisionRequest;proof.steps.push(...previous.steps);proof.idempotencyKey=previous.idempotencyKey;}
  else{const request = await client.client.rpc('request_quote_revision', { p_quote_id: quotes.quoteId, p_expected_version_id: quotes.versionOneId, p_reason: 'TEST ONLY — préciser le rapport et sa remise sans modifier le prix convenu.', p_idempotency_key: proof.idempotencyKey, p_correlation_id: randomUUID() });
  if (request.error || request.data?.outcome !== 'QUOTE_REVISION_REQUESTED') throw Error('NATIVE_CLIENT_REVISION_REQUEST:' + (request.error?.code ?? 'INVALID_RESPONSE'));
  proof.revisionRequest = request.data;
  proof.steps.push({ step: 'actual_counterparty_client_requests_exact_published_revision_via_native_command', passed: true });}
  await save();
  context = await browser.newContext({ viewport: { width: 390, height: 1000 }, hasTouch: true, serviceWorkers: 'block' });
  await context.addCookies(owner.cookies);
  clientContext = await browser.newContext({ viewport: { width: 768, height: 1000 }, serviceWorkers: 'block' });
  await clientContext.addCookies(client.cookies);
  const page = await context.newPage();
  stage = 'provider-new-version';
  await page.goto(`${origin}/fr/sous-traitant/devis/${quotes.quoteId}?organizationId=${owner.actor.organizationId}`, { waitUntil: 'networkidle' });
  const revised = `${before.data.solution_fr}\nPrécision TEST demandée par le client : rapport remis dans le coffre du dossier.`;
  if(!resumePrivate){const form = page.locator('form').filter({ has: page.locator(`input[name="rfqProviderId"][value="${upstream.ids.invitationId}"]`) });
  await expect(form.locator('[name="expectedCurrentVersionId"]')).toHaveValue(quotes.versionOneId);
  await form.locator('[name="solution"]').fill(revised);
  await form.locator('[name="changeReason"]').fill('TEST ONLY — réponse à la demande de révision du client, prix identique.');
  const attachmentConsent=form.locator('[name="shareAttachmentsConfirmed"]');if(await attachmentConsent.count())await attachmentConsent.check();
  const invalid=await form.evaluate(element=>Array.from(element.elements).filter(control=>control.willValidate&&!control.validity.valid).map(control=>({name:control.name,message:control.validationMessage})));
  if(invalid.length)throw Error('NATIVE_REVISION_FORM_INVALID:'+JSON.stringify(invalid));
  await form.getByRole('button', { name: 'Créer la nouvelle version', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => (await owner.client.from('quotes').select('current_version_id').eq('id', quotes.quoteId).single()).data?.current_version_id, { timeout: 25000 }).not.toBe(quotes.versionOneId);
  }
  const current = await owner.client.from('quotes').select('current_version_id,status').eq('id', quotes.quoteId).single();
  if (current.error || !current.data.current_version_id || !['REVISED', 'DRAFT'].includes(current.data.status)) throw Error('ACTUAL_PRIVATE_REVISED_QUOTE_REQUIRED');
  proof.revisedVersionId = current.data.current_version_id;
  const after = await owner.client.from('quote_versions').select('id,version_number,solution_fr,total_minor,content_hash').eq('id', quotes.versionOneId).single();
  const replacement = await owner.client.from('quote_versions').select('version_number,solution_fr,total_minor,created_by').eq('id', proof.revisedVersionId).single();
  if (after.error || replacement.error || JSON.stringify(after.data) !== JSON.stringify(before.data) || replacement.data.solution_fr.replaceAll('\r\n','\n') !== revised || replacement.data.total_minor !== before.data.total_minor || replacement.data.version_number !== before.data.version_number + 1 || replacement.data.created_by!==owner.actor.userId) throw Error('IMMUTABLE_OLD_AND_EXACT_NEW_REVISION_REQUIRED');
  proof.originalSnapshot=before.data;proof.nativePrivateVersionRecovered=resumePrivate;proof.browserFormLineEndingNormalization='HTML_FORM_CRLF_ONLY_NO_TRANSLATION';
  const hidden = await client.client.from('quote_versions').select('id').eq('id', proof.revisedVersionId);
  if (hidden.error || hidden.data.length !== 0) throw Error('CLIENT_MUST_NOT_READ_UNPUBLISHED_REVISION');
  const clientPage = await clientContext.newPage();
  await clientPage.goto(`${origin}/fr/client/demandes/${upstream.ids.requestId}/offres/${quotes.quoteId}?organizationId=${client.actor.organizationId}`, { waitUntil: 'networkidle' });
  await expect(clientPage.getByRole('heading', { name: 'Révision du devis en cours', exact: true })).toBeVisible();
  await clientPage.screenshot({ path: resolve(directory, 'client-retained-published-fr-768.png'), fullPage: true });
  proof.steps.push({ step: 'keyboard_provider_creates_new_private_version_old_publication_stays_immutable_and_client_can_read_history_only', passed: true });
  await save();
  stage = 'republish';
  await page.reload({ waitUntil: 'networkidle' });
  const publish = page.locator('form').filter({ has: page.locator(`input[name="quoteVersionId"][value="${proof.revisedVersionId}"]`) }).filter({ has: page.locator('[name="confirmed"]') });
  await publish.locator('[name="confirmed"]').check();
  await publish.getByRole('button', { name: 'Soumettre ce devis', exact: true }).tap();
  await expect.poll(async () => (await owner.client.from('quotes').select('status').eq('id', quotes.quoteId).single()).data?.status, { timeout: 25000 }).toBe('SUBMITTED');
  const visible = await client.client.from('quote_versions').select('id').in('id', [quotes.versionOneId, proof.revisedVersionId]);
  if (visible.error || visible.data.length !== 2) throw Error('BOTH_REAL_PUBLISHED_VERSIONS_MUST_BE_VISIBLE_TO_AUTHORIZED_CLIENT');
  await clientPage.reload({ waitUntil: 'networkidle' });
  await expect(clientPage.getByRole('heading', { name: 'Révision du devis en cours', exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(directory, 'provider-republished-fr-390.png'), fullPage: true });
  proof.steps.push({ step: 'touch_confirmed_republication_restores_current_comparison_without_erasing_published_history', passed: true });
  proof.status = 'PASSED';
} catch (error) { proof.status = 'FAILED'; proof.failureStage = stage; proof.failure = safeError(error.message); process.exitCode = 1; await context?.pages().at(-1)?.screenshot({path:resolve(directory,'failure.png'),fullPage:true}).catch(()=>{}); }
finally {
  if (context) await preserveBrowserSession(state, 'provider-owner', context).catch(() => {});
  if (clientContext) await preserveBrowserSession(state, 'client-owner', clientContext).catch(() => {});
  await browser.close(); await save();
  console.log(JSON.stringify({ status: proof.status, steps: proof.steps.length, failureStage: proof.failureStage, failure: proof.failure }));
}
