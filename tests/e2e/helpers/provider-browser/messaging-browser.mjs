import { requireDevelopment, loadOwnState } from './safety.mjs';
import { nativeBrowserActor, preserveBrowserSession, safeError } from './browser-session.mjs';
import { localFixturePdf } from '../local-fixture-pdf.mjs';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
requireDevelopment();
const state = await loadOwnState(), contract = JSON.parse(await readFile(resolve(state.directory, 'contract-mission/summary.json'))), upstream = JSON.parse(await readFile(resolve(state.directory, 'quote-prerequisites.private.json')));
if (contract.status !== 'PASSED' || contract.appTree !== state.candidate?.appTree || upstream.status !== 'READY') throw Error('ACTUAL_NATIVE_POSTCONTRACT_PARTIES_REQUIRED');
const directory = resolve(state.directory, 'messaging'); await mkdir(directory, { recursive: true });
const resumeScan=process.argv.includes('--resume-pending-scan');
const resumeExisting=process.argv.includes('--resume-private-attachment')||resumeScan;
const resume=process.argv.includes('--resume-attachment')||resumeExisting,previous=resume?JSON.parse(await readFile(resolve(directory,'summary.json'))):null;
if(resume&&(previous.status!=='FAILED'||previous.failureStage!==(resumeScan?'known-file-test-scan':'private-attachment-draft')||previous.steps.length!==1||previous.appTree!==state.candidate.appTree||!previous.threadId||(resumeScan?!previous.draftId||!previous.uploadId:Boolean(previous.draftId))))throw Error('EXACT_REAL_TEXT_MESSAGE_BEFORE_ATTACHMENT_CHECKPOINT_REQUIRED');
if(!resume)try { await access(resolve(directory, 'summary.json')); throw Error('PRESERVE_EXISTING_NATIVE_MESSAGE_CHECKPOINT'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const owner = await nativeBrowserActor(state, 'provider-owner'), client = await nativeBrowserActor(state, 'client-owner'), foreign = await nativeBrowserActor(state, 'foreign-provider');
const { chromium, expect } = createRequire(resolve('package.json'))('@playwright/test'), { createClient } = createRequire(resolve('apps/web/package.json'))('@supabase/supabase-js');
const service = createClient(`http://127.0.0.1:${state.gatewayPort}`, state.serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }), browser = await chromium.launch({ executablePath: '/usr/bin/chromium' }), contexts = [], origin = `http://127.0.0.1:${state.appPort}`;
const proof = { scope: 'NATIVE_POSTCONTRACT_PROVIDER_CLIENT_CONVERSATION_AND_PRIVATE_ATTACHMENT', candidate: state.candidate.commit, appTree: state.candidate.appTree, status: 'RUNNING', physicalAntivirusCertified: false, steps: [] }, save = () => writeFile(resolve(directory, 'summary.json'), JSON.stringify(proof, null, 2));
async function contextFor(actor, width) { const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: true, serviceWorkers: 'block' }); await context.addCookies(actor.cookies); contexts.push({ context, label: actor.actor.label }); return context; }
async function thread(actor) { const r = await actor.client.rpc('get_internal_message_thread_page_for_organization_v1', { p_thread_id: proof.threadId, p_organization_id: actor.actor.organizationId, p_before_created_at: null, p_before_message_id: null, p_page_size: 50 }); if (r.error) throw Error('NATIVE_MESSAGE_THREAD_READ:' + r.error.code); return r.data; }
let stage = 'postcontract-thread'; await save();
try {
  const oc = await contextFor(owner, 390), cc = await contextFor(client, 768), fc = await contextFor(foreign, 390), page = await oc.newPage();
  const body = 'Message TEST après signature — نص المستخدم الأصلي محفوظ';
  if(resume){proof.threadId=previous.threadId;proof.steps.push(...previous.steps);await page.goto(`${origin}/fr/sous-traitant/messages/${proof.threadId}?organizationId=${owner.actor.organizationId}`,{waitUntil:'domcontentloaded',timeout:90000});if((await thread(owner)).messages.filter(m=>m.body===body).length!==1)throw Error('EXACT_PERSISTED_NATIVE_OWNER_MESSAGE_REQUIRED');}
  else{
  await page.goto(`${origin}/fr/sous-traitant/messages?organizationId=${owner.actor.organizationId}&rfqId=${upstream.ids.rfqId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const open = page.locator('form').filter({ has: page.locator('input[name="rfqId"]') }).filter({ has: page.locator('[name="subject"]') });
  await expect(open.locator('[name="rfqId"]')).toHaveValue(upstream.ids.rfqId);
  await open.locator('[name="subject"]').fill('TEST ONLY — suivi du dossier contractuel'); await open.getByRole('button').last().tap();
  await expect.poll(() => new URL(page.url()).pathname).toMatch(/\/sous-traitant\/messages\/[a-f0-9-]{36}$/u);
  proof.threadId = new URL(page.url()).pathname.split('/').at(-1);
  const conversation = await thread(owner);
  if (conversation.thread?.participant_organization_id !== owner.actor.organizationId || conversation.thread?.can_send !== true) throw Error('ACTUAL_POSTCONTRACT_PARTICIPANT_CONTEXT_REQUIRED');
  stage = 'native-text';
  const send = page.locator('form').filter({ has: page.locator('textarea[name="body"]') }); await send.locator('[name="body"]').fill(body); await send.getByRole('button').last().focus(); await page.keyboard.press('Enter');
  await expect.poll(async () => (await thread(owner)).messages.filter(m => m.body === body).length, { timeout: 20000 }).toBe(1);
  const clientThread = await thread(client); if (clientThread.messages.filter(m => m.body === body).length !== 1) throw Error('SAME_REAL_COUNTERPARTY_MESSAGE_REQUIRED');
  proof.steps.push({ step: 'native_provider_keyboard_message_persists_once_in_same_postcontract_client_thread', passed: true }); await save();
  }
  stage = 'private-attachment-draft';
  const workspace = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Message avec pièces jointes — brouillon privé', exact: true }) }).last();
  const bytes = localFixturePdf(['TEST ONLY / NON_CONTRACTUAL_DEMO', 'Private postcontract conversation attachment.', `Thread: ${proof.threadId}`]), sha256 = createHash('sha256').update(bytes).digest('hex'), attachmentBody = 'Pièce TEST préparée dans un brouillon privé — نص أصلي';
  const drafts = () => owner.client.rpc('get_internal_message_attachment_drafts_v1', { p_thread_id: proof.threadId, p_sender_organization_id: owner.actor.organizationId, p_page: 1 });
  if(resumeExisting){const existing=await drafts(),matches=existing.data?.drafts?.filter(d=>d.body===attachmentBody&&d.files.length===1&&d.files[0].name==='TEST_ONLY_MESSAGE.pdf'&&Number(d.files[0].size_bytes)===bytes.length&&d.files[0].upload_status==='UPLOADED'&&d.files[0].scan_status==='PENDING');if(existing.error||matches?.length!==1)throw Error('EXACT_NATIVE_PRIVATE_PENDING_ATTACHMENT_REQUIRED');await workspace.getByRole('button',{name:/^Reprendre.*Pièce TEST préparée/u}).tap();proof.nativeExistingPrivateDraftRecovered=true;}
  else{
  await workspace.getByLabel('Texte du brouillon', { exact: true }).fill(attachmentBody);
  await workspace.getByLabel('Ajouter des fichiers (5 au total, 10 Mio chacun)', { exact: true }).setInputFiles({ name: 'TEST_ONLY_MESSAGE.pdf', mimeType: 'application/pdf', buffer: bytes });
  await workspace.getByRole('button', { name: 'Enregistrer et déposer les pièces', exact: true }).tap();
  }
  await expect.poll(async () => { const r = await drafts(); return r.data?.drafts?.find(d => d.body === attachmentBody)?.files?.[0]?.upload_status; }, { timeout: 25000 }).toBe('UPLOADED');
  const draftResult = await drafts(), draft = draftResult.data.drafts.find(d => d.body === attachmentBody), file = draft.files[0];
  if (draftResult.data.attachments_allowed !== true || file.scan_status !== 'PENDING') throw Error('REAL_POSTSELECTION_PRIVATE_ATTACHMENT_REQUIRED');
  await expect(workspace.getByRole('button', { name: 'Envoyer ce brouillon et ses pièces saines', exact: true })).toBeDisabled();
  const hidden = await client.client.from('internal_message_drafts').select('id').eq('id', draft.id); if (hidden.error?.code!=='42501'&&(hidden.error||hidden.data?.length!==0)) throw Error('CLIENT_MUST_NOT_READ_PROVIDER_PRIVATE_MESSAGE_DRAFT');
  proof.clientPrivateDraftDeniedBy=hidden.error?.code??'RLS_EMPTY';
  proof.draftId = draft.id; proof.uploadId = file.upload_id; proof.attachmentSha256 = sha256; proof.sizeBytes = bytes.length; await save();
  stage = 'known-file-test-scan';
  const workerId = randomUUID(), claimed = await service.rpc('claim_internal_message_attachment_scan_jobs', { p_worker_id: workerId, p_limit: 1, p_lease_seconds: 300 });
  if (claimed.error || claimed.data?.length !== 1 || claimed.data[0].proof_id !== file.upload_id || claimed.data[0].expected_sha256 !== sha256 || claimed.data[0].storage_bucket!=='private-message-attachments'||Number(claimed.data[0].size_bytes)!==bytes.length) throw Error('EXACT_NATIVE_MESSAGE_SCAN_CLAIM_REQUIRED');
  const job = claimed.data[0]; await writeFile(resolve(state.directory, `message-scanner-lease-${workerId}.private.json`), JSON.stringify(job), { mode: 0o600 });
  const original = await service.storage.from(job.storage_bucket).download(job.storage_path); if (original.error || !original.data) throw Error('ORIGINAL_SYNTHETIC_MESSAGE_BYTES_REQUIRED');
  const originalBytes = Buffer.from(await original.data.arrayBuffer()); if (originalBytes.length !== bytes.length || createHash('sha256').update(originalBytes).digest('hex') !== sha256 || !originalBytes.includes(Buffer.from('TEST ONLY'))) throw Error('ONLY_EXACT_KNOWN_SYNTHETIC_MESSAGE_FILE_MAY_USE_TEST_SCANNER');
  const scan = await service.rpc('complete_internal_message_attachment_scan_job', { p_proof_id: file.upload_id, p_lease_token: job.lease_token, p_worker_id: job.worker_id, p_expected_row_version: job.row_version, p_result: 'CLEAN', p_engine_code: 'LOCAL_KNOWN_FIXTURE_PDF', p_engine_version: '1.0.0', p_computed_sha256: sha256, p_idempotency_key: `native-message-scan-${file.upload_id}` });
  if (scan.error || scan.data?.outcome !== 'INTERNAL_MESSAGE_ATTACHMENT_SCAN_RECORDED') throw Error('ACTUAL_NATIVE_MESSAGE_TEST_SCAN_REQUIRED:' + (scan.error?.code ?? 'INVALID_RESPONSE'));
  await workspace.getByRole('button', { name: 'Actualiser', exact: true }).tap();
  await expect(workspace.getByRole('button', { name: 'Envoyer ce brouillon et ses pièces saines', exact: true })).toBeEnabled();
  await workspace.getByRole('button', { name: 'Envoyer ce brouillon et ses pièces saines', exact: true }).tap();
  await expect.poll(async () => (await thread(owner)).messages.filter(m => m.body === attachmentBody).length, { timeout: 20000 }).toBe(1);
  const published = (await thread(client)).messages.find(m => m.body === attachmentBody); if (published?.attachments?.length !== 1 || !published.attachments[0].download_ready) throw Error('ACTUAL_SCANNED_ATTACHMENT_PUBLICATION_REQUIRED');
  proof.attachmentId = published.attachments[0].id;
  const download = await cc.request.get(`${origin}/api/internal-messages/attachments/${proof.attachmentId}`), downloaded = await download.body(); if (download.status() !== 200 || downloaded.length !== bytes.length || createHash('sha256').update(downloaded).digest('hex') !== sha256) throw Error('CLIENT_MESSAGE_PRIVATE_DOWNLOAD_EXACT_BYTES_REQUIRED');
  const denied = await fc.request.get(`${origin}/api/internal-messages/attachments/${proof.attachmentId}`), deniedThread = await foreign.client.rpc('get_internal_message_thread_page_for_organization_v1', { p_thread_id: proof.threadId, p_organization_id: foreign.actor.organizationId, p_before_created_at: null, p_before_message_id: null, p_page_size: 50 }); if (denied.status() !== 404 || deniedThread.error?.code !== '42501') throw Error('COMPETITOR_THREAD_AND_PRIVATE_ATTACHMENT_MUST_BE_DENIED');
  proof.steps.push({ step: 'real_private_pdf_draft_quarantine_native_test_scan_and_touch_publish_exact_client_bytes_foreign_denials', passed: true });
  stage='client-reply-after-mission-completion';const clientPage=await cc.newPage(),reply='Réponse Client TEST après réception — جواب العميل الأصلي';await clientPage.goto(`${origin}/fr/messagerie?fil=${proof.threadId}&organizationId=${client.actor.organizationId}`,{waitUntil:'domcontentloaded',timeout:90000});const replyForm=clientPage.locator('form').filter({has:clientPage.locator(`input[name="threadId"][value="${proof.threadId}"]`)}).filter({has:clientPage.locator('textarea[name="body"]')});await replyForm.locator('[name="body"]').fill(reply);await replyForm.getByRole('button').last().tap();await expect.poll(async()=>(await thread(owner)).messages.filter(m=>m.body===reply).length,{timeout:20000}).toBe(1);proof.steps.push({step:'independent_client_touch_reply_remains_available_after_native_mission_completion',passed:true});
  await page.goto(`${origin}/ar/sous-traitant/messages/${proof.threadId}?organizationId=${owner.actor.organizationId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl'); await expect(page.locator('.provider-message-thread')).toContainText(body); await expect(page.locator('.provider-message-thread')).toContainText(attachmentBody);
  if (new URL(page.url()).searchParams.get('organizationId') !== owner.actor.organizationId) throw Error('AR_MESSAGE_TENANT_CONTEXT_MUST_PERSIST');
  await page.screenshot({ path: resolve(directory, 'postcontract-thread-ar-390.png'), fullPage: true }); proof.steps.push({ step: 'arabic_thread_preserves_original_user_text_and_exact_organization', passed: true }); proof.status = 'PASSED';
} catch (error) { proof.status = 'FAILED'; proof.failureStage = stage; proof.failure = safeError(error.message); process.exitCode = 1; await contexts[0]?.context.pages().at(-1)?.screenshot({path:resolve(directory,'failure.png'),fullPage:true}).catch(()=>{}); }
finally { for (const item of contexts) await preserveBrowserSession(state, item.label, item.context).catch(() => {}); await browser.close(); await save(); console.log(JSON.stringify({ status: proof.status, steps: proof.steps.length, failureStage: proof.failureStage, failure: proof.failure })); }
