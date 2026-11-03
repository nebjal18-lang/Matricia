import { requireDevelopment, loadOwnState } from './safety.mjs';
import { nativeBrowserActor, preserveBrowserSession, safeError } from './browser-session.mjs';
import { scanKnownDeliveryProof } from './known-delivery-scan.mjs';
import { localFixturePdf } from '../local-fixture-pdf.mjs';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
requireDevelopment();
const state = await loadOwnState(), contract = JSON.parse(await readFile(resolve(state.directory, 'contract-mission/summary.json')));
if (contract.status !== 'PASSED' || contract.appTree !== state.candidate?.appTree || !contract.deliverables?.length) throw Error('ACTUAL_NATIVE_SIGNED_TEST_CONTRACT_AND_ASSIGNED_MISSION_REQUIRED');
const directory = resolve(state.directory, 'delivery'); await mkdir(directory, { recursive: true });
const resumeFirst=process.argv.includes('--resume-first-client-decision'),previous=resumeFirst?JSON.parse(await readFile(resolve(directory,'summary.json'))):null;
if(resumeFirst&&(previous.status!=='FAILED'||previous.failureStage!=='client-decision-1-version-1'||previous.appTree!==state.candidate.appTree||previous.steps.length!==1||previous.files.length!==1||previous.versionSnapshots.length!==1))throw Error('EXACT_FIRST_NATIVE_SCANNED_DELIVERY_CHECKPOINT_REQUIRED');
if(!resumeFirst)try { await access(resolve(directory, 'summary.json')); throw Error('PRESERVE_EXISTING_NATIVE_DELIVERY_CHECKPOINT'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const owner = await nativeBrowserActor(state, 'provider-owner'), technician = await nativeBrowserActor(state, 'technician-assigned'), unassigned = await nativeBrowserActor(state, 'technician-unassigned'), client = await nativeBrowserActor(state, 'client-owner'), foreign = await nativeBrowserActor(state, 'foreign-provider');
const { chromium, expect } = createRequire(resolve('package.json'))('@playwright/test');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' }), origin = `http://127.0.0.1:${state.appPort}`, contexts = [];
const proof = { scope: 'NATIVE_ASSIGNED_TECHNICIAN_DELIVERY_CLIENT_REJECTION_CORRECTION_AND_ACCEPTANCE', candidate: state.candidate.commit, appTree: state.candidate.appTree, status: 'RUNNING', missionId: contract.missionId, physicalAntivirusCertified: false, steps: [], files: [], versionSnapshots: [] };
if(resumeFirst){proof.files.push(...previous.files);proof.versionSnapshots.push(...previous.versionSnapshots);proof.recoveredFirstVersion=true;}
const save = () => writeFile(resolve(directory, 'summary.json'), JSON.stringify(proof, null, 2));
async function contextFor(actor, width = 390) { const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: true, serviceWorkers: 'block' }); await context.addCookies(actor.cookies); contexts.push({ context, label: actor.actor.label }); return context; }
let stage = 'assignment-boundary'; await save();
try {
  const assignedRows = await technician.client.from('missions').select('id').eq('id', contract.missionId), hiddenRows = await unassigned.client.from('missions').select('id').eq('id', contract.missionId);
  if (assignedRows.error || assignedRows.data.length !== 1 || hiddenRows.error || hiddenRows.data.length !== 0) throw Error('ACTUAL_TECHNICIAN_ASSIGNMENT_SCOPE_REQUIRED');
  const negative = await unassigned.client.rpc('submit_delivery', { p_deliverable_id: contract.deliverables[0].id, p_description: 'TEST ONLY unauthorized technician must be denied.', p_links: [], p_proofs: [], p_idempotency_key: randomUUID() });
  if (negative.error?.code !== '42501') throw Error('UNASSIGNED_TECHNICIAN_NATIVE_MUTATION_MUST_BE_DENIED');
  proof.steps.push({ step: 'actual_assigned_technician_reads_mission_unassigned_cannot_read_or_submit', passed: true }); await save();
  const tc = await contextFor(technician), cc = await contextFor(client, 768), fc = await contextFor(foreign), page = await tc.newPage(), clientPage = await cc.newPage();
  for (let index = 0; index < contract.deliverables.length; index++) {
    const deliverable = contract.deliverables[index], rounds = index === 0 ? 2 : 1;
    for (let round = 1; round <= rounds; round++) {
      const recovering=resumeFirst&&index===0&&round===1;
      stage = `delivery-${index + 1}-version-${round}`;
      const bytes = localFixturePdf(['TEST ONLY / NON_CONTRACTUAL_DEMO', `Native Provider delivery ${index + 1} version ${round}.`, `Mission: ${contract.missionId}`, round === 1 ? 'Initial test submission.' : 'Correction requested by the independent Client.']);
      const sha256 = createHash('sha256').update(bytes).digest('hex'), description = `Rapport TEST ${index + 1}, version ${round} — نص أصلي محفوظ`;
      await page.goto(`${origin}/fr/sous-traitant/missions/${contract.missionId}?organizationId=${technician.actor.organizationId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      if(!recovering){
      const form = page.locator('form').filter({ has: page.locator(`input[name="deliverableId"][value="${deliverable.id}"]`) });
      const details = form.locator('xpath=ancestor::details[1]'); if (!(await details.evaluate(element => element.open))) await details.locator(':scope > summary').tap();
      await form.locator('[name="description"]').fill(description);
      await form.locator('[name="linksText"]').fill('https://example.test/TEST-ONLY');
      await form.locator('[name="proofFile"]').setInputFiles({ name: `TEST_DELIVERY_${index + 1}_V${round}.pdf`, mimeType: 'application/pdf', buffer: bytes });
      await form.locator('[name="proofNote"]').fill(round === 1 ? 'TEST ONLY preuve initiale.' : 'TEST ONLY correction remise après le commentaire Client.');
      await form.getByRole('button', { name: 'Soumettre le livrable', exact: true }).focus(); await page.keyboard.press('Enter');
      await expect.poll(async () => (await technician.client.from('deliverables').select('current_version').eq('id', deliverable.id).single()).data?.current_version, { timeout: 25000 }).toBe(round);
      }
      const version = await technician.client.from('delivery_versions').select('id,version,description,content_hash').eq('deliverable_id', deliverable.id).eq('version', round).single();
      if (version.error || version.data.description !== description) throw Error('EXACT_NATIVE_DELIVERY_VERSION_REQUIRED');
      const file = await technician.client.from('delivery_proofs').select('id,storage_path,evidence_hash,scan_status').eq('delivery_version_id', version.data.id).single();
      if (file.error || file.data.evidence_hash !== sha256 || file.data.scan_status !== (recovering?'CLEAN':'PENDING')) throw Error('EXACT_NATIVE_PENDING_DELIVERY_PROOF_REQUIRED');
      if(!recovering){const quarantined = await cc.request.get(`${origin}/api/provider/delivery-proofs/${file.data.id}`, { maxRedirects: 0 });
      if (quarantined.status() !== 409) throw Error('CLIENT_CANNOT_DOWNLOAD_BEFORE_REAL_TEST_SCAN');}
      const denied = await fc.request.get(`${origin}/api/provider/delivery-proofs/${file.data.id}`, { maxRedirects: 0 });
      if (denied.status() !== 404) throw Error('FOREIGN_PROVIDER_PROOF_MUST_BE_HIDDEN');
      const document = { id: file.data.id, path: file.data.storage_path, sha256, sizeBytes: bytes.length };
      if(recovering){if(file.data.id!==previous.files[0].id||sha256!==previous.files[0].sha256||JSON.stringify(version.data)!==JSON.stringify(previous.versionSnapshots[0]))throw Error('EXACT_PERSISTED_NATIVE_SCANNED_FIRST_VERSION_REQUIRED');const status=await technician.client.from('deliverables').select('current_version,status').eq('id',deliverable.id).single();if(status.error||status.data.current_version!==1||status.data.status!=='SUBMITTED')throw Error('PRESERVE_ALREADY_DECIDED_DELIVERY');}
      else{proof.files.push({ ...document, scan: await scanKnownDeliveryProof(state, document) }); proof.versionSnapshots.push(version.data);} await save();
      const downloaded = await cc.request.get(`${origin}/api/provider/delivery-proofs/${file.data.id}`), downloadedBytes = await downloaded.body();
      if (downloaded.status() !== 200 || downloadedBytes.length !== bytes.length || createHash('sha256').update(downloadedBytes).digest('hex') !== sha256) throw Error('AUTHORIZED_CLIENT_DELIVERY_EXACT_BYTES_REQUIRED');
      stage = `client-decision-${index + 1}-version-${round}`;
      await clientPage.goto(`${origin}/fr/client/missions/${contract.missionId}?organizationId=${client.actor.organizationId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      const decision = clientPage.locator('form').filter({ has: clientPage.locator(`input[name="deliverableId"][value="${deliverable.id}"]`) }).filter({ has: clientPage.locator('[name="expectedDeliveryVersion"]') });
      const ancestors=decision.locator('xpath=ancestor::details');for(let ancestor=0;ancestor<await ancestors.count();ancestor++){const detail=ancestors.nth(ancestor);if(!(await detail.evaluate(element=>element.open)))await detail.locator(':scope > summary').tap();}
      await expect(decision.locator('[name="expectedDeliveryVersion"]')).toHaveValue(String(round));
      const statuses = decision.locator('[name="criterionStatus"]'), comments = decision.locator('[name="criterionComment"]');
      if (!(await statuses.count())) throw Error('CANONICAL_NATIVE_ACCEPTANCE_CRITERIA_REQUIRED');
      const reject = index === 0 && round === 1;
      for (let criterion = 0; criterion < await statuses.count(); criterion++) { await statuses.nth(criterion).selectOption(reject && criterion === 0 ? 'NONCOMPLIANT' : 'COMPLIANT'); await comments.nth(criterion).fill(reject && criterion === 0 ? 'TEST ONLY — préciser la conclusion du rapport avant une nouvelle remise.' : 'TEST ONLY — critère vérifié par le Client indépendant.'); }
      await decision.getByRole('button').last().tap();
      await expect.poll(async () => (await technician.client.from('deliverables').select('status').eq('id', deliverable.id).single()).data?.status, { timeout: 25000 }).toBe(reject ? 'REJECTED' : 'ACCEPTED');
      await clientPage.screenshot({ path: resolve(directory, `client-${index + 1}-v${round}-${reject ? 'rejected' : 'accepted'}-fr-768.png`), fullPage: true });
      proof.steps.push({ step: `actual_technician_delivery_${index + 1}_v${round}_private_bytes_native_scan_and_independent_client_${reject ? 'rejection' : 'acceptance'}`, passed: true }); await save();
      if (reject) {
        await page.goto(`${origin}/ar/sous-traitant/missions/${contract.missionId}?organizationId=${technician.actor.organizationId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        const history = page.locator(`#deliverable-${deliverable.id} > details`).first(); if (!(await history.evaluate(element => element.open))) await history.locator(':scope > summary').tap();
        await expect(history).toContainText('TEST ONLY — préciser la conclusion du rapport');
        await expect(history).toContainText(description);
        await page.screenshot({ path: resolve(directory, 'provider-client-correction-ar-390.png'), fullPage: true });
      }
    }
  }
  for (const snapshot of proof.versionSnapshots) { const row = await technician.client.from('delivery_versions').select('id,version,description,content_hash').eq('id', snapshot.id).single(); if (row.error || JSON.stringify(row.data) !== JSON.stringify(snapshot)) throw Error('ALL_SUBMITTED_DELIVERY_VERSIONS_MUST_REMAIN_IMMUTABLE'); }
  proof.steps.push({ step: 'all_native_delivery_versions_and_original_free_text_remain_immutable_after_correction_and_client_receipt', passed: true });
  stage = 'native-assignment-revocation';
  const ownerContext = await contextFor(owner), ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`${origin}/fr/sous-traitant/missions/${contract.missionId}?organizationId=${owner.actor.organizationId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  const assignment = ownerPage.locator('form').filter({ has: ownerPage.locator('select[name="userId"]') });
  await assignment.locator('[name="userId"]').selectOption(technician.actor.userId);
  await assignment.locator('[name="assigned"]').selectOption('false');
  await assignment.locator('[name="reason"]').fill('TEST ONLY — révocation native après la recette de livraison et réception.');
  await assignment.getByRole('button', { name: 'Enregistrer l’affectation', exact: true }).tap();
  await expect.poll(async () => (await technician.client.from('missions').select('id').eq('id', contract.missionId)).data?.length, { timeout: 20000 }).toBe(0);
  const revokedDelivery = await technician.client.rpc('submit_delivery', { p_deliverable_id: contract.deliverables[0].id, p_description: 'TEST ONLY revoked technician cannot submit.', p_links: [], p_proofs: [], p_idempotency_key: randomUUID() });
  if (revokedDelivery.error?.code !== '42501') throw Error('REVOKED_TECHNICIAN_NATIVE_DELIVERY_MUST_BE_DENIED');
  const revokedFile = await tc.request.get(`${origin}/api/provider/delivery-proofs/${proof.files[0].id}`, { maxRedirects: 0 });
  if (revokedFile.status() !== 404) throw Error('REVOKED_TECHNICIAN_NEW_PRIVATE_DOWNLOAD_MUST_BE_DENIED');
  proof.steps.push({ step: 'owner_touch_revocation_removes_technician_mission_new_download_and_native_submit_access', passed: true });
  proof.status = 'PASSED';
} catch (error) { proof.status = 'FAILED'; proof.failureStage = stage; proof.failure = safeError(error.message); process.exitCode = 1; const active=contexts.find(item=>item.label==='client-owner');await active?.context.pages().at(-1)?.screenshot({path:resolve(directory,'failure.png'),fullPage:true}).catch(()=>{}); }
finally { for (const item of contexts) await preserveBrowserSession(state, item.label, item.context).catch(() => {}); await browser.close(); await save(); console.log(JSON.stringify({ status: proof.status, steps: proof.steps.length, failureStage: proof.failureStage, failure: proof.failure })); }
