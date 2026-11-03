begin;
set local search_path=public,extensions;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='NON_CONTRACTUAL_SQL_CREDIT_275',configured_at=clock_timestamp()where singleton;
-- TEST ONLY complete native current economic flow; historical closing fixture
-- is separately identified below. No trigger, role, clock or guard is bypassed.
-- SQL authorization/accounting contracts with declared synthetic identities and
-- the native DEMO payment constructor. No PSP signature or physical bytes are
-- certified by this fixture; API verification is tested by the payment owner.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a2750000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','credit275-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)n;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2750000-0000-4000-8000-000000000001','Credit 275 SARL','Credit 275 SARL','ACTIVE','a2750000-0000-4000-8000-000000000001'),
('b2750000-0000-4000-8000-000000000004','Other275 SARL','Other275 SARL','ACTIVE','a2750000-0000-4000-8000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','a2750000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2750000-0000-4000-8000-000000000004','b2750000-0000-4000-8000-000000000004','a2750000-0000-4000-8000-000000000004','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c2750000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2750000-0000-4000-8000-000000000004','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a2750000-0000-4000-8000-000000000002','FINANCE_MANAGER'),('a2750000-0000-4000-8000-000000000003','FINANCE_MANAGER'),('a2750000-0000-4000-8000-000000000005','FINANCE_MANAGER'),('a2750000-0000-4000-8000-000000000005','READ_ONLY_AUDITOR');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b2750000-0000-4000-8000-000000000001','ICE','997275000000001','VERIFIED'),('b2750000-0000-4000-8000-000000000001','IF','99727501','VERIFIED'),('b2750000-0000-4000-8000-000000000001','RC','TEST275','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','VERIFIED',1,'a2750000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99727501","rc_number":"TEST275","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Credit 275 SARL","display_name":"Credit 275 SARL","country_code":"MA","identifiers":{"ICE":"997275000000001","IF":"99727501","RC":"TEST275"}}',1,'a2750000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001',1,now()-interval'1 day','a2750000-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f2751000-0000-0000-0000-000000000001','f2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b2750000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a2750000-0000-4000-8000-000000000002',clock_timestamp(),'a2750000-0000-4000-8000-000000000001'),
('f2751000-0000-0000-0000-000000000002','f2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b2750000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a2750000-0000-4000-8000-000000000002',clock_timestamp(),'a2750000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f2752000-0000-0000-0000-000000000001','f2751000-0000-0000-0000-000000000001','b2750000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2753000-0000-0000-0000-000000000001'),
('f2752000-0000-0000-0000-000000000002','f2751000-0000-0000-0000-000000000002','b2750000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2753000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f2751000-0000-0000-0000-000000000001' then 'f2752000-0000-0000-0000-000000000001'::uuid
  else 'f2752000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f2751000-0000-0000-0000-000000000001','f2751000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a2750000-0000-4000-8000-000000000002',clock_timestamp(),'a2750000-0000-4000-8000-000000000001','f2751000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a2750000-0000-4000-8000-000000000002',clock_timestamp(),'a2750000-0000-4000-8000-000000000001','f2751000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');



create temporary table p275(k text primary key,v jsonb);grant all on p275 to authenticated,service_role;
grant usage on schema extensions to authenticated,service_role;
create function pg_temp.actor275(n integer,aal text default 'aal2')returns void language plpgsql as $$declare actor uuid:=('a2750000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;begin
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal',aal)::text,true);
end$$;
create function pg_temp.service275()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;
set local role authenticated;select pg_temp.actor275(2);
insert into p275 values('pack',public.create_credit_pack_version('b2750000-0000-4000-8000-000000000001','CREDIT275_EUR','Pack de recette','حزمة الاختبار',3,10001,'EUR',365,'credit275-create-pack'));
select public.activate_credit_pack_version('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'credit275-activate-pack');
select pg_temp.actor275(1);
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'DEMO','DEMO','credit275-no-mapping')$$,'55000','APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED','checkout refuses before PSP when no approved posting mapping exists');
select pg_temp.actor275(2);
insert into p275 values('posting',public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,'{"cash_account_code":"CREDIT275_CASH_EUR","cash_name_fr":"Trésorerie de recette","cash_name_ar":"خزينة الاختبار","suspense_account_code":"CREDIT275_PENDING_EUR","suspense_name_fr":"Encaissement en attente","suspense_name_ar":"تحصيل قيد المراجعة"}','Mapping synthétique exclusivement pour recette SQL','credit275-posting-policy'));
select throws_ok($$select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p275 where k='posting'),true,(select v->>'request_hash'from p275 where k='posting'),'Tentative auto approbation interdite')$$,'42501','CREDIT_REVENUE_INDEPENDENT_REVIEW_REQUIRED','mapping maker cannot approve its own proposal');
select pg_temp.actor275(3);
select throws_ok($$select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p275 where k='posting'),true,repeat('f',64),'Revue avec empreinte périmée interdite')$$,'40001','STALE_CREDIT_REVENUE_POLICY_REQUEST','review pins the exact policy request hash');
insert into p275 values('posting-approved',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p275 where k='posting'),true,(select v->>'request_hash'from p275 where k='posting'),'Approbation indépendante de recette SQL'));
select pg_temp.actor275(1);
insert into p275 values('prep',public.prepare_credit_pack_payment_intent_v1('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'DEMO','DEMO','credit275-checkout'));
select is((select v->>'create_authorized'from p275 where k='prep'),'true','only first preparation authorizes provider CREATE');
insert into p275 values('prep-replay',public.prepare_credit_pack_payment_intent_v1('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'DEMO','DEMO','credit275-checkout'));
select is((select v->>'create_authorized'from p275 where k='prep-replay'),'false','same-key ambiguity never authorizes a second provider CREATE');
select is((select v->>'creation_state'from p275 where k='prep-replay'),'CREATE_REQUESTED_UNKNOWN','unregistered attempt remains explicitly unknown');
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'DEMO','DEMO','credit275-another-key')$$,'55000','CREDIT_PACK_PAYMENT_ATTEMPT_ALREADY_PENDING','another key cannot order twice while creation is ambiguous');
select pg_temp.actor275(2);
insert into p275 values('posting-revoke',public.request_credit_revenue_policy_revocation_v1((select(v->>'policy_version_id')::uuid from p275 where k='posting'),'Révocation gouvernée après préparation de la recette','credit275-revoke-posting'));
select pg_temp.actor275(3);
insert into p275 values('posting-revoked',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p275 where k='posting-revoke'),true,(select v->>'request_hash'from p275 where k='posting-revoke'),'Approbation indépendante de révocation'));
reset role;select pg_temp.service275();set local role service_role;
insert into p275 values('intent',public.register_credit_pack_payment_intent_v1((select(v->>'preparation_id')::uuid from p275 where k='prep'),'DEMO','SYNTHETIC-CREDIT275-ORDER',10001,'EUR'));
select is(public.resolve_verified_payment_kind_v1('DEMO','DEMO','SYNTHETIC-CREDIT275-ORDER',null)->>'kind','CREDIT_PACK','verified native order reference resolves the pack domain');
insert into p275 values('paid-at',to_jsonb(statement_timestamp()));
insert into p275 values('paid',public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT275-EVENT','SYNTHETIC-CREDIT275-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p275 where k='paid-at'),'SYNTHETIC-CREDIT275-CAPTURE',repeat('a',64),repeat('b',64),'f275c000-0000-4000-8000-000000000001'));
reset role;
select is((select v->>'outcome'from p275 where k='paid'),'CREDIT_PACK_CAPTURED','native DEMO capture creates the paid pack fact');
select is((select count(*)from public.credit_pack_payment_events_v1 where organization_id='b2750000-0000-4000-8000-000000000001'),1::bigint,'one immutable native capture exists');
select is((select count(*)from public.financial_journals where organization_id='b2750000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'capture posts one balanced cash/suspense journal');
select is((select currency::text from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p275 where k='paid')),'EUR','non-MAD pack retains its actual paid currency in the lot');
select is((select quantity from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p275 where k='paid')),3::bigint,'pack quantity is pinned to the frozen offer');
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p275 where k='paid')),'ELIGIBLE','captured pack is funded even while fiscal valuation is pending');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select id from public.credit_economic_funding_sources_v1 where organization_id='b2750000-0000-4000-8000-000000000001')),10001::numeric,'gross capture is retained exactly in the pending economic ledger');
select is((select count(*)from public.credit_economic_classifications_v1 c join public.credit_economic_funding_sources_v1 f on f.id=c.funding_source_id where f.organization_id='b2750000-0000-4000-8000-000000000001'),0::bigint,'missing fiscal context never invents a net revenue classification');
select is((select count(*)from public.credit_economic_allocations_v1 c join public.credit_economic_funding_sources_v1 f on f.id=c.funding_source_id where f.organization_id='b2750000-0000-4000-8000-000000000001'),0::bigint,'missing fiscal context never announces library income');

-- First capture retained its frozen approved mapping after revocation.
select is((select v->>'outcome'from p275 where k='posting-revoked'),'CREDIT_REVENUE_POLICY_REVOKED','posting policy was actually revoked before the paid callback');
select pg_temp.service275();
select is(public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT275-EVENT','SYNTHETIC-CREDIT275-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p275 where k='paid-at'),'SYNTHETIC-CREDIT275-CAPTURE',repeat('a',64),repeat('c',64),'f275c000-0000-4000-8000-000000000099')->>'replayed','true','same verified body with new transmission fingerprint replays without another cash journal');
select throws_ok($$select public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT275-EVENT','SYNTHETIC-CREDIT275-ORDER','PAYMENT_SUCCEEDED',10002,'EUR',(select(v#>>'{}')::timestamptz from p275 where k='paid-at'),'SYNTHETIC-CREDIT275-CAPTURE',repeat('a',64),repeat('c',64))$$,'23514','CREDIT_PACK_CAPTURE_CONTEXT_MISMATCH','wrong paid amount cannot mutate the captured fact');
select throws_ok($$select public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT275-EVENT','SYNTHETIC-CREDIT275-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p275 where k='paid-at'),'SYNTHETIC-CREDIT275-CAPTURE',repeat('f',64),repeat('c',64))$$,'22000','CREDIT_PACK_CAPTURE_REPLAY_MISMATCH','same provider event cannot change its verified payload');
select is((select count(*)from public.financial_journals where organization_id='b2750000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'duplicate callback creates no second journal');
select is((select count(*)from public.credit_ledger_entries where organization_id='b2750000-0000-4000-8000-000000000001'and entry_type='GRANT'),1::bigint,'duplicate callback creates no second credit grant');
select throws_ok($$select private.register_payment_provider_target_v1('SUBSCRIPTION',extensions.gen_random_uuid(),'DEMO','DEMO','INTENT','SYNTHETIC-CREDIT275-ORDER',repeat('e',64))$$,'23514','PAYMENT_PROVIDER_REFERENCE_ALREADY_BOUND','same native order cannot be routed to subscription and pack');
select pg_temp.actor275(2);
select throws_ok($$select public.issue_credits('b2750000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p275 where k='paid'),'EXTRA_PURCHASE',3,clock_timestamp()+interval'1 year',null,'manual-payment-ref',10001,'MANUAL_V1',null,'credit275-forged-extra')$$,'55000','CREDIT_PACK_CANONICAL_PAYMENT_REQUIRED','an admin free-text reference cannot fabricate paid credits');
select pg_temp.actor275(1);
insert into p275 values('paid-replay',public.prepare_credit_pack_payment_intent_v1('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'DEMO','DEMO','credit275-checkout'));
select is((select v->>'create_authorized'from p275 where k='paid-replay'),'false','paid preparation replay never authorizes another provider order');
select is((select v->'capture_result'->>'outcome'from p275 where k='paid-replay'),'CREDIT_PACK_CAPTURED','paid preparation replay returns its exact canonical capture');
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'DEMO','DEMO','credit275-after-revocation')$$,'55000','APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED','revoked mapping blocks a new order before external money calls');
select pg_temp.actor275(4);
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2750000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),'DEMO','DEMO','credit275-cross-tenant')$$,'42501','CREDIT_PACK_CHECKOUT_DENIED','sibling organization cannot initiate another tenant purchase');
set local role authenticated;
select is((select count(*)from public.credit_pack_payment_events_v1 where organization_id='b2750000-0000-4000-8000-000000000001'),0::bigint,'sibling tenant cannot read the native payment capture');
reset role;
select pg_temp.actor275(3);
select set_config('request.jwt.claims','{"sub":"a2750000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.propose_credit_economic_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v#>>'{}')::uuid from p275 where k='cost-psp-journal'),'TEST missing aal cannot propose a cost','TEST364-missing-aal-propose')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','known Finance actor with absent aal cannot propose');
select throws_ok($$select public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),(select v->>'source_hash'from p275 where k='psp-proposal'),true,'TEST missing aal cannot replay approval')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','known Finance actor with absent aal cannot decide or replay');
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST missing aal cannot reconcile','TEST364-missing-aal-reconcile')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','known Finance actor with absent aal cannot reconcile');
select throws_ok($$select public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)$$,'42501','CREDIT_ECONOMIC_PROFIT_READ_DENIED','missing aal cannot inspect sensitive reconciliation');
select pg_temp.actor275(3,null);
select throws_ok($$select public.propose_credit_economic_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v#>>'{}')::uuid from p275 where k='cost-psp-journal'),'TEST null aal cannot propose a cost','TEST364-null-aal-propose')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','known Finance actor with explicit null aal cannot propose');
select throws_ok($$select public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),(select v->>'source_hash'from p275 where k='psp-proposal'),true,'TEST null aal cannot replay approval')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','known Finance actor with explicit null aal cannot decide or replay');
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST null aal cannot reconcile','TEST364-null-aal-reconcile')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','known Finance actor with explicit null aal cannot reconcile');
select throws_ok($$select public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)$$,'42501','CREDIT_ECONOMIC_PROFIT_READ_DENIED','null aal cannot inspect sensitive reconciliation');
select pg_temp.actor275(5);
select throws_ok($$select public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),null,'EUR','DEVELOPMENT',2,current_date,null,'{}','Auditeur ne peut configurer le paiement','credit275-auditor-policy')$$,'42501','CREDIT_REVENUE_POLICY_CREATE_DENIED','combined read-only auditor remains unable to mutate finance policy');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p275 where k='paid')),'ENVIRONMENT_INCOMPATIBLE','DEMO capture cannot fund credits after retag to production');
select is((select provider_environment from public.credit_pack_payment_events_v1 where id=(select(v->>'payment_event_id')::uuid from p275 where k='paid')),'DEMO','retag never rewrites immutable payment provenance');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select ok(not has_function_privilege('authenticated','private.post_verified_payment_suspense_v1(uuid,uuid,text,text,bigint,character,timestamp with time zone,uuid,uuid)','EXECUTE'),'browser cannot post a journal through the private payment constructor');
select ok(not has_function_privilege('authenticated','public.process_verified_credit_pack_payment_v1(text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)','EXECUTE'),'browser cannot impersonate the verified callback');
select throws_ok($$update public.credit_pack_payment_events_v1 set amount_minor=1 where organization_id='b2750000-0000-4000-8000-000000000001'$$,'55000','IMMUTABLE_RECORD','captured payment cannot be rewritten');
-- Explicit synthetic fiscal configuration, approved through the real commands.
insert into p275 select'funding',to_jsonb(id)from public.credit_economic_funding_sources_v1 where organization_id='b2750000-0000-4000-8000-000000000001';
set local role authenticated;select pg_temp.actor275(1);
select throws_ok($$select public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p275 where k='funding'))$$,'42501','CREDIT_ECONOMIC_RECONCILIATION_DENIED','client cannot classify its own captured money');
select pg_temp.actor275(2);
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p275 where k='funding'))->>'status','PENDING_FISCAL_REVIEW','captured gross never becomes revenue without an approved fiscal context');
insert into p275 values('billing',public.create_client_billing_policy_v1(jsonb_build_object('series_key','SQL275_FISCAL','version',1,'currency','EUR','tax_rate_bps',2000,'tax_label_fr','Taxe synthétique de recette','tax_label_ar','ضريبة اختبار','jurisdiction','TEST_ONLY','issuer',jsonb_build_object('legal_name','SQL Test Issuer','legal_form','TEST','address','Synthetic SQL fixture address','ice','997275000000002','if_number','99727502','rc_number','SQL275','contact_email','fiscal275@example.invalid'),'invoice_prefix','SQL275I','credit_prefix','SQL275C','invoice_start_number','1','credit_start_number','1','valid_from',(current_date-2)::text,'service_label_fr','Produit de recette uniquement','service_label_ar','منتج اختبار فقط','approval_reference','SYNTHETIC_SQL_NOT_REAL_FISCAL_POLICY'),'credit275-billing-policy'));
select pg_temp.actor275(3);
select public.approve_client_billing_policy_v1((select(v->>'policy_id')::uuid from p275 where k='billing'),true,'Approbation fiscale indépendante de recette','credit275-approve-billing');
select pg_temp.actor275(2);
insert into p275 values('fiscal',public.create_credit_revenue_policy_v1('FISCAL','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 jsonb_build_object('billing_policy_version_id',(select v->>'policy_id'from p275 where k='billing'),'recognition_accounts',jsonb_build_object('core',jsonb_build_object('code','SQL275_CORE_EUR','name_fr','Core de recette','name_ar','إيراد أساسي للاختبار'),'benefit_pool',jsonb_build_object('code','SQL275_POOL_EUR','name_fr','Pool de recette','name_ar','مجمع اختبار'),'unallocated',jsonb_build_object('code','SQL275_UNALLOC_EUR','name_fr','Crédits achetés non affectés','name_ar','أرصدة مشتراة غير مخصصة'),'tax',jsonb_build_object('code','SQL275_TAX_EUR','name_fr','Taxe de recette due','name_ar','ضريبة اختبار مستحقة'))),'Contexte fiscal de recette explicitement approuvé','credit275-fiscal-context'));
select pg_temp.actor275(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p275 where k='fiscal'),true,(select v->>'request_hash'from p275 where k='fiscal'),'Revue indépendante contexte fiscal de recette');
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p275 where k='funding'))->>'status','PENDING_ALLOCATION_POLICY','approved fiscal context does not invent an allocation policy');
select pg_temp.actor275(2);
insert into p275 values('allocation',public.create_credit_revenue_policy_v1('ALLOCATION','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p275 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 '{"purchase_rounding":"CUMULATIVE_FLOOR_REMAINDER","accepted_evidence_kinds":["OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT"],"fulfillment_modes":["MATRICIA_INTERNAL"]}',
 'Politique allocation de recette sans règle de production','credit275-allocation-policy'));
select pg_temp.actor275(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p275 where k='allocation'),true,(select v->>'request_hash'from p275 where k='allocation'),'Revue indépendante allocation de recette');
insert into p275 values('classified',public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p275 where k='funding')));
select is((select v->>'status'from p275 where k='classified'),'READY','governed fiscal and allocation policies classify the verified purchase');
select is((select v->>'net_minor'from p275 where k='classified'),'8334','gross-to-net derives only from the approved synthetic tax context');
select is((select v->>'tax_minor'from p275 where k='classified'),'1667','half-up tax remainder conserves the paid gross exactly');
reset role;
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),8334::numeric,'net purchased value waits for actual library consumption');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')and revenue_class='CAPTURE_GROSS_PENDING'),0::numeric,'classification clears the gross waiting economic balance');
select is((select count(*)from public.franchise_pnl_entries where financial_journal_id=(select financial_journal_id from public.credit_economic_funding_sources_v1 where id=(select(v#>>'{}')::uuid from p275 where k='funding'))),0::bigint,'unconsumed purchased value is not franchise profit');
select is((select count(*)from public.financial_journals where organization_id='b2750000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'fiscal recognition never posts a second cash journal');
select is((select sum(case direction when'DEBIT'then amount_minor else-amount_minor end)from public.financial_entries where journal_id=(select(v->>'classification_journal_id')::uuid from p275 where k='classified')),0::numeric,'recognition journal balances liability to revenue and tax without cash');
select pg_temp.actor275(3);set local role authenticated;
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p275 where k='funding'))->>'replayed','true','classification retry reuses the immutable source');
reset role;
select is((select count(*)from public.credit_economic_classifications_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')),1::bigint,'classification is appended once');
-- This regression repeats the native payment/receipt fixture with its own UUID scope.
-- Actual builder/onboarding commands create a clearly labelled DEV franchise,
-- and real benefit operations/independent receipt consume the purchased lot.
insert into public.platform_user_roles(user_id,role_code)values('a2750000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),('a2750000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e2750000-0000-4000-8000-000000000001','SQL275_LIBRARY','sql275-library','b2750000-0000-4000-8000-000000000001','DRAFT','a2750000-0000-4000-8000-000000000002');
set local role authenticated;select pg_temp.actor275(2);
insert into p275 values('franchise',public.propose_franchise_governance('e2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','FRANCHISEE','SQL275','Territoire TEST uniquement','نطاق اختبار فقط','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{}','credit275-1@example.invalid',repeat('7',64),'fr-MA','{}','Franchise de recette non contractuelle uniquement','credit275-franchise-propose'));
select pg_temp.actor275(3);
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from p275 where k='franchise'),'APPROVE','Approbation indépendante simulation de recette',1,'credit275-franchise-approve');
select pg_temp.actor275(1);
insert into p275 values('franchise-demo',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from p275 where k='franchise'),repeat('7',64),1,(select(v->>'mandate_version_id')::uuid from p275 where k='franchise'),public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from p275 where k='franchise'))->>'mandateHash',true,'credit275-franchise-simulation'));
select is((select v->>'activationMode'from p275 where k='franchise-demo'),'NON_CONTRACTUAL_DEMO','allocation fixture never claims a legally signed real franchise');
select pg_temp.actor275(2);
insert into p275 values('book',public.open_franchise_pnl_book_for_mandate_v1((select(v->>'franchise_id')::uuid from p275 where k='franchise'),(select(v->>'mandate_version_id')::uuid from p275 where k='franchise'),(select content_hash from public.franchise_mandate_versions where id=(select(v->>'mandate_version_id')::uuid from p275 where k='franchise')),'EUR',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1),'credit275-book'));
select is((select binding.approved_mandate_version_id from public.franchise_pnl_book_bindings_v1 binding where binding.book_id=(select(v->>'book_id')::uuid from p275 where k='book')),(select(v->>'mandate_version_id')::uuid from p275 where k='franchise'),'the actual STANDARD book is bound to the independently approved mandate, never a caller-selected IT label');
select ok(exists(select 1 from public.franchise_pnl_book_bindings_v1 binding join public.franchise_activation_evidence evidence on evidence.franchise_id=binding.franchise_id and evidence.approved_mandate_version_id=binding.approved_mandate_version_id join public.franchise_invitations invitation on invitation.id=evidence.invitation_id join public.franchise_mandate_versions active on active.id=evidence.active_mandate_version_id where binding.book_id=(select(v->>'book_id')::uuid from p275 where k='book')and evidence.active_mandate_version_id=(select(v->>'active_mandate_version_id')::uuid from p275 where k='franchise-demo')and invitation.status='ACCEPTED'and invitation.accepted_by=evidence.actor_user_id and invitation.accepted_at<=evidence.recorded_at and active.content_hash=evidence.mandate_hash),'native acceptance and its exact active clone remain the source of the bound book');
insert into p275 values('benefit',public.create_benefit_version('b2750000-0000-4000-8000-000000000001','CREDIT275_BENEFIT','CONSULTATION','MATRICIA_INTERNAL','Consultation SQL uniquement','استشارة اختبار فقط','Prestation synthétique du contrat SQL','خدمة تجريبية لاختبار SQL',1,1000,0,'EUR','e2750000-0000-4000-8000-000000000001',null,null,'{}','{}','SQL275_CANCELLATION',clock_timestamp()-interval'1 minute','credit275-benefit-create'));
select pg_temp.actor275(3);
select public.activate_benefit_version('b2750000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p275 where k='benefit'),'credit275-benefit-activate');
-- Admission is independently governed too (Provider268060).
select pg_temp.actor275(2);
insert into p275 values('admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p275 where k='benefit')));
insert into p275 values('admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p275 where k='benefit'),(select v->>'source_hash'from p275 where k='admission-context'),(select(v->>'head_id')::uuid from p275 where k='admission-context'),'NONE',null,null,'{}','{}',now()-interval'1 minute',null,'Politique admission synthétique explicitement revue','SQL275_ADMISSION_TEST_ONLY','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','f275a000-0000-4000-8000-000000000001'));
select pg_temp.actor275(3);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p275 where k='admission-policy'),(select v->>'content_hash'from p275 where k='admission-policy'),true,'SQL275_INDEPENDENT_APPROVAL','Revue indépendante de la politique admission SQL');
select pg_temp.actor275(1);
insert into p275 values('reserve',public.reserve_benefit_credits('b2750000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p275 where k='paid'),(select(v->>'benefit_version_id')::uuid from p275 where k='benefit'),1,clock_timestamp()+interval'1 day','credit275-reserve'));
select pg_temp.actor275(2);
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p275 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p275 where k='reserve')),'SCHEDULE',clock_timestamp()-interval'1 second','Planification opérationnelle effective de recette','credit275-schedule');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p275 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p275 where k='reserve')),'START',null,'Réalisation opérationnelle effective de recette','credit275-start');
insert into p275 values('delivery',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from p275 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p275 where k='reserve')),'Compte rendu synthétique du service effectivement exécuté dans ce contrat SQL','SQL275_OPERATIONAL_REPORT',null,'credit275-delivery'));
select pg_temp.actor275(1);
insert into p275 values('receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p275 where k='delivery'),(select v->>'source_hash'from p275 where k='delivery'),(select(v->>'row_version')::bigint from p275 where k='delivery'),true,'Réception indépendante de la prestation de cette recette SQL','credit275-receipt'));
select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p275 where k='reserve'),(select v->>'receipt_hash'from p275 where k='receipt'),'credit275-consume');
reset role;
select is((select count(*)from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p275 where k='reserve')),1::bigint,'public consumption appends its real canonical movement and independent receipt');
select is((select status from public.credit_economic_processing_events_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p275 where k='reserve')order by id desc limit 1),'PENDING_MANDATE','no arbitrary first book is selected without an approved library route');
select is((select count(*)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')),0::bigint,'unreviewed route cannot create library income');
set local role authenticated;select pg_temp.actor275(2);
insert into p275 values('route',public.create_credit_revenue_policy_v1('BOOK_ROUTE','LIBRARY','e2750000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','EUR','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('book_id',(select v->>'book_id'from p275 where k='book'),'franchise_id',(select v->>'franchise_id'from p275 where k='franchise'),'mandate_version_id',(select v->>'active_mandate_version_id'from p275 where k='franchise-demo')),'Affectation explicite bibliothèque client et mandat de recette','credit275-book-route'));
select pg_temp.actor275(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p275 where k='route'),true,(select v->>'request_hash'from p275 where k='route'),'Approbation indépendante du mandat et livre exacts');
insert into p275 values('allocated',public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p275 where k='reserve')));
reset role;
select is((select sum(amount_minor)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')and allocation_kind='PURCHASE_CONSUMPTION'),2778::numeric,'one of three purchased credits attributes its exact net share to the consumed library');
select is((select sum(amount_minor)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p275 where k='book')and source_type='CREDIT_ECONOMIC_ALLOCATION_V1'),2778::numeric,'canonical library attribution reaches the real P&L without invented cash');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),5556::numeric,'unspent purchased credits retain the remaining net value');
select pg_temp.actor275(3);set local role authenticated;
select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p275 where k='reserve'));
reset role;
select is((select count(*)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')),1::bigint,'consumption reconciliation never duplicates the P&L revenue');
select pg_temp.actor275(4);set local role authenticated;
select throws_ok($$select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p275 where k='reserve'))$$,'42501','CREDIT_ECONOMIC_RECONCILIATION_DENIED','foreign Client cannot allocate another tenant consumption');
select pg_temp.actor275(3,'aal1');
select throws_ok($$select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p275 where k='reserve'))$$,'42501','CREDIT_ECONOMIC_RECONCILIATION_DENIED','Finance needs current MFA for an economic allocation');
reset role;select pg_temp.actor275(3);
select ok(not has_function_privilege('authenticated','private.post_credit_economic_allocation_v1(uuid,uuid,uuid,text,text,bigint,uuid,jsonb,jsonb,date,uuid)','EXECUTE'),'browser cannot forge a canonical analytical allocation');
select throws_ok($$insert into public.franchise_pnl_entries(book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,correlation_id,created_by)select book_id,'REVENUE','COLLECTED_NET_REVENUE',amount_minor,currency,(select financial_journal_id from public.credit_economic_funding_sources_v1 where id=funding_source_id),'CREDIT_ECONOMIC_ALLOCATION_V1',id::text,current_date,'Spoofed source rejected','f275ffff-0000-4000-8000-000000000001','a2750000-0000-4000-8000-000000000003'from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p275 where k='funding')$$,'42501','CANONICAL_CREDIT_ECONOMIC_PNL_SOURCE_REQUIRED','reserved P&L source cannot be replayed through an unrelated writer');
-- Actual native POSTED journals are the cost proof. References/accounts below
-- are TEST setup; no journal, payment, balance, or P&L amount is inserted directly.
insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values
('e364a000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000001','TEST364_PSP_EXPENSE','TEST PSP ex-tax cost','EXPENSE','EUR'),
('e364a000-0000-4000-8000-000000000002','b2750000-0000-4000-8000-000000000001','TEST364_SERVICE_EXPENSE','TEST fulfillment ex-tax cost','EXPENSE','EUR'),
('e364a000-0000-4000-8000-000000000003','b2750000-0000-4000-8000-000000000001','TEST364_TAX_ASSET','TEST recoverable tax, never a cost','ASSET','EUR'),
('e364a000-0000-4000-8000-000000000004','b2750000-0000-4000-8000-000000000001','TEST364_PAYABLE','TEST expense payable','LIABILITY','EUR');
set local role authenticated;select pg_temp.actor275(2);
insert into p275 values('cost-psp-journal',to_jsonb(public.post_financial_journal('b2750000-0000-4000-8000-000000000001','TEST364-psp-journal',null,'CREDIT_PSP_FEE','EUR',clock_timestamp(),'TEST ONLY actual PSP settlement expense and separately accounted input tax','[{"account_id":"e364a000-0000-4000-8000-000000000001","direction":"DEBIT","amount_minor":300},{"account_id":"e364a000-0000-4000-8000-000000000003","direction":"DEBIT","amount_minor":60},{"account_id":"e364a000-0000-4000-8000-000000000004","direction":"CREDIT","amount_minor":360}]')));
insert into p275 values('cost-service-journal',to_jsonb(public.post_financial_journal('b2750000-0000-4000-8000-000000000001','TEST364-service-journal',null,'BENEFIT_FULFILLMENT_COST','EUR',clock_timestamp(),'TEST ONLY actual fulfillment expense and separately accounted input tax','[{"account_id":"e364a000-0000-4000-8000-000000000002","direction":"DEBIT","amount_minor":500},{"account_id":"e364a000-0000-4000-8000-000000000003","direction":"DEBIT","amount_minor":100},{"account_id":"e364a000-0000-4000-8000-000000000004","direction":"CREDIT","amount_minor":600}]')));
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST missing approved cost evidence must remain pending','TEST364-no-costs')$$,'55000','CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED','canonical income alone is still insufficient');
insert into p275 values('psp-proposal',public.propose_credit_economic_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v#>>'{}')::uuid from p275 where k='cost-psp-journal'),'TEST ONLY independent review of exact native PSP expense','TEST364-psp-proposal'));
select is((select v->>'net_cost_minor'from p275 where k='psp-proposal'),'300','PSP amount is derived ex-tax from actual expense accounts');
select throws_ok($$select public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),(select v->>'source_hash'from p275 where k='psp-proposal'),true,'TEST attempted approval by journal and proposal maker')$$,'42501','CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED','same author cannot approve its cost');
select pg_temp.actor275(3,'aal1');
select throws_ok($$select public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),(select v->>'source_hash'from p275 where k='psp-proposal'),true,'TEST review without a current second factor')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','cost approval requires current AAL2');
select pg_temp.actor275(3);
select throws_ok($$select public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),repeat('0',64),true,'TEST stale evidence cannot be approved')$$,'40001','CREDIT_ECONOMIC_COST_SOURCE_CHANGED','review pins exact canonical source hash');
insert into p275 values('psp-approved',public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),(select v->>'source_hash'from p275 where k='psp-proposal'),true,'TEST ONLY Finance independent of journal maker and target members'));
select is(public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),(select v->>'source_hash'from p275 where k='psp-proposal'),true,'TEST same persisted choice replay'),(select v from p275 where k='psp-approved'),'same decision returns original reconciliation');
select throws_ok($$select public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='psp-proposal'),(select v->>'source_hash'from p275 where k='psp-proposal'),false,'TEST opposite immutable choice')$$,'22000','DECISION_ALREADY_RECORDED','opposite decision is refused');
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST fulfillment cost is still unproved','TEST364-one-cost')$$,'55000','CREDIT_ECONOMIC_FINAL_RECONCILIATION_REQUIRED','PSP evidence cannot stand in for the fulfillment cost');
select pg_temp.actor275(2);
insert into p275 values('service-proposal',public.propose_credit_economic_cost_v1('FULFILLMENT_COST',(select(v->>'redemption_id')::uuid from p275 where k='reserve'),(select(v#>>'{}')::uuid from p275 where k='cost-service-journal'),'TEST ONLY true operational receipt and its exact native expense','TEST364-service-proposal'));
select pg_temp.actor275(3);
insert into p275 values('service-approved',public.decide_credit_economic_cost_v1((select(v->>'proposal_id')::uuid from p275 where k='service-proposal'),(select v->>'source_hash'from p275 where k='service-proposal'),true,'TEST ONLY independent cost and accepted delivery reconciliation'));
insert into p275 values('profit-reconciled',public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST ONLY derive every analytical cost from its reviewed journal','TEST364-reconcile'));
select is(public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST ONLY derive every analytical cost from its reviewed journal','TEST364-reconcile'),(select v from p275 where k='profit-reconciled'),'reconciliation replay is exact without duplicated costs');
select is(public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)->>'ready','true','native current payment, receipt and reviewed expenses are genuinely reconciled');
select is((public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)#>>'{allocations,0,psp_fee_minor}'),'100','PSP fee is attributed as exact one-third of funded net, not the gross including tax');
select is((public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)#>>'{allocations,0,fulfillment_cost_minor}'),'500','one receipt bears its exact fulfillment expense');
select throws_ok($$select public.close_franchise_profit_period((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,(select opened_under_rule_version_id from public.franchise_pnl_books where id=(select(v->>'book_id')::uuid from p275 where k='book')),clock_timestamp(),'TEST cannot close a civil period before its actual end','TEST364-current-close')$$,'22023','INVALID_FRANCHISE_CLOSURE','ready expenses never bypass the real civil-period cutoff');
reset role;
select is((select sum(amount_minor)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p275 where k='book')and effect_type='COST'),600::numeric,'input VAT is excluded from both actual cost shares');
select is((select count(*)from public.credit_economic_cost_attributions_v1),2::bigint,'each component has exactly one immutable attribution');
select is((select count(*)from public.franchise_profit_closure_versions where book_id=(select(v->>'book_id')::uuid from p275 where k='book')),0::bigint,'current native journey creates no premature closure');
select is((select count(*)from public.franchise_distribution_ledger_entries where book_id=(select(v->>'book_id')::uuid from p275 where k='book')),0::bigint,'current native journey invents neither a distribution accrual nor a payout');
select is((select count(*)from public.audit_events where action='credit.economic.cost.decided'),2::bigint,'replays/conflicts do not create extra decisions or audit');
select ok(not has_table_privilege('authenticated','public.credit_economic_cost_attributions_v1','INSERT'),'runtime cannot insert cost readiness');
select ok(not has_function_privilege('authenticated','private.credit_economic_cost_share_v1(uuid,text)','EXECUTE'),'private amount calculator is not an override');
set local role authenticated;select pg_temp.actor275(4);
select throws_ok($$select public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)$$,'42501','CREDIT_ECONOMIC_PROFIT_READ_DENIED','foreign Client cannot inspect the franchise reconciliation');
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST foreign Client cannot post costs','TEST364-foreign-reconcile')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','foreign Client cannot write analytical costs');
select pg_temp.actor275(5);
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST read-only auditor cannot mutate finance','TEST364-auditor-reconcile')$$,'42501','CREDIT_ECONOMIC_COST_REVIEW_DENIED','auditor plus Finance remains read-only');
reset role;

-- A tax transfer or an unrelated tenant's expense is not zero-cost evidence.
-- These are additional TEST journal facts, never a production rate or price.
insert into public.financial_accounts(id,organization_id,code,name,account_type,currency)values
('e364d000-0000-4000-8000-000000000001','b2750000-0000-4000-8000-000000000004','TEST364_FOREIGN_COST','TEST foreign expense','EXPENSE','EUR'),
('e364d000-0000-4000-8000-000000000002','b2750000-0000-4000-8000-000000000004','TEST364_FOREIGN_PAYABLE','TEST foreign payable','LIABILITY','EUR');
set local role authenticated;select pg_temp.actor275(2);
insert into p275 values('zero-expense-journal',to_jsonb(public.post_financial_journal('b2750000-0000-4000-8000-000000000001','TEST364-zero-expense-journal',null,'CREDIT_PSP_FEE','EUR',clock_timestamp(),'TEST tax-only transfer contains no proven positive PSP expense','[{"account_id":"e364a000-0000-4000-8000-000000000003","direction":"DEBIT","amount_minor":1},{"account_id":"e364a000-0000-4000-8000-000000000004","direction":"CREDIT","amount_minor":1}]')));
select throws_ok($$select public.propose_credit_economic_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v#>>'{}')::uuid from p275 where k='zero-expense-journal'),'TEST zero expense in unrelated transfer is not an exemption proof','TEST364-zero-not-evidence')$$,'55000','CREDIT_ECONOMIC_PROVEN_NET_EXPENSE_REQUIRED','lack of an expense entry does not prove a real zero cost');
insert into p275 values('foreign-expense-journal',to_jsonb(public.post_financial_journal('b2750000-0000-4000-8000-000000000004','TEST364-foreign-expense-journal',null,'CREDIT_PSP_FEE','EUR',clock_timestamp(),'TEST foreign tenant cost cannot be charged to this capture','[{"account_id":"e364d000-0000-4000-8000-000000000001","direction":"DEBIT","amount_minor":100},{"account_id":"e364d000-0000-4000-8000-000000000002","direction":"CREDIT","amount_minor":100}]')));
select throws_ok($$select public.propose_credit_economic_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v#>>'{}')::uuid from p275 where k='foreign-expense-journal'),'TEST foreign expense must not become this funding cost','TEST364-foreign-journal')$$,'55000','CREDIT_ECONOMIC_EXPENSE_JOURNAL_REQUIRED','a posted cost in another tenant cannot be attributed to this capture');
reset role;
select is((select count(*)from public.credit_economic_cost_reconciliations_v1),2::bigint,'false zero and foreign journal proposals create no accepted cost evidence');

-- Trusted verified-inbox notification is known before domain dispatch. It
-- already blocks economic readiness, without inventing or erasing any amount.
select pg_temp.service275();set local role service_role;
insert into p275 values('pending-adverse',public.record_verified_payment_inbox_v1('DEMO','DEMO','TEST364-PENDING-DISPUTE','DISPUTE_OPENED','SYNTHETIC-CREDIT275-CAPTURE',jsonb_build_object('provider_payment_id','SYNTHETIC-CREDIT275-CAPTURE','provider_adjustment_id','TEST364-PENDING-NATIVE-DISPUTE','merchant_reference',(select v->>'payment_intent_id'from p275 where k='intent'),'amount_minor','10001','currency','EUR','occurred_at',clock_timestamp()::text),repeat('a',64),repeat('b',64),'e364f000-0000-4000-8000-000000000001'));
reset role;
select is((select count(*)from public.credit_pack_payment_adjustments_v1),0::bigint,'the adverse event is deliberately not yet imported into the pack domain');
set local role authenticated;select pg_temp.actor275(3);
select is(public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)->>'ready','false','a known verified adverse fact blocks readiness before domain adjustment import');
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST pending adverse facts require actual reconciliation','TEST364-reconcile-after-adverse')$$,'55000','CREDIT_ECONOMIC_ADMISSIBLE_ALLOCATION_REQUIRED','a new reconciliation cannot acknowledge held funding');
reset role;
select is((select count(*)from public.credit_economic_cost_attributions_v1),2::bigint,'adverse fact creates no duplicate, reversal or overwrite of cost evidence');

-- Native historical boundary: this mandate was really accepted today. Neither
-- an earlier proposed start nor a generic journal creates prior acquired rights.
-- No initial historical income, closure, allocation or balance is injected.
set local role authenticated;select pg_temp.actor275(3);
select throws_ok($$select public.close_franchise_profit_period((select(v->>'book_id')::uuid from p275 where k='book'),'2026-10-01','2026-10-31',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and version=1),clock_timestamp(),'TEST today accepted mandate cannot authorize an invented October closure','TEST364-no-antedated-mandate-close')$$,'55000','FRANCHISE_HISTORICAL_BOOK_BASIS_RECONCILIATION_REQUIRED','a genuine current activation never substitutes for missing historical source evidence');
reset role;
select is((select count(*)from public.franchise_profit_closure_versions where book_id=(select(v->>'book_id')::uuid from p275 where k='book')),0::bigint,'neither an unelapsed current period nor an uncovered historical period creates a closure');
select is((select count(*)from public.franchise_distribution_ledger_entries where book_id=(select(v->>'book_id')::uuid from p275 where k='book')),0::bigint,'the native fixture invents no accrued profit, balance or payout');
select ok(not exists(select 1 from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p275 where k='book')and source_type<>'CREDIT_ECONOMIC_ALLOCATION_V1'and effect_type='REVENUE'),'all recognized income still has the canonical native allocation source');
select ok(not exists(select 1 from public.financial_entries entry join public.financial_journals journal on journal.id=entry.journal_id where journal.organization_id='b2750000-0000-4000-8000-000000000001'group by entry.journal_id having sum(case entry.direction when'DEBIT'then entry.amount_minor else-entry.amount_minor end)<>0),'all native TEST journals remain exactly balanced');
set constraints all immediate;
select*from finish();
rollback;
