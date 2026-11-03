import { fixtureState, sourceCandidate, staffActor, sdk, sql, privateDirectory, actorSession } from './franchise-final-support.mjs';
import { localFixturePdf } from './local-fixture-pdf.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';

const locale = process.argv.find(value => value.startsWith('--locale='))?.slice(9) ?? 'fr';
if (!['fr', 'ar'].includes(locale)) throw Error('SUPPORTED_FINANCE_LOCALE_REQUIRED');
const labels = locale === 'ar' ? { title: 'مطابقة التكاليف ووثائق إثباتها', empty: 'لا يوجد ملف يطابق هذا البحث في هذه الصفحة.', target: 'الملف المعني', file: 'وثيقة الإثبات', upload: 'إيداع وثيقة الإثبات', propose: 'إرسال الطلب إلى مسؤول مالي آخر' } : { title: 'Rapprochement des coûts et justificatifs', empty: 'Aucun dossier ne correspond à cette recherche sur cette page.', target: 'Dossier concerné', file: 'Pièce justificative', upload: 'Déposer le justificatif', propose: 'Soumettre à un autre responsable Finance' };
const state = await fixtureState(), pin = await sourceCandidate();
if (JSON.stringify(state.candidate.migrations) !== JSON.stringify(pin.migrations)) throw Error('REVIEWED_EXACT_DATABASE_SCHEMA_REQUIRED');
const out = resolve(`docs/franchise-completion/evidence/browser/finance-private-file-${pin.commit.slice(0, 7)}-${locale}`);
await mkdir(out, { recursive: true });
const proof = { scope: 'NATIVE_FINANCE_PRIVATE_TEST_FILE_WITHOUT_FABRICATED_CLEAN_SCAN', candidate: pin.commit, appTree: pin.appTree, status: 'RUNNING', locale, steps: [], physicalAntivirusCertified: false, independentZeroCostReviewCertified: false, zeroCostCertified: false, hostedCertification: false };
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' });
const origin = `http://127.0.0.1:${state.appPort}`, contexts = [];
async function contextFor(actor) {
  const context = await browser.newContext({ viewport: { width: 390, height: 960 }, hasTouch: true, serviceWorkers: 'block' });
  contexts.push(context); await context.addCookies(actor.cookies); const page = await context.newPage();
  await page.goto(`${origin}/${locale}/administration/finance/rapprochements-couts`, { waitUntil: 'networkidle', timeout: 90000 });
  return page;
}
function costCount(id) {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) throw Error('UUID_TARGET_REQUIRED');
  return Number(sql(state, `select count(*)from public.credit_economic_cost_reconciliations_v1 where target_id='${id}'::uuid;`).trim());
}
try {
  const dir = await privateDirectory(state), file = resolve(dir, 'actors.private.json'), cohort = JSON.parse(await readFile(file)), owner = cohort.actors.find(value => value.label === 'owner');
  const member = await actorSession(state, owner, file, cohort);
  const denied = await member.client.rpc('list_finance_cost_reconciliation_targets_v1', { p_locale: locale, p_page: 1, p_search: null });
  if (denied.error?.code !== '42501') throw Error('FRANCHISE_MEMBER_MUST_NOT_READ_CENTRAL_FINANCE_TARGETS');
  const memberPage = await contextFor(member);
  await expect(memberPage.locator('[data-admin-access-state="FORBIDDEN"], [data-workspace-failure="FORBIDDEN"]')).toBeVisible({ timeout: 10000 });
  proof.steps.push({ id: 'FRANCHISE_MEMBER_CENTRAL_FINANCE_TARGETS_DENIED', status: 'PASS', rpcCode: denied.error.code });
  const author = await staffActor(state, 'finance-author'), reviewer = await staffActor(state, 'finance-reviewer');
  if (author.actor.userId === reviewer.actor.userId) throw Error('DISTINCT_NATIVE_FINANCE_REVIEWERS_REQUIRED');
  const response = await author.client.rpc('list_finance_cost_reconciliation_targets_v1', { p_locale: locale, p_page: 1, p_search: null });
  if (response.error || !Array.isArray(response.data?.targets) || response.data.canUpload !== true) throw Error('NATIVE_FINANCE_TARGET_LIST_UNAVAILABLE:' + response.error?.code);
  const page = await contextFor(author);
  await expect(page.getByRole('heading', { name: labels.title, exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', locale); await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) throw Error('FINANCE_PRIVATE_FILE_PAGE_HORIZONTAL_OVERFLOW');
  if (!response.data.targets.length) {
    proof.status = 'BLOCKED_MISSING_NATIVE_CAPTURE_OR_ACCEPTED_ALLOCATED_BENEFIT';
    await expect(page.getByText(labels.empty, { exact: true })).toBeVisible();
    proof.steps.push({ id: 'AUTHORIZED_TARGET_LIST_HONESTLY_EMPTY', status: 'PASS', count: 0 });
    proof.blocker = 'A genuine native TEST credit capture or independently accepted allocated benefit is required before a scoped private file can be deposited. No target or balance has been inserted.';
    await page.screenshot({ path: resolve(out, `no-native-target-${locale}-390.png`), fullPage: true }); process.exitCode = 2;
  } else {
    const requested = process.argv.find(value => value.startsWith('--target='))?.slice(9);
    const target = response.data.targets.find(value => (!requested || value.id === requested) && /TEST|fixture|essai|اختبار/iu.test(value.label));
    if (!target) throw Error('EXPLICIT_AUTHORIZED_TEST_TARGET_REQUIRED');
    proof.target = { id: target.id, component: target.component, label: target.label };
    const before = costCount(target.id), select = page.getByLabel(labels.target, { exact: true });
    await select.selectOption(`${target.component}:${target.id}`);
    const bytes = localFixturePdf(['TEST ONLY / NON_CONTRACTUAL_DEMO', 'Private zero-cost evidence upload acceptance only.', 'This test document does not prove a real waiver or a free service.', `Owned local cohort: ${state.token}`]);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const input = page.getByLabel(labels.file, { exact: true });
    await input.setInputFiles({ name: 'TEST_ONLY_FINANCE_COST_PROOF.pdf', mimeType: 'application/pdf', buffer: bytes });
    const receiptPromise = page.waitForResponse(r => new URL(r.url()).pathname.startsWith('/api/finance/cost-proofs/uploads/') && r.request().method() === 'POST', { timeout: 45000 });
    await page.getByRole('button', { name: labels.upload, exact: true }).click();
    const uploaded = await receiptPromise, receipt = await uploaded.json();
    proof.uploadResponse = { http: uploaded.status(), code: receipt.code ?? null, outcome: receipt.outcome ?? null, scanStatus: receipt.scan_status ?? null, uploadId: receipt.upload_id ?? null };
    if (uploaded.status() !== 200 || receipt.outcome !== 'FINANCE_COST_DOCUMENT_UPLOADED' || !['PENDING', 'ERROR'].includes(receipt.scan_status)) throw Error('UPLOAD_MUST_REMAIN_UNAPPROVED_WITHOUT_REAL_SCANNER');
    const native = await author.client.rpc('get_finance_cost_upload_context_v1', { p_upload_id: receipt.upload_id });
    if (native.error || native.data?.status !== 'UPLOADED' || native.data.sha256 !== digest || native.data.size_bytes !== bytes.length || native.data.mime_type !== 'application/pdf') throw Error('ACTUAL_PRIVATE_UPLOAD_METADATA_MUST_MATCH_BYTES');
    const stored = await sdk(state, state.serviceKey).storage.from(native.data.bucket).download(native.data.path);
    if (stored.error || !stored.data || createHash('sha256').update(Buffer.from(await stored.data.arrayBuffer())).digest('hex') !== digest) throw Error('ACTUAL_PRIVATE_STORED_BYTES_MUST_MATCH');
    if (await page.getByRole('button', { name: labels.propose, exact: true }).count()) throw Error('UNSCANNED_DOCUMENT_MUST_NOT_ENABLE_ZERO_COST_PROPOSAL');
    const unscanned = await author.client.rpc('propose_credit_economic_zero_cost_v1', { p_component: target.component, p_target_id: target.id, p_upload_id: receipt.upload_id, p_reason: 'TEST ONLY — refused attempt while the real scanner prerequisite is absent.', p_idempotency_key: `test-unscanned:${receipt.upload_id}` });
    if (unscanned.error?.code !== '55000') throw Error('SERVER_MUST_REFUSE_UNSCANNED_ZERO_COST_PROPOSAL');
    if (costCount(target.id) !== before) throw Error('DEPOSIT_MUST_NOT_CHANGE_COST_RECONCILIATION');
    proof.steps.push({ id: 'ACTUAL_UI_PRIVATE_FILE_VERIFIED_BYTES_HASH_MIME', status: 'PASS', uploadId: receipt.upload_id, sha256: digest, bytes: bytes.length, scanStatus: native.data.scan_status });
    proof.steps.push({ id: 'UNSCANNED_ZERO_COST_REJECTED_SERVER_AND_UI', status: 'PASS', rpcCode: unscanned.error.code, reconciliationUnchanged: true });
    await page.screenshot({ path: resolve(out, `uploaded-pending-real-scanner-${locale}-390.png`), fullPage: true });
    proof.status = 'PARTIAL_PRIVATE_UPLOAD_VERIFIED_REAL_SCANNER_AND_REVIEW_BLOCKED';
    proof.blocker = 'No genuine antivirus engine with a current signature database is configured in this owned test environment. CLEAN, download capability, independent decision and zero-cost reconciliation are not claimed.';
    process.exitCode = 2;
  }
} catch (error) {
  proof.status = 'FAILED'; proof.failure = String(error).replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/gu, '[REDACTED]').slice(0, 1400); process.exitCode = 1;
} finally {
  for (const context of contexts) await context.close(); await browser.close();
  await writeFile(resolve(out, 'summary.json'), JSON.stringify(proof, null, 2) + '\n'); console.log(JSON.stringify(proof));
}
