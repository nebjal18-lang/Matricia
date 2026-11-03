/**
 * TEST ONLY: SQL-fixture identities (NOT GoTrue/OTP/TOTP actors), native credit
 * pack governance, independent posting approval, checkout and trusted DEMO
 * callback. No external PSP, fiscal classification or distributable profit is
 * certified. No compliance verification, document or scan is fabricated. The
 * native onboarding identity gate must genuinely allow this new TEST client.
 * The browser's separate genuine Finance AAL2 actor uploads/scans real PDF bytes.
 *
 * This file performs no work on import. Execution additionally needs the root's
 * explicit --release-finance-source-seed=<exact-cohort> after the matrix releases
 * the database; --coordinated and the exact --candidate=<SHA> remain mandatory.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { fixtureState, privateDirectory, persistPrivate, sql, sourceCandidate } from './franchise-final-support.mjs';

const COHORT = 'b9bd23e4-8232-4fbd-9c5d-8d19b3b16284';
const APP_TREE = 'd334946aa988aceda5543b72c64411035643206f';
const SCOPE = 'FRANCHISE_FINAL_FINANCE_PSP_SOURCE_V1_B9BD';
const ORG = 'bfe90000-0000-4000-8000-000000000001';
const CLIENT = 'afe90000-0000-4000-8000-000000000001';
const MAKER = 'afe90000-0000-4000-8000-000000000002';
const REVIEWER = 'afe90000-0000-4000-8000-000000000003';
const ORG_NAME = 'TEST FINAL FINANCE C2 B9BD';
const PACK = 'TEST_FINAL_FINANCE_C2_B9BD_EUR';
const ORDER = 'TEST-FINAL-FINANCE-C2-B9BD-ORDER';
const EVENT = 'TEST-FINAL-FINANCE-C2-B9BD-EVENT';
const CAPTURE = 'TEST-FINAL-FINANCE-C2-B9BD-CAPTURE';

export function financeSourceSql() {
  // All interpolated values below are fixed source constants, never shell/env
  // strings, user-controlled identifiers, tokens, endpoint URLs or SQL inputs.
  return `begin;
set local search_path=public,extensions;
set local lock_timeout='8s';
set local statement_timeout='75s';
select pg_advisory_xact_lock(hashtextextended('${SCOPE}',0));
do $seed$
declare pack jsonb;posting jsonb;preparation jsonb;registered jsonb;captured jsonb;
 org public.organizations%rowtype;e public.credit_pack_payment_events_v1%rowtype;funding public.credit_economic_funding_sources_v1%rowtype;
 marker jsonb:=jsonb_build_object('isolated_browser_fixture','${COHORT}','test_fixture','${SCOPE}','sql_fixture_identity',true,'gotrue_or_totp_certified',false);
 actor uuid;n integer;canonical jsonb;payload_hash text;verification_hash text;
begin
 if current_database()<>'postgres'or(select environment from private.admin_execution_environment_v1 where singleton)is distinct from'DEVELOPMENT'
  or not exists(select 1 from public.catalog_libraries where code='TEST_PROVIDER_B9BD23E48232')
 then raise exception'EXACT_B9BD_DEVELOPMENT_DATABASE_REQUIRED';end if;
  payload_hash:=private.canonical_request_hash(jsonb_build_object('scope','${SCOPE}','provider','DEMO','event','${EVENT}','order','${ORDER}','capture','${CAPTURE}','amount_minor',10001,'currency','EUR'));
  verification_hash:=private.canonical_request_hash(jsonb_build_object('scope','${SCOPE}','method','DEMO_SIMULATION','not_external_psp_verification',true));
 select*into org from public.organizations where id='${ORG}';
 if org.id is null then
  if exists(select 1 from auth.users where id in('${CLIENT}','${MAKER}','${REVIEWER}')or email in('test-finance-c2-b9bd-client@example.invalid','test-finance-c2-b9bd-maker@example.invalid','test-finance-c2-b9bd-reviewer@example.invalid'))
   or exists(select 1 from public.credit_pack_definitions where code='${PACK}')
   or exists(select 1 from public.credit_pack_payment_events_v1 where provider_event_id='${EVENT}'or provider_intent_id='${ORDER}'or payment_reference='${CAPTURE}')
  then raise exception'PARTIAL_OR_FOREIGN_TEST_FINANCE_SOURCE_REQUIRES_REVIEW';end if;
  for n in 1..3 loop
   actor:=('afe90000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
   insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
   values(actor,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',case n when 1 then'test-finance-c2-b9bd-client@example.invalid'when 2 then'test-finance-c2-b9bd-maker@example.invalid'else'test-finance-c2-b9bd-reviewer@example.invalid'end,'',now(),marker,jsonb_build_object('TEST_ONLY','SQL_METADATA_NO_GOTRUE_OR_TOTP_SESSION'),now(),now());
  end loop;
  -- Declared synthetic master identities only. No financial table is seeded.
  insert into public.organizations(id,legal_name,display_name,status,created_by)values('${ORG}','${ORG_NAME}','${ORG_NAME}','ACTIVE','${CLIENT}');
  insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values('cfe90000-0000-4000-8000-000000000001','${ORG}','${CLIENT}','ACTIVE',now());
  insert into public.organization_member_roles(membership_id,role_code)values('cfe90000-0000-4000-8000-000000000001','CLIENT_OWNER');
  insert into public.platform_user_roles(user_id,role_code)values('${MAKER}','FINANCE_MANAGER'),('${REVIEWER}','FINANCE_MANAGER');
  if private.client_identity_allows_new_operations('${ORG}')is distinct from true then raise exception'NATIVE_TEST_CLIENT_ONBOARDING_GATE_NOT_SATISFIED';end if;
  -- These are declared SQL authorization actors, not browser authentication.
  perform set_config('request.jwt.claim.sub','${MAKER}',true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims','{"sub":"${MAKER}","role":"authenticated","aal":"aal2"}',true);
  pack:=public.create_credit_pack_version('${ORG}','${PACK}','TEST Pack finance C2','حزمة اختبار مالية',3,10001,'EUR',365,'test-finance-c2-b9bd-pack');
  perform public.activate_credit_pack_version('${ORG}',(pack->>'pack_version_id')::uuid,'test-finance-c2-b9bd-activate');
  posting:=public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(pack->>'pack_version_id')::uuid,null,'EUR','DEVELOPMENT',1,current_date-1,null,
   '{"cash_account_code":"TEST_C2_B9BD_CASH_EUR","cash_name_fr":"TEST Trésorerie C2","cash_name_ar":"خزينة اختبار","suspense_account_code":"TEST_C2_B9BD_PENDING_EUR","suspense_name_fr":"TEST Encaissement en attente C2","suspense_name_ar":"تحصيل اختبار معلق"}',
   'TEST ONLY mapping for native DEMO capture; no external payment or fiscal certification','test-finance-c2-b9bd-posting');
  perform set_config('request.jwt.claim.sub','${REVIEWER}',true);perform set_config('request.jwt.claims','{"sub":"${REVIEWER}","role":"authenticated","aal":"aal2"}',true);
  perform public.decide_credit_revenue_policy_v1((posting->>'request_id')::uuid,true,posting->>'request_hash','TEST independent SQL reviewer of the DEMO posting mapping');
  perform set_config('request.jwt.claim.sub','${CLIENT}',true);perform set_config('request.jwt.claims','{"sub":"${CLIENT}","role":"authenticated","aal":"aal2"}',true);
  preparation:=public.prepare_credit_pack_payment_intent_v1('${ORG}',(pack->>'pack_version_id')::uuid,'DEMO','DEMO','test-finance-c2-b9bd-checkout');
  if preparation->>'create_authorized'is distinct from'true'then raise exception'NATIVE_TEST_CHECKOUT_CREATE_NOT_AUTHORIZED';end if;
  perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);
  registered:=public.register_credit_pack_payment_intent_v1((preparation->>'preparation_id')::uuid,'DEMO','${ORDER}',10001,'EUR');
  captured:=public.process_verified_credit_pack_payment_v1('DEMO','DEMO','${EVENT}','${ORDER}','PAYMENT_SUCCEEDED',10001,'EUR',clock_timestamp(),'${CAPTURE}',payload_hash,verification_hash,'ffe90000-0000-4000-8000-000000000001');
  if captured->>'outcome'is distinct from'CREDIT_PACK_CAPTURED'or captured->>'verification_method'is distinct from'DEMO_SIMULATION'then raise exception'NATIVE_TEST_DEMO_CAPTURE_FAILED';end if;
 end if;
 -- Reuse is allowed only after exact known TEST identities AND canonical capture
 -- are independently re-read. Partial or unexpected fixtures always abort.
 if not exists(select 1 from public.organizations where id='${ORG}'and legal_name='${ORG_NAME}'and display_name='${ORG_NAME}'and status='ACTIVE'and created_by='${CLIENT}')
  or(select count(*)from auth.users where raw_app_meta_data@>marker and((id='${CLIENT}'and email='test-finance-c2-b9bd-client@example.invalid')or(id='${MAKER}'and email='test-finance-c2-b9bd-maker@example.invalid')or(id='${REVIEWER}'and email='test-finance-c2-b9bd-reviewer@example.invalid')))<>3
  or not exists(select 1 from public.organization_memberships m join public.organization_member_roles r on r.membership_id=m.id where m.id='cfe90000-0000-4000-8000-000000000001'and m.user_id='${CLIENT}'and m.organization_id='${ORG}'and m.status='ACTIVE'and r.role_code='CLIENT_OWNER'and r.revoked_at is null)
  or not exists(select 1 from public.platform_user_roles where user_id='${MAKER}'and role_code='FINANCE_MANAGER'and revoked_at is null)
  or not exists(select 1 from public.platform_user_roles where user_id='${REVIEWER}'and role_code='FINANCE_MANAGER'and revoked_at is null)
 then raise exception'EXACT_KNOWN_TEST_FINANCE_IDENTITIES_REQUIRED';end if;
 select*into e from public.credit_pack_payment_events_v1 where organization_id='${ORG}'and gateway='DEMO'and provider_environment='DEMO'and provider_event_id='${EVENT}';
 canonical:=private.credit_pack_payment_source_v1(e.id);
 select*into funding from public.credit_economic_funding_sources_v1 where organization_id='${ORG}'and source_kind='CREDIT_PACK'and financial_journal_id=e.financial_journal_id;
 if canonical is null or canonical->>'created_by'is distinct from'${CLIENT}'or e.payload_hash is distinct from payload_hash or e.verification_evidence_hash is distinct from verification_hash or e.provider_intent_id is distinct from'${ORDER}'or e.payment_reference is distinct from'${CAPTURE}'or e.deployment_environment is distinct from'DEVELOPMENT'
  or e.verification_method is distinct from'DEMO_SIMULATION'or e.amount_minor is distinct from 10001::bigint or e.currency is distinct from'EUR'::bpchar
  or not exists(select 1 from public.credit_pack_versions v join public.credit_pack_definitions d on d.id=v.pack_id where v.id=e.pack_version_id and v.created_by='${MAKER}'and d.code='${PACK}'and v.quantity=3 and v.price_minor=10001 and v.currency='EUR')
  or(select count(*)from public.credit_pack_payment_events_v1 where organization_id='${ORG}')<>1
  or(select count(*)from public.financial_journals where organization_id='${ORG}'and journal_type='CREDIT_PACK_PAYMENT')<>1
  or(select count(*)from public.credit_economic_funding_sources_v1 where organization_id='${ORG}'and financial_journal_id=e.financial_journal_id)<>1
  or funding.id is null or funding.source_id is distinct from'DEMO:DEMO:${CAPTURE}'or funding.gross_minor<>10001 or funding.currency<>'EUR'or funding.source_hash is distinct from private.canonical_request_hash(funding.source_snapshot)
  or funding.source_kind is distinct from'CREDIT_PACK'or funding.source_version_id is distinct from e.pack_version_id
  or(select count(*)from public.financial_entries where journal_id=e.financial_journal_id)<>2
  or not exists(select 1 from public.financial_entries line join public.financial_accounts account on account.id=line.account_id
   where line.journal_id=e.financial_journal_id and line.organization_id='${ORG}'and account.organization_id='${ORG}'and line.currency='EUR'and account.currency='EUR'
   group by line.journal_id having count(*)=2
    and sum(case when account.account_type='ASSET'and line.direction='DEBIT'then line.amount_minor else 0 end)=10001
    and sum(case when account.account_type='LIABILITY'and line.direction='CREDIT'then line.amount_minor else 0 end)=10001)
  or funding.source_snapshot#>>'{first_evidence,payment_event_id}'is distinct from e.id::text
  or private.canonical_request_hash((funding.source_snapshot->'first_evidence')-'payment_event_id')is distinct from e.source_hash
  or not exists(select 1 from public.credit_economic_funding_evidence_v1 proof where proof.funding_source_id=funding.id and proof.evidence_kind='NATIVE_CAPTURE'and proof.evidence_snapshot=funding.source_snapshot->'first_evidence'and proof.evidence_hash=private.canonical_request_hash(proof.evidence_snapshot))
  or private.credit_lot_funding_status_v1(e.credit_lot_id)is distinct from'ELIGIBLE'
 then raise exception'CANONICAL_NATIVE_DEMO_FUNDING_SOURCE_VERIFICATION_FAILED';end if;
end $seed$;
-- Only after every assertion above is satisfied can this transaction commit.
commit;
select jsonb_build_object('scope','${SCOPE}','cohort','${COHORT}','organizationId',e.organization_id,'fundingSourceId',f.id,'fundingSourceHash',f.source_hash,'paymentEventId',e.id,'financialJournalId',e.financial_journal_id,'amountMinor',e.amount_minor::text,'currency',e.currency,'accountingBasis','BALANCED_CASH_SUSPENSE_GROSS_PENDING_FISCAL_REVIEW','netRevenueCertified',false,'nativeCaptureVerified',true,'externalPspCertified',false,'sqlFixtureIdentitiesOnly',true,'gotrueOrTotpIdentityCertified',false,'clientComplianceLegallyVerified',false,'financeProofOrScanSeeded',false)
from public.credit_pack_payment_events_v1 e join public.credit_economic_funding_sources_v1 f on f.financial_journal_id=e.financial_journal_id and f.organization_id=e.organization_id and f.source_kind='CREDIT_PACK'and f.source_id='DEMO:DEMO:${CAPTURE}'
where e.organization_id='${ORG}'and e.provider_event_id='${EVENT}';`;
}

export async function seedFinalFinanceSource() {
  if (!process.argv.includes(`--release-finance-source-seed=${COHORT}`)) throw Error('ROOT_DATABASE_RELEASE_FOR_EXACT_FINANCE_SOURCE_REQUIRED');
  const state = await fixtureState(), pin = await sourceCandidate();
  if (state.token !== COHORT || state.database !== 'matricia_provider_browser_db_b9bd23e482324fbd'
      || state.label !== `matricia.provider-browser-test=${COHORT}` || pin.appTree !== APP_TREE
      || state.candidate.migrations.length !== 558 || pin.migrations.length !== 558
      || JSON.stringify(state.candidate.migrations) !== JSON.stringify(pin.migrations)) throw Error('EXACT_FROZEN_B9BD_FINANCE_COHORT_REQUIRED');
  const raw = sql(state, financeSourceSql());
  const lines = raw.trim().split('\n').filter(line => line.startsWith('{'));
  if (lines.length !== 1) throw Error('EXACT_SINGLE_FINANCE_SOURCE_RECEIPT_REQUIRED');
  const receipt = JSON.parse(lines[0]);
  if (receipt.scope !== SCOPE || receipt.cohort !== COHORT || receipt.organizationId !== ORG || receipt.nativeCaptureVerified !== true || !receipt.fundingSourceId) throw Error('CANONICAL_FINANCE_SOURCE_RECEIPT_REQUIRED');
  const file = resolve(await privateDirectory(state), 'finance-source.private.json');
  await persistPrivate(file, {...receipt, productCandidate: pin.commit, appTree: pin.appTree, seededBy: 'DECLARED_SQL_FIXTURE_NATIVE_DEMO_COMMANDS', browserFinanceActorRequired: true});
  console.log(JSON.stringify({scope:SCOPE,status:'CANONICAL_TEST_DEMO_SOURCE_READY',externalPspCertified:false,financeProofOrScanSeeded:false}));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await seedFinalFinanceSource();
