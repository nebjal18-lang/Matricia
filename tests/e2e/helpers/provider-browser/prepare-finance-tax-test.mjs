import { requireDevelopment, loadOwnState } from './safety.mjs';
import { nativeBrowserActor } from './browser-session.mjs';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
requireDevelopment();
const state = await loadOwnState(), path = resolve(state.directory, 'finance-current/commission-tax-test-policy.json');
const resume=process.argv.includes('--resume-draft'),previous=resume?JSON.parse(await readFile(path)):null;
if(resume&&(previous.status!=='INTENT_RECORDED'||previous.candidate!==state.candidate.commit||!previous.proposal?.tax_rule_version_id))throw Error('EXACT_NATIVE_TEST_FISCAL_DRAFT_CHECKPOINT_REQUIRED');
if(!resume)try { await access(path); throw Error('PRESERVE_EXISTING_NATIVE_COMMISSION_TAX_POLICY_CHECKPOINT'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const author = await nativeBrowserActor(state, 'finance-author'), reviewer = await nativeBrowserActor(state, 'finance-reviewer');
if (author.actor.userId === reviewer.actor.userId) throw Error('DISTINCT_REAL_NATIVE_FISCAL_ACTORS_REQUIRED');
const sourceName = 'supabase/tests/0347_provider_monthly_closing.test.sql', source = await readFile(sourceName, 'utf8');
if (!source.includes("'PROVIDER_COMMISSION','VAT',2000,100") || !source.includes("TEST ONLY synthetic fiscal rule, not professional advice")) throw Error('REVIEWED_TEST_FISCAL_REFERENCE_DRIFT');
const proof = previous??{ scope: 'NATIVE_GOVERNED_TEST_COMMISSION_TAX_REFERENCE_FROM0347_NOT_PROFESSIONAL_APPROVAL', candidate: state.candidate.commit, appTree: state.candidate.appTree, status: 'INTENT_RECORDED', source: sourceName, sourceSha256: createHash('sha256').update(source).digest('hex'), productionFiscalApprovalCertified: false, professionalAccountantValidationCertified: false, referenceRateBasisPoints: 2000, category: 'PROVIDER_COMMISSION', idempotencyKey: randomUUID() };
const save = () => writeFile(path, JSON.stringify(proof, null, 2)); await save();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
if(!resume){const proposal = await author.client.rpc('propose_morocco_tax_rule', { p_audit_organization_id: null, p_category_code: 'PROVIDER_COMMISSION', p_rule_type: 'VAT', p_rate_basis_points: 2000, p_priority: 100, p_conditions: { environment_class: 'NON_PRODUCTION_DEMO' }, p_legal_reference: 'TEST ONLY synthetic fiscal rule, not professional advice', p_effective_from: today, p_effective_to: null, p_change_reason: 'TEST ONLY native tax approval prerequisite from0347 for the exact current synthetic receipt. Not a production fiscal opinion.', p_idempotency_key: proof.idempotencyKey });
if (proposal.error || !proposal.data?.tax_rule_version_id) throw Error('NATIVE_TEST_TAX_PROPOSAL:' + proposal.error?.code);
proof.proposal = proposal.data; await save();}
// Draft SELECT is intentionally unavailable to this reviewer. The governed
// decision RPC validates the exact native proposal, independence and its initial
// CAS version; no broader SELECT or role is granted to make this test pass.
const decision = await reviewer.client.rpc('decide_morocco_tax_rule', { p_audit_organization_id: null, p_tax_rule_version_id: proof.proposal.tax_rule_version_id, p_decision: 'APPROVE', p_professional_validation_status: 'VALIDATED', p_validation_reference: 'TEST ONLY source0347 synthetic fiscal validation reference, never a professional production approval.', p_reason: 'TEST ONLY independent synthetic fiscal validation from0347 by the distinct authorized TEST Finance reviewer.', p_expected_row_version: 1, p_idempotency_key: randomUUID() });
if (decision.error) throw Error('NATIVE_INDEPENDENT_TEST_TAX_DECISION:' + decision.error.code);
proof.decision = decision.data; proof.status = 'READY'; await save();
console.log(JSON.stringify({ status: proof.status, nativeFourEyes: true, productionFiscalApprovalCertified: false, professionalAccountantValidationCertified: false }));
