import { fixtureState, privateDirectory, persistPrivate, sdk, staffActor, sql, sourceCandidate } from './franchise-final-support.mjs';
import { readFile, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { totp } from '../../../scripts/p05-e2e/totp.mjs';
const state = await fixtureState(), dir = await privateDirectory(state), pin = await sourceCandidate();
const environment = JSON.parse(sql(state, `select json_build_object('environment',(select environment from private.admin_execution_environment_v1 where singleton),'library',(select json_build_object('id',id,'code',code)from public.catalog_libraries where code='TEST_PROVIDER_B9BD23E48232'));`));
if (environment.environment !== 'DEVELOPMENT' || !environment.library?.id) throw Error('EXACT_OWNED_DEVELOPMENT_CATALOGUE_REQUIRED');
const file = resolve(dir, 'actors.private.json');
let receipt;
try { receipt = JSON.parse(await readFile(file)); } catch (error) { if (error.code !== 'ENOENT') throw error; receipt = { fixtureToken: state.token, source: pin.commit, actors: [], library: environment.library }; }
if (receipt.fixtureToken !== state.token) throw Error('OWNED_FRANCHISE_NATIVE_COHORT_REQUIRED');
const save = () => persistPrivate(file, receipt);
const backup = resolve(dir, 'pre-franchise.private.dump');
try { await access(backup); const bytes=await readFile(backup); if(!receipt.backup?.sha256||createHash('sha256').update(bytes).digest('hex')!==receipt.backup.sha256||bytes.subarray(0,5).toString()!=='PGDMP')throw Error('PRESERVE_AND_REVIEW_INCOMPLETE_BACKUP_RECEIPT'); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
  const stream = createWriteStream(backup, { mode: 0o600, flags: 'wx' });
  const env = { ...process.env, DOCKER_HOST: 'unix:///var/run/docker.sock' };
  for (const key of ['DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']) delete env[key];
  const child = spawn('docker', ['exec', state.database, 'pg_dump', '-U', 'supabase_admin', '-d', 'postgres', '-Fc'], { env, stdio: ['ignore', 'pipe', 'ignore'] });
  child.stdout.pipe(stream);
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  await new Promise((resolve,reject)=>{if(stream.closed)resolve();else{stream.once('close',resolve);stream.once('error',reject);}});
  if (code !== 0) throw Error('OWNED_BROWSER_PRE_MUTATION_BACKUP_FAILED');
  receipt.backup = { sha256: createHash('sha256').update(await readFile(backup)).digest('hex'), restorationTested: false }; await save();
}
const admin = sdk(state, state.serviceKey);
for (const label of ['owner','foreign']) {
  let actor = receipt.actors.find(value => value.label === label);
  const email = `franchise-final-${label}-${state.token}@example.invalid`, client = sdk(state);
  if (!actor) {
    const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (existing.error) throw Error('TEST_ACTOR_LOOKUP_FAILED');
    const found = existing.data.users.find(user => user.email === email);
    if (found && found.app_metadata?.isolated_browser_fixture !== state.token) throw Error('EXACT_TEST_ACTOR_REQUIRED');
    const created = found ? { data: { user: found } } : await admin.auth.admin.createUser({ email, email_confirm: true, app_metadata: { isolated_browser_fixture: state.token, franchise_final_test: true }, user_metadata: { locale: 'fr' } });
    if (created.error || !created.data.user) throw Error('TEST_ACTOR_CREATION_FAILED');
    actor = { label, userId: created.data.user.id, email, stage: 'CREATED' }; receipt.actors.push(actor); await save();
  }
  if (!actor.session) {
    const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (link.error) throw Error('TEST_OTP_GENERATION_FAILED');
    const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token });
    if (verified.error || verified.data.user?.id !== actor.userId) throw Error('TEST_OTP_VERIFY_FAILED');
    actor.session = verified.data.session; await save();
  } else if ((await client.auth.setSession(actor.session)).error) throw Error('TEST_NATIVE_SESSION_REFRESH_FAILED');
  if (!actor.mfa) {
    const enrolled = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Franchise local acceptance TEST' });
    if (enrolled.error || !enrolled.data.totp?.secret) throw Error('TEST_MFA_ENROLL_FAILED');
    actor.mfa = { factorId: enrolled.data.id, secret: enrolled.data.totp.secret }; await save();
  }
  let assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.data?.currentLevel !== 'aal2') {
    const verified = await client.auth.mfa.challengeAndVerify({ factorId: actor.mfa.factorId, code: totp(actor.mfa.secret, Date.now()) });
    if (verified.error) throw Error('TEST_MFA_VERIFY_FAILED');
  }
  const user = await client.auth.getUser(); assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (user.error || user.data.user?.id !== actor.userId || assurance.error || assurance.data?.currentLevel !== 'aal2') throw Error('GENUINE_TEST_OTP_TOTP_REQUIRED');
  actor.session = (await client.auth.getSession()).data.session; await save();
  if (!actor.organizationId) {
    actor.orgIntent ??= { key: randomUUID(), correlation: randomUUID(), ice: BigInt('0x' + randomBytes(6).toString('hex')).toString().padStart(15,'0') }; await save();
    const org = await client.rpc('create_or_request_organization', { p_legal_name: `TEST ONLY Franchise ${label} ${state.token}`, p_display_name: `TEST ONLY Franchise ${label}`, p_ice: actor.orgIntent.ice, p_owner_role: 'FRANCHISE_OWNER', p_idempotency_key: actor.orgIntent.key, p_correlation_id: actor.orgIntent.correlation });
    if (org.error || !org.data?.organization_id) throw Error('TEST_NATIVE_FRANCHISE_ORGANIZATION_FAILED:' + org.error?.code);
    actor.organizationId = org.data.organization_id; await save();
  }
  console.log(JSON.stringify({ status: 'GENUINE_FRANCHISE_OTP_TOTP_ACTOR_READY', label, jwtFabricated: false }));
}
if (!process.argv.includes('--prepare-mandate')) { console.log(JSON.stringify({ status:'NO_MANDATE_COHORT_READY', source:pin.commit, nativeActors:receipt.actors.length })); process.exit(0); }
const owner = receipt.actors.find(value => value.label === 'owner');
const author = await staffActor(state, 'governance-author'), reviewer = await staffActor(state, 'governance-reviewer');
receipt.mandates ??= [];
const label = process.argv.includes('--second-mandate') ? 'SECOND' : 'FIRST';
let mandate = receipt.mandates.find(value => value.label === label);
if (!mandate) {
  mandate = { label, proposalCandidate:pin.commit, privateToken: randomBytes(36).toString('base64url'), proposalKey: randomUUID(), approvalKey: randomUUID(), activationKey: randomUUID(), correlation: randomUUID(), effectiveFrom: new Date(Date.now()-3600000).toISOString(), effectiveUntil:new Date(Date.now()+86400000*365).toISOString() }; receipt.mandates.push(mandate); await save();
}
if (!mandate.proposal) {
  const proposed = await author.client.rpc('propose_franchise_governance', { p_library_id: receipt.library.id, p_operator_organization_id: owner.organizationId, p_operator_code:'FRANCHISEE', p_territory_code:label==='FIRST'?'TESTF_A':'TESTF_B', p_territory_name_fr:`Territoire TEST ${label}`, p_territory_name_ar:label==='FIRST'?'نطاق اختبار أول':'نطاق اختبار ثان', p_territory_scope:{regions:['Casablanca-Settat'],origin:'OWNED_NON_CONTRACTUAL_TEST'}, p_effective_from:mandate.effectiveFrom,p_effective_until:mandate.effectiveUntil,p_entry_fee_minor:100000,p_entry_fee_mode:'UPFRONT',p_entry_fee_term_months:0,p_rights:{scope:'TEST_ONLY'},p_obligations:{review:'INDEPENDENT'},p_contract_snapshot:{classification:'NON_CONTRACTUAL_DEMO',test:true},p_invited_email:owner.email,p_invitation_token_hash:createHash('sha256').update(mandate.privateToken).digest('hex'),p_invitation_locale:'fr-MA',p_invitation_terms:{classification:'NON_CONTRACTUAL_DEMO'},p_change_reason:'Recette locale TEST explicitement non contractuelle',p_idempotency_key:mandate.proposalKey,p_correlation_id:mandate.correlation });
  if (proposed.error) throw Error('NATIVE_FRANCHISE_PROPOSAL_FAILED:' + proposed.error.code + ':' + proposed.error.message);
  mandate.proposal = proposed.data; await save();
}
if (!mandate.approved) {
  const refused = await author.client.rpc('decide_franchise_governance',{p_approval_request_id:mandate.proposal.approval_request_id,p_decision:'APPROVE',p_reason:'Auto approbation TEST doit être refusée',p_expected_row_version:1,p_idempotency_key:randomUUID()});
  if (refused.error?.code !== '42501') throw Error('INDEPENDENT_FRANCHISE_APPROVAL_REQUIRED');
  const approved = await reviewer.client.rpc('decide_franchise_governance',{p_approval_request_id:mandate.proposal.approval_request_id,p_decision:'APPROVE',p_reason:'Approbation indépendante de la recette locale TEST',p_expected_row_version:1,p_idempotency_key:mandate.approvalKey});
  if (approved.error) throw Error('NATIVE_FRANCHISE_APPROVAL_FAILED:' + approved.error.code);
  mandate.approved = approved.data; mandate.approvalCandidate=pin.commit; mandate.selfApprovalDenied = true; await save();
}
console.log(JSON.stringify({ status:'NATIVE_FRANCHISE_PROPOSAL_AND_INDEPENDENT_APPROVAL_READY',source:pin.commit,label,selfApprovalDenied:mandate.selfApprovalDenied,activationPending:true,legalSignatureCertified:false }));
