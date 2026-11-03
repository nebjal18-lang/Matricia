begin;
set local search_path=public,extensions;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='NON_CONTRACTUAL_SQL_CREDIT_275',configured_at=clock_timestamp()where singleton;
-- TEST ONLY current native funding/receipt plus private zero-cost evidence.
-- No trigger, role, clock or financial guard is bypassed. This SQL fixture
-- supplies storage metadata and trusted TEST scan callbacks, not production AV.
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
insert into p275 values('book',public.open_franchise_pnl_book_for_mandate_v1((select(v->>'franchise_id')::uuid from p275 where k='franchise'),(select(v->>'mandate_version_id')::uuid from p275 where k='franchise'),(select content_hash from public.franchise_mandate_versions where id=(select(v->>'mandate_version_id')::uuid from p275 where k='franchise')),'EUR',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and status='ACTIVE'order by version desc limit 1),'credit275-book'));
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
set local role authenticated;select pg_temp.actor275(3);
select is((select count(*)from jsonb_array_elements(public.list_finance_cost_reconciliation_targets_v1('fr')->'targets')target where(target->>'id'=(select v#>>'{}'from p275 where k='funding')and target->>'component'='PSP_FEE')or(target->>'id'=(select v->>'redemption_id'from p275 where k='reserve')and target->>'component'='FULFILLMENT_COST')),2::bigint,'Finance selects actual capture and actual received-service targets without entering a UUID');
select is(public.list_finance_cost_reconciliation_targets_v1('fr')->>'canUpload','true','independent Finance AAL2 has a strict actual upload capability');
select ok((select bool_and(target->>'label'like'%استشارة اختبار فقط%')from jsonb_array_elements(public.list_finance_cost_reconciliation_targets_v1('ar',1,'استشارة اختبار فقط')->'targets')target where target->>'component'='FULFILLMENT_COST'),'Arabic selection uses the real approved Arabic benefit label');
select is(public.list_finance_cost_reconciliation_targets_v1('fr',1,'ABSENT_FINANCE_TARGET_TEST_370')->'targets','[]'::jsonb,'a successful unmatched search returns a genuine empty target page');
select is(public.list_finance_cost_reconciliation_targets_v1('fr',1,'ABSENT_FINANCE_TARGET_TEST_370')->>'has_more','false','target pagination does not imply unseen matches for an empty search');
select pg_temp.actor275(5);
select is(public.list_finance_cost_reconciliation_targets_v1('fr')->>'canUpload','false','Finance plus read-only Auditor remains unable to upload evidence');
select pg_temp.actor275(4);
select throws_ok($$select public.list_finance_cost_reconciliation_targets_v1('fr')$$,'42501','FINANCE_COST_DOCUMENT_READ_DENIED','Client cannot enumerate Finance targets');
select pg_temp.actor275(3,null);
select throws_ok($$select public.list_finance_cost_reconciliation_targets_v1('fr')$$,'42501','FINANCE_COST_MFA_REQUIRED','known Finance with null assurance receives MFA instead of an empty page');
reset role;
create temporary table proof370(k text primary key,v jsonb);grant select,insert on proof370 to authenticated,service_role;
insert into proof370 values('bytes',jsonb_build_object('sha256',encode(extensions.digest(convert_to(E'%PDF-1.4\nTEST ZERO COST STATEMENT\n%%EOF\n','UTF8'),'sha256'),'hex'),'size_bytes',octet_length(E'%PDF-1.4\nTEST ZERO COST STATEMENT\n%%EOF\n')));
insert into proof370 values('journal-count',to_jsonb((select count(*)from public.financial_journals)));
set local role authenticated;select pg_temp.actor275(2);
insert into proof370 values('PSP_FEE',public.reserve_finance_cost_document_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),'TEST370-frais-nuls.pdf','application/pdf',(select(v->>'size_bytes')::integer from proof370 where k='bytes'),(select v->>'sha256'from proof370 where k='bytes'),'e3700000-0000-4000-8000-000000000001'));
insert into proof370 values('FULFILLMENT_COST',public.reserve_finance_cost_document_v1('FULFILLMENT_COST',(select(v->>'redemption_id')::uuid from p275 where k='reserve'),'TEST370-realisation-gratuite.pdf','application/pdf',(select(v->>'size_bytes')::integer from proof370 where k='bytes'),(select v->>'sha256'from proof370 where k='bytes'),'e3700000-0000-4000-8000-000000000002'));
select is(public.reserve_finance_cost_document_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),'TEST370-frais-nuls.pdf','application/pdf',(select(v->>'size_bytes')::integer from proof370 where k='bytes'),(select v->>'sha256'from proof370 where k='bytes'),'e3700000-0000-4000-8000-000000000001'),(select v from proof370 where k='PSP_FEE'),'same file/target reservation survives a response loss without a second path');
select throws_ok($$select public.reserve_finance_cost_document_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),'changed.pdf','application/pdf',(select(v->>'size_bytes')::integer from proof370 where k='bytes'),(select v->>'sha256'from proof370 where k='bytes'),'e3700000-0000-4000-8000-000000000001')$$,'22000','FINANCE_COST_DOCUMENT_REPLAY_MISMATCH','same key cannot change its frozen file');
select throws_ok($$select public.authorize_finance_cost_document_read_v1((select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE'))$$,'55000','FINANCE_COST_DOCUMENT_NOT_CLEAN','an unscanned file cannot be read as proof');
select throws_ok($$select public.propose_credit_economic_zero_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE'),'TEST unscanned declaration is not evidence of free fees','TEST370-no-scan')$$,'55000','FINANCE_COST_CLEAN_DOCUMENT_REQUIRED','zero cannot be asserted before a trusted scan');
select set_config('request.jwt.claims','{"sub":"a2750000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select throws_ok($$select public.reserve_finance_cost_document_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),'absent-aal.pdf','application/pdf',20,repeat('a',64),'e3700000-0000-4000-8000-000000000003')$$,'42501','FINANCE_COST_MFA_REQUIRED','known Finance without aal cannot reserve financial evidence');
select pg_temp.actor275(2,null);
select throws_ok($$select public.reserve_finance_cost_document_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),'null-aal.pdf','application/pdf',20,repeat('a',64),'e3700000-0000-4000-8000-000000000003')$$,'42501','FINANCE_COST_MFA_REQUIRED','known Finance with null aal cannot reserve financial evidence');
select pg_temp.actor275(2);
reset role;
-- TEST storage metadata only. Real private bytes/hashes and scanner signatures
-- are separately exercised by the server/browser adapter tests.
insert into storage.objects(bucket_id,name,metadata)select 'finance-cost-proofs',v->>'path',jsonb_build_object('mimetype','application/pdf','size',(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k in('PSP_FEE','FULFILLMENT_COST');
set local role authenticated;select pg_temp.actor275(2);
select public.commit_finance_cost_document_upload_v1((v->>'upload_id')::uuid,(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k in('PSP_FEE','FULFILLMENT_COST');
select throws_ok($$select public.claim_finance_cost_document_scan_jobs_v1('e3700000-0000-4000-8000-000000000099',(select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE'))$$,'42501','permission denied for function claim_finance_cost_document_scan_jobs_v1','a Finance user cannot obtain the scanner EXECUTE privilege');
reset role;select pg_temp.service275();set local role service_role;
insert into proof370 select'claim-'||k,(public.claim_finance_cost_document_scan_jobs_v1('e3700000-0000-4000-8000-000000000099',(v->>'upload_id')::uuid)->0)from proof370 where k in('PSP_FEE','FULFILLMENT_COST');
select is(public.claim_finance_cost_document_scan_jobs_v1('e3700000-0000-4000-8000-000000000098',(select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE')),'[]'::jsonb,'a competing worker cannot claim an active lease');
select throws_ok($$select public.complete_finance_cost_document_scan_v1((select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE'),'e3700000-0000-4000-8000-000000000099','e3700000-0000-4000-8000-000000000097',(select(v->>'row_version')::integer from proof370 where k='claim-PSP_FEE'),'CLEAN',(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'),'SQL_TEST_SCANNER','test-only')$$,'40001','FINANCE_COST_SCAN_LEASE_STALE','wrong lease cannot mark financial evidence clean');
select throws_ok($$select public.complete_finance_cost_document_scan_v1((v->>'upload_id')::uuid,'e3700000-0000-4000-8000-000000000099',(v->>'lease_token')::uuid,(v->>'row_version')::integer,'CLEAN',null,null,'SQL_TEST_SCANNER','test-only')from proof370 where k='claim-PSP_FEE'$$,'22023','INVALID_FINANCE_COST_SCAN_RESULT','missing computed byte identity cannot become CLEAN');
select public.complete_finance_cost_document_scan_v1((v->>'upload_id')::uuid,'e3700000-0000-4000-8000-000000000099',(v->>'lease_token')::uuid,(v->>'row_version')::integer,'CLEAN',(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'),'SQL_TEST_SCANNER','test-only')from proof370 where k like'claim-%';
reset role;set local role authenticated;select pg_temp.actor275(2);
select is((select count(*)from storage.objects where bucket_id='finance-cost-proofs'),0::bigint,'even CLEAN files have no direct unaudited authenticated Storage SELECT');
insert into proof370 values('proposal-PSP_FEE',public.propose_credit_economic_zero_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE'),'TEST ONLY PSP statement explicitly proves no fees on this exact capture','TEST370-zero-PSP'));
insert into proof370 values('proposal-FULFILLMENT_COST',public.propose_credit_economic_zero_cost_v1('FULFILLMENT_COST',(select(v->>'redemption_id')::uuid from p275 where k='reserve'),(select(v->>'upload_id')::uuid from proof370 where k='FULFILLMENT_COST'),'TEST ONLY supplied document proves free performance of this exact accepted service','TEST370-zero-FULL'));
select throws_ok($$select public.decide_credit_economic_cost_v1((v->>'proposal_id')::uuid,v->>'source_hash',true,'TEST document author cannot independently approve this evidence')from proof370 where k='proposal-PSP_FEE'$$,'42501','CREDIT_ECONOMIC_INDEPENDENT_FINANCE_REQUIRED','document/proposal author cannot self-certify zero');
select pg_temp.actor275(3);
select throws_ok($$select public.decide_credit_economic_cost_v1((v->>'proposal_id')::uuid,v->>'source_hash',true,'TEST approver must retrieve and inspect the actual private file')from proof370 where k='proposal-PSP_FEE'$$,'55000','FINANCE_COST_DOCUMENT_REVIEW_READ_REQUIRED','even independent Finance cannot approve without verified document retrieval');
insert into proof370 select'read-'||k,public.authorize_finance_cost_document_read_v1((v->>'upload_id')::uuid)from proof370 where k in('PSP_FEE','FULFILLMENT_COST');
select throws_ok($$select public.record_finance_cost_document_read_v1((select(v->>'read_capability_id')::uuid from proof370 where k='read-PSP_FEE'),(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'))$$,'42501','permission denied for function record_finance_cost_document_read_v1','browser lacks EXECUTE permission for verified download receipts');
reset role;select pg_temp.service275();set local role service_role;
select public.record_finance_cost_document_read_v1((v->>'read_capability_id')::uuid,(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k like'read-%';
reset role;set local role authenticated;select pg_temp.actor275(3);
insert into proof370 select'approved-'||k,public.decide_credit_economic_cost_v1((v->>'proposal_id')::uuid,v->>'source_hash',true,'TEST ONLY independent Finance reviewed this actual scoped private document')from proof370 where k like'proposal-%';
select is((select public.decide_credit_economic_cost_v1((v->>'proposal_id')::uuid,v->>'source_hash',true,'TEST immutable approval replay')from proof370 where k='proposal-PSP_FEE'),(select v from proof370 where k='approved-proposal-PSP_FEE'),'same zero-evidence approval has an exact immutable replay');
select throws_ok($$select public.decide_credit_economic_cost_v1((v->>'proposal_id')::uuid,v->>'source_hash',false,'TEST contradictory zero decision is denied')from proof370 where k='proposal-PSP_FEE'$$,'22000','DECISION_ALREADY_RECORDED','opposite zero-evidence approval cannot overwrite history');
select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST ONLY real zero evidence for both explicit cost components','TEST370-zero-reconcile');
select is(public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)->>'ready','true','two independently proved real zero costs make the current source ready');
select is(public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)#>>'{allocations,0,psp_fee_minor}','0','proved zero is distinct from unavailable cost');
select is(public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)#>>'{allocations,0,fulfillment_cost_minor}','0','fulfillment zero is a separate proved component');
reset role;
select is((select count(*)from public.financial_journals),(select(v#>>'{}')::bigint from proof370 where k='journal-count'),'zero evidence creates no zero journal, cash entry or balance');
select is((select count(*)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p275 where k='book')and effect_type='COST'),0::bigint,'document-proved zero uses immutable analytical facts, never fake money entries');
select is((select count(*)from public.credit_economic_cost_attributions_v1),2::bigint,'both zero evidence components have an actual attribution record');
set local role authenticated;select pg_temp.actor275(2);
select throws_ok($$select public.revoke_finance_cost_document_v1((select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE'),'TEST uploader cannot independently revoke the admitted evidence')$$,'42501','FINANCE_COST_INDEPENDENT_REVIEW_REQUIRED','document author cannot act as independent evidence reviewer');
select pg_temp.actor275(3);
select public.revoke_finance_cost_document_v1((select(v->>'upload_id')::uuid from proof370 where k='PSP_FEE'),'TEST independent review found the statement no longer admissible');
select is(public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)->>'ready','false','revoked evidence immediately blocks new financial readiness');
select throws_ok($$select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST revoked proof cannot be acknowledged as current zero','TEST370-revoked-reconcile')$$,'55000','FINANCE_COST_DOCUMENT_REVOKED','revocation blocks a new reconciliation without rewriting old amounts');
reset role;
select is((select count(*)from public.credit_economic_cost_reconciliations_v1),2::bigint,'revocation preserves both historical accepted evidence records');
select is((select count(*)from public.credit_economic_cost_attributions_v1),2::bigint,'revocation never deletes or reverses the former zero evidence');
-- A revoked zero proof can be replaced through a new real immutable file,
-- scan, retrieval and independent review. No accepted row is edited or deleted.
set local role authenticated;select pg_temp.actor275(2);
insert into proof370 values('replacement',public.reserve_finance_cost_document_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),'TEST370-frais-nuls-correction.pdf','application/pdf',(select(v->>'size_bytes')::integer from proof370 where k='bytes'),(select v->>'sha256'from proof370 where k='bytes'),'e3700000-0000-4000-8000-000000000004'));
reset role;
insert into storage.objects(bucket_id,name,metadata)select 'finance-cost-proofs',v->>'path',jsonb_build_object('mimetype','application/pdf','size',(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k='replacement';
set local role authenticated;select pg_temp.actor275(2);
select public.commit_finance_cost_document_upload_v1((v->>'upload_id')::uuid,(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k='replacement';
reset role;select pg_temp.service275();set local role service_role;
insert into proof370 select'claim-replacement',public.claim_finance_cost_document_scan_jobs_v1('e3700000-0000-4000-8000-000000000099',(v->>'upload_id')::uuid)->0 from proof370 where k='replacement';
select public.complete_finance_cost_document_scan_v1((v->>'upload_id')::uuid,'e3700000-0000-4000-8000-000000000099',(v->>'lease_token')::uuid,(v->>'row_version')::integer,'CLEAN',(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'),'SQL_TEST_SCANNER','test-only')from proof370 where k='claim-replacement';
reset role;set local role authenticated;select pg_temp.actor275(2);
insert into proof370 values('replacement-proposal',public.propose_credit_economic_zero_cost_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),(select(v->>'upload_id')::uuid from proof370 where k='replacement'),'TEST ONLY corrected statement independently replaces revoked historical evidence','TEST370-replacement-proposal'));
select pg_temp.actor275(3);
insert into proof370 values('read-replacement',public.authorize_finance_cost_document_read_v1((select(v->>'upload_id')::uuid from proof370 where k='replacement')));
reset role;select pg_temp.service275();set local role service_role;
select public.record_finance_cost_document_read_v1((v->>'read_capability_id')::uuid,(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k='read-replacement';
reset role;set local role authenticated;select pg_temp.actor275(3);
select public.decide_credit_economic_cost_v1((v->>'proposal_id')::uuid,v->>'source_hash',true,'TEST ONLY new independent review of corrected real private evidence')from proof370 where k='replacement-proposal';
select public.reconcile_credit_economic_profit_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date,'TEST ONLY append the replacement zero evidence version','TEST370-replacement-reconcile');
select is(public.get_credit_economic_profit_context_v1((select(v->>'book_id')::uuid from p275 where k='book'),current_date,current_date)->>'ready','true','a fully re-reviewed replacement restores real financial readiness');
reset role;
select is((select count(*)from public.credit_economic_cost_reconciliations_v1),3::bigint,'replacement appends a third accepted source and retains both former sources');
select is((select count(*)from public.credit_economic_cost_attributions_v1),3::bigint,'replacement appends the next PSP evidence version without duplicating fulfillment');
select is((select count(*)from public.financial_journals),(select(v#>>'{}')::bigint from proof370 where k='journal-count'),'replacement evidence still creates no fictitious zero journal or money entry');
-- Native scanner failure and durable reload capability. The server describes
-- the same creator/state/lease/assurance prerequisites as its retry command.
set local role authenticated;select pg_temp.actor275(2);
insert into proof370 values('retry-file',public.reserve_finance_cost_document_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'),'TEST370-retry-scanner.pdf','application/pdf',(select(v->>'size_bytes')::integer from proof370 where k='bytes'),(select v->>'sha256'from proof370 where k='bytes'),'e3700000-0000-4000-8000-000000000005'));
reset role;
insert into storage.objects(bucket_id,name,metadata)select 'finance-cost-proofs',v->>'path',jsonb_build_object('mimetype','application/pdf','size',(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k='retry-file';
set local role authenticated;select pg_temp.actor275(2);
select public.commit_finance_cost_document_upload_v1((v->>'upload_id')::uuid,(select v->>'sha256'from proof370 where k='bytes'),(select(v->>'size_bytes')::integer from proof370 where k='bytes'))from proof370 where k='retry-file';
reset role;select pg_temp.service275();set local role service_role;
insert into proof370 values('retry-lease',public.claim_finance_cost_document_scan_jobs_v1('e3700000-0000-4000-8000-000000000099',(select(v->>'upload_id')::uuid from proof370 where k='retry-file'))->0);
reset role;set local role authenticated;select pg_temp.actor275(2);
select is((select document->>'can_retry'from jsonb_array_elements(public.get_finance_cost_documents_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'))->'documents')document where document->>'upload_id'=(select v->>'upload_id'from proof370 where k='retry-file')),'false','an active scanner lease disables retry after a durable reload');
select throws_ok($$select public.retry_finance_cost_document_scan_v1((select(v->>'upload_id')::uuid from proof370 where k='retry-file'),'TEST370 actual busy lease still owns scanning')$$,'55P03','FINANCE_COST_SCAN_BUSY','the actual retry command preserves the same active-lease restriction');
reset role;select pg_temp.service275();set local role service_role;
select public.complete_finance_cost_document_scan_v1((v->>'upload_id')::uuid,'e3700000-0000-4000-8000-000000000099',(v->>'lease_token')::uuid,(v->>'row_version')::integer,'ERROR',null,null,'SQL_TEST_SCANNER','test-only')from proof370 where k='retry-lease';
reset role;set local role authenticated;select pg_temp.actor275(2);
select is((select document->>'can_retry'from jsonb_array_elements(public.get_finance_cost_documents_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'))->'documents')document where document->>'upload_id'=(select v->>'upload_id'from proof370 where k='retry-file')),'true','an uploaded ERROR exposes a trusted retry capability to its actual creator');
select pg_temp.actor275(3);
select is((select document->>'can_retry'from jsonb_array_elements(public.get_finance_cost_documents_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'))->'documents')document where document->>'upload_id'=(select v->>'upload_id'from proof370 where k='retry-file')),'false','another Finance actor cannot inherit the uploader retry action');
select throws_ok($$select public.retry_finance_cost_document_scan_v1((select(v->>'upload_id')::uuid from proof370 where k='retry-file'),'TEST370 another Finance actor is not the uploader')$$,'22023','INVALID_FINANCE_COST_SCAN_RETRY','the server retains its exact creator restriction');
select pg_temp.actor275(5,null);
select throws_ok($$select public.retry_finance_cost_document_scan_v1((select(v->>'upload_id')::uuid from proof370 where k='retry-file'),'TEST370 auditor write remains denied before MFA classification')$$,'42501','FINANCE_COST_DOCUMENT_WRITE_DENIED','Finance plus read-only Auditor never gains a financial write while configuring MFA');
select pg_temp.actor275(2);
select is(public.retry_finance_cost_document_scan_v1((select(v->>'upload_id')::uuid from proof370 where k='retry-file'),'TEST370 uploader explicitly retries the genuine scanner outage')->>'scan_status','PENDING','authorized manual retry schedules a real scan rather than declaring the document clean');
reset role;
select ok(not has_function_privilege('authenticated','private.finance_cost_role_identity_v1(boolean)','EXECUTE')and not has_function_privilege('authenticated','private.finance_cost_scan_retry_allowed_v1(uuid)','EXECUTE'),'classification and retry helpers create no direct browser permission');
set local role authenticated;select pg_temp.actor275(4);
select throws_ok($$select public.get_finance_cost_documents_v1('PSP_FEE',(select(v#>>'{}')::uuid from p275 where k='funding'))$$,'42501','FINANCE_COST_DOCUMENT_READ_DENIED','foreign Client cannot inspect the financial proof vault');
select throws_ok($$select public.authorize_finance_cost_document_read_v1((select(v->>'upload_id')::uuid from proof370 where k='FULFILLMENT_COST'))$$,'42501','FINANCE_COST_DOCUMENT_READ_DENIED','foreign Client cannot download even a known clean proof');
reset role;
set constraints all immediate;
select*from finish();
rollback;
