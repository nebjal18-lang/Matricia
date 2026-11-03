begin;
set local search_path=public,extensions;
select no_plan();
-- Extends native DEMO payment/receipt/allocation fixtures without disabling triggers.
-- Synthetic test identities and explicit TEST fiscal policies are not production evidence.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='NON_CONTRACTUAL_SQL_CREDIT_332',configured_at=clock_timestamp()where singleton;
-- SQL authorization/accounting contracts with declared synthetic identities and
-- the native DEMO payment constructor. No PSP signature or physical bytes are
-- certified by this fixture; API verification is tested by the payment owner.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3320000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','credit332-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)n;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3320000-0000-4000-8000-000000000001','Credit 332 SARL','Credit 332 SARL','ACTIVE','a3320000-0000-4000-8000-000000000001'),
('b3320000-0000-4000-8000-000000000004','Other332 SARL','Other332 SARL','ACTIVE','a3320000-0000-4000-8000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','a3320000-0000-4000-8000-000000000001','ACTIVE',now()),
('c3320000-0000-4000-8000-000000000004','b3320000-0000-4000-8000-000000000004','a3320000-0000-4000-8000-000000000004','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c3320000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c3320000-0000-4000-8000-000000000004','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a3320000-0000-4000-8000-000000000002','FINANCE_MANAGER'),('a3320000-0000-4000-8000-000000000003','FINANCE_MANAGER'),('a3320000-0000-4000-8000-000000000005','FINANCE_MANAGER'),('a3320000-0000-4000-8000-000000000005','READ_ONLY_AUDITOR');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b3320000-0000-4000-8000-000000000001','ICE','997332000000001','VERIFIED'),('b3320000-0000-4000-8000-000000000001','IF','99733201','VERIFIED'),('b3320000-0000-4000-8000-000000000001','RC','TEST332','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.

insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','VERIFIED',1,'a3320000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99733201","rc_number":"TEST332","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Credit 332 SARL","display_name":"Credit 332 SARL","country_code":"MA","identifiers":{"ICE":"997332000000001","IF":"99733201","RC":"TEST332"}}',1,'a3320000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001',1,now()-interval'1 day','a3320000-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f3321000-0000-0000-0000-000000000001','f3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b3320000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3320000-0000-4000-8000-000000000002',clock_timestamp(),'a3320000-0000-4000-8000-000000000001'),
('f3321000-0000-0000-0000-000000000002','f3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b3320000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3320000-0000-4000-8000-000000000002',clock_timestamp(),'a3320000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f3322000-0000-0000-0000-000000000001','f3321000-0000-0000-0000-000000000001','b3320000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3323000-0000-0000-0000-000000000001'),
('f3322000-0000-0000-0000-000000000002','f3321000-0000-0000-0000-000000000002','b3320000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3323000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f3321000-0000-0000-0000-000000000001' then 'f3322000-0000-0000-0000-000000000001'::uuid
  else 'f3322000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f3321000-0000-0000-0000-000000000001','f3321000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a3320000-0000-4000-8000-000000000002',clock_timestamp(),'a3320000-0000-4000-8000-000000000001','f3321000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a3320000-0000-4000-8000-000000000002',clock_timestamp(),'a3320000-0000-4000-8000-000000000001','f3321000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');




create temporary table p332(k text primary key,v jsonb);grant all on p332 to authenticated,service_role;
grant usage on schema extensions to authenticated,service_role;
create function pg_temp.actor332(n integer,aal text default 'aal2')returns void language plpgsql as $$declare actor uuid:=('a3320000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;begin
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal',aal)::text,true);
end$$;
create function pg_temp.service332()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;
set local role authenticated;select pg_temp.actor332(2);
insert into p332 values('pack',public.create_credit_pack_version('b3320000-0000-4000-8000-000000000001','CREDIT332_EUR','Pack de recette','حزمة الاختبار',3,10001,'EUR',365,'credit332-create-pack'));
select public.activate_credit_pack_version('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'credit332-activate-pack');
select pg_temp.actor332(1);
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'DEMO','DEMO','credit332-no-mapping')$$,'55000','APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED','checkout refuses before PSP when no approved posting mapping exists');
select pg_temp.actor332(2);
insert into p332 values('posting',public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,'{"cash_account_code":"CREDIT332_CASH_EUR","cash_name_fr":"Trésorerie de recette","cash_name_ar":"خزينة الاختبار","suspense_account_code":"CREDIT332_PENDING_EUR","suspense_name_fr":"Encaissement en attente","suspense_name_ar":"تحصيل قيد المراجعة"}','Mapping synthétique exclusivement pour recette SQL','credit332-posting-policy'));
select throws_ok($$select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p332 where k='posting'),true,(select v->>'request_hash'from p332 where k='posting'),'Tentative auto approbation interdite')$$,'42501','CREDIT_REVENUE_INDEPENDENT_REVIEW_REQUIRED','mapping maker cannot approve its own proposal');
select pg_temp.actor332(3);
select throws_ok($$select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p332 where k='posting'),true,repeat('f',64),'Revue avec empreinte périmée interdite')$$,'40001','STALE_CREDIT_REVENUE_POLICY_REQUEST','review pins the exact policy request hash');
insert into p332 values('posting-approved',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p332 where k='posting'),true,(select v->>'request_hash'from p332 where k='posting'),'Approbation indépendante de recette SQL'));
select pg_temp.actor332(1);
insert into p332 values('prep',public.prepare_credit_pack_payment_intent_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'DEMO','DEMO','credit332-checkout'));
select is((select v->>'create_authorized'from p332 where k='prep'),'true','only first preparation authorizes provider CREATE');
insert into p332 values('prep-replay',public.prepare_credit_pack_payment_intent_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'DEMO','DEMO','credit332-checkout'));
select is((select v->>'create_authorized'from p332 where k='prep-replay'),'false','same-key ambiguity never authorizes a second provider CREATE');
select is((select v->>'creation_state'from p332 where k='prep-replay'),'CREATE_REQUESTED_UNKNOWN','unregistered attempt remains explicitly unknown');
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'DEMO','DEMO','credit332-another-key')$$,'55000','CREDIT_PACK_PAYMENT_ATTEMPT_ALREADY_PENDING','another key cannot order twice while creation is ambiguous');
select pg_temp.actor332(2);
insert into p332 values('posting-revoke',public.request_credit_revenue_policy_revocation_v1((select(v->>'policy_version_id')::uuid from p332 where k='posting'),'Révocation gouvernée après préparation de la recette','credit332-revoke-posting'));
select pg_temp.actor332(3);
insert into p332 values('posting-revoked',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p332 where k='posting-revoke'),true,(select v->>'request_hash'from p332 where k='posting-revoke'),'Approbation indépendante de révocation'));
reset role;select pg_temp.service332();set local role service_role;
insert into p332 values('intent',public.register_credit_pack_payment_intent_v1((select(v->>'preparation_id')::uuid from p332 where k='prep'),'DEMO','SYNTHETIC-CREDIT332-ORDER',10001,'EUR'));
select is(public.resolve_verified_payment_kind_v1('DEMO','DEMO','SYNTHETIC-CREDIT332-ORDER',null)->>'kind','CREDIT_PACK','verified native order reference resolves the pack domain');
insert into p332 values('paid-at',to_jsonb(statement_timestamp()));
insert into p332 values('paid',public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT332-EVENT','SYNTHETIC-CREDIT332-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p332 where k='paid-at'),'SYNTHETIC-CREDIT332-CAPTURE',repeat('a',64),repeat('b',64),'f332c000-0000-4000-8000-000000000001'));
reset role;
select is((select v->>'outcome'from p332 where k='paid'),'CREDIT_PACK_CAPTURED','native DEMO capture creates the paid pack fact');
select is((select count(*)from public.credit_pack_payment_events_v1 where organization_id='b3320000-0000-4000-8000-000000000001'),1::bigint,'one immutable native capture exists');
select is((select count(*)from public.financial_journals where organization_id='b3320000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'capture posts one balanced cash/suspense journal');
select is((select currency::text from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p332 where k='paid')),'EUR','non-MAD pack retains its actual paid currency in the lot');
select is((select quantity from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p332 where k='paid')),3::bigint,'pack quantity is pinned to the frozen offer');
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p332 where k='paid')),'ELIGIBLE','captured pack is funded even while fiscal valuation is pending');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select id from public.credit_economic_funding_sources_v1 where organization_id='b3320000-0000-4000-8000-000000000001')),10001::numeric,'gross capture is retained exactly in the pending economic ledger');
select is((select count(*)from public.credit_economic_classifications_v1 c join public.credit_economic_funding_sources_v1 f on f.id=c.funding_source_id where f.organization_id='b3320000-0000-4000-8000-000000000001'),0::bigint,'missing fiscal context never invents a net revenue classification');
select is((select count(*)from public.credit_economic_allocations_v1 c join public.credit_economic_funding_sources_v1 f on f.id=c.funding_source_id where f.organization_id='b3320000-0000-4000-8000-000000000001'),0::bigint,'missing fiscal context never announces library income');

-- First capture retained its frozen approved mapping after revocation.
select is((select v->>'outcome'from p332 where k='posting-revoked'),'CREDIT_REVENUE_POLICY_REVOKED','posting policy was actually revoked before the paid callback');
select pg_temp.service332();
select is(public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT332-EVENT','SYNTHETIC-CREDIT332-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p332 where k='paid-at'),'SYNTHETIC-CREDIT332-CAPTURE',repeat('a',64),repeat('c',64),'f332c000-0000-4000-8000-000000000099')->>'replayed','true','same verified body with new transmission fingerprint replays without another cash journal');
select throws_ok($$select public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT332-EVENT','SYNTHETIC-CREDIT332-ORDER','PAYMENT_SUCCEEDED',10002,'EUR',(select(v#>>'{}')::timestamptz from p332 where k='paid-at'),'SYNTHETIC-CREDIT332-CAPTURE',repeat('a',64),repeat('c',64))$$,'23514','CREDIT_PACK_CAPTURE_CONTEXT_MISMATCH','wrong paid amount cannot mutate the captured fact');
select throws_ok($$select public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT332-EVENT','SYNTHETIC-CREDIT332-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p332 where k='paid-at'),'SYNTHETIC-CREDIT332-CAPTURE',repeat('f',64),repeat('c',64))$$,'22000','CREDIT_PACK_CAPTURE_REPLAY_MISMATCH','same provider event cannot change its verified payload');
select is((select count(*)from public.financial_journals where organization_id='b3320000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'duplicate callback creates no second journal');
select is((select count(*)from public.credit_ledger_entries where organization_id='b3320000-0000-4000-8000-000000000001'and entry_type='GRANT'),1::bigint,'duplicate callback creates no second credit grant');
select throws_ok($$select private.register_payment_provider_target_v1('SUBSCRIPTION',extensions.gen_random_uuid(),'DEMO','DEMO','INTENT','SYNTHETIC-CREDIT332-ORDER',repeat('e',64))$$,'23514','PAYMENT_PROVIDER_REFERENCE_ALREADY_BOUND','same native order cannot be routed to subscription and pack');
select pg_temp.actor332(2);
select throws_ok($$select public.issue_credits('b3320000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p332 where k='paid'),'EXTRA_PURCHASE',3,clock_timestamp()+interval'1 year',null,'manual-payment-ref',10001,'MANUAL_V1',null,'credit332-forged-extra')$$,'55000','CREDIT_PACK_CANONICAL_PAYMENT_REQUIRED','an admin free-text reference cannot fabricate paid credits');
select pg_temp.actor332(1);
insert into p332 values('paid-replay',public.prepare_credit_pack_payment_intent_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'DEMO','DEMO','credit332-checkout'));
select is((select v->>'create_authorized'from p332 where k='paid-replay'),'false','paid preparation replay never authorizes another provider order');
select is((select v->'capture_result'->>'outcome'from p332 where k='paid-replay'),'CREDIT_PACK_CAPTURED','paid preparation replay returns its exact canonical capture');
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'DEMO','DEMO','credit332-after-revocation')$$,'55000','APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED','revoked mapping blocks a new order before external money calls');
select pg_temp.actor332(4);
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),'DEMO','DEMO','credit332-cross-tenant')$$,'42501','CREDIT_PACK_CHECKOUT_DENIED','sibling organization cannot initiate another tenant purchase');
set local role authenticated;
select is((select count(*)from public.credit_pack_payment_events_v1 where organization_id='b3320000-0000-4000-8000-000000000001'),0::bigint,'sibling tenant cannot read the native payment capture');
reset role;
select pg_temp.actor332(5);
select throws_ok($$select public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),null,'EUR','DEVELOPMENT',2,current_date,null,'{}','Auditeur ne peut configurer le paiement','credit332-auditor-policy')$$,'42501','CREDIT_REVENUE_POLICY_CREATE_DENIED','combined read-only auditor remains unable to mutate finance policy');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p332 where k='paid')),'ENVIRONMENT_INCOMPATIBLE','DEMO capture cannot fund credits after retag to production');
select is((select provider_environment from public.credit_pack_payment_events_v1 where id=(select(v->>'payment_event_id')::uuid from p332 where k='paid')),'DEMO','retag never rewrites immutable payment provenance');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select ok(not has_function_privilege('authenticated','private.post_verified_payment_suspense_v1(uuid,uuid,text,text,bigint,character,timestamp with time zone,uuid,uuid)','EXECUTE'),'browser cannot post a journal through the private payment constructor');
select ok(not has_function_privilege('authenticated','public.process_verified_credit_pack_payment_v1(text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)','EXECUTE'),'browser cannot impersonate the verified callback');
select throws_ok($$update public.credit_pack_payment_events_v1 set amount_minor=1 where organization_id='b3320000-0000-4000-8000-000000000001'$$,'55000','IMMUTABLE_RECORD','captured payment cannot be rewritten');
-- Explicit synthetic fiscal configuration, approved through the real commands.
insert into p332 select'funding',to_jsonb(id)from public.credit_economic_funding_sources_v1 where organization_id='b3320000-0000-4000-8000-000000000001';
set local role authenticated;select pg_temp.actor332(1);
select throws_ok($$select public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p332 where k='funding'))$$,'42501','CREDIT_ECONOMIC_RECONCILIATION_DENIED','client cannot classify its own captured money');
select pg_temp.actor332(2);
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p332 where k='funding'))->>'status','PENDING_FISCAL_REVIEW','captured gross never becomes revenue without an approved fiscal context');
insert into p332 values('billing',public.create_client_billing_policy_v1(jsonb_build_object('series_key','SQL332_FISCAL','version',1,'currency','EUR','tax_rate_bps',2000,'tax_label_fr','Taxe synthétique de recette','tax_label_ar','ضريبة اختبار','jurisdiction','TEST_ONLY','issuer',jsonb_build_object('legal_name','SQL Test Issuer','legal_form','TEST','address','Synthetic SQL fixture address','ice','997332000000002','if_number','99733202','rc_number','SQL332','contact_email','fiscal332@example.invalid'),'invoice_prefix','SQL332I','credit_prefix','SQL332C','invoice_start_number','1','credit_start_number','1','valid_from',(current_date-2)::text,'service_label_fr','Produit de recette uniquement','service_label_ar','منتج اختبار فقط','approval_reference','SYNTHETIC_SQL_NOT_REAL_FISCAL_POLICY'),'credit332-billing-policy'));
select pg_temp.actor332(3);
select public.approve_client_billing_policy_v1((select(v->>'policy_id')::uuid from p332 where k='billing'),true,'Approbation fiscale indépendante de recette','credit332-approve-billing');
select pg_temp.actor332(2);
insert into p332 values('fiscal',public.create_credit_revenue_policy_v1('FISCAL','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 jsonb_build_object('billing_policy_version_id',(select v->>'policy_id'from p332 where k='billing'),'recognition_accounts',jsonb_build_object('core',jsonb_build_object('code','SQL332_CORE_EUR','name_fr','Core de recette','name_ar','إيراد أساسي للاختبار'),'benefit_pool',jsonb_build_object('code','SQL332_POOL_EUR','name_fr','Pool de recette','name_ar','مجمع اختبار'),'unallocated',jsonb_build_object('code','SQL332_UNALLOC_EUR','name_fr','Crédits achetés non affectés','name_ar','أرصدة مشتراة غير مخصصة'),'tax',jsonb_build_object('code','SQL332_TAX_EUR','name_fr','Taxe de recette due','name_ar','ضريبة اختبار مستحقة'))),'Contexte fiscal de recette explicitement approuvé','credit332-fiscal-context'));
select pg_temp.actor332(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p332 where k='fiscal'),true,(select v->>'request_hash'from p332 where k='fiscal'),'Revue indépendante contexte fiscal de recette');
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p332 where k='funding'))->>'status','PENDING_ALLOCATION_POLICY','approved fiscal context does not invent an allocation policy');
select pg_temp.actor332(2);
insert into p332 values('allocation',public.create_credit_revenue_policy_v1('ALLOCATION','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p332 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 '{"purchase_rounding":"CUMULATIVE_FLOOR_REMAINDER","accepted_evidence_kinds":["OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT"],"fulfillment_modes":["MATRICIA_INTERNAL"]}',
 'Politique allocation de recette sans règle de production','credit332-allocation-policy'));
select pg_temp.actor332(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p332 where k='allocation'),true,(select v->>'request_hash'from p332 where k='allocation'),'Revue indépendante allocation de recette');
insert into p332 values('classified',public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p332 where k='funding')));
select is((select v->>'status'from p332 where k='classified'),'READY','governed fiscal and allocation policies classify the verified purchase');
select is((select v->>'net_minor'from p332 where k='classified'),'8334','gross-to-net derives only from the approved synthetic tax context');
select is((select v->>'tax_minor'from p332 where k='classified'),'1667','half-up tax remainder conserves the paid gross exactly');
reset role;
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),8334::numeric,'net purchased value waits for actual library consumption');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')and revenue_class='CAPTURE_GROSS_PENDING'),0::numeric,'classification clears the gross waiting economic balance');
select is((select count(*)from public.franchise_pnl_entries where financial_journal_id=(select financial_journal_id from public.credit_economic_funding_sources_v1 where id=(select(v#>>'{}')::uuid from p332 where k='funding'))),0::bigint,'unconsumed purchased value is not franchise profit');
select is((select count(*)from public.financial_journals where organization_id='b3320000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'fiscal recognition never posts a second cash journal');
select is((select sum(case direction when'DEBIT'then amount_minor else-amount_minor end)from public.financial_entries where journal_id=(select(v->>'classification_journal_id')::uuid from p332 where k='classified')),0::numeric,'recognition journal balances liability to revenue and tax without cash');
select pg_temp.actor332(3);set local role authenticated;
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p332 where k='funding'))->>'replayed','true','classification retry reuses the immutable source');
reset role;
select is((select count(*)from public.credit_economic_classifications_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')),1::bigint,'classification is appended once');
-- Actual builder/onboarding commands create a clearly labelled DEV franchise,
-- and real benefit operations/independent receipt consume the purchased lot.
insert into public.platform_user_roles(user_id,role_code)values('a3320000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),('a3320000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e3320000-0000-4000-8000-000000000001','SQL332_LIBRARY','sql332-library','b3320000-0000-4000-8000-000000000001','DRAFT','a3320000-0000-4000-8000-000000000002');
set local role authenticated;select pg_temp.actor332(2);
insert into p332 values('franchise',public.propose_franchise_governance('e3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','FRANCHISEE','SQL332','Territoire TEST uniquement','نطاق اختبار فقط','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{}','credit332-1@example.invalid',repeat('7',64),'fr-MA','{}','Franchise de recette non contractuelle uniquement','credit332-franchise-propose'));
select pg_temp.actor332(3);
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from p332 where k='franchise'),'APPROVE','Approbation indépendante simulation de recette',1,'credit332-franchise-approve');
select pg_temp.actor332(1);
insert into p332 values('franchise-demo',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from p332 where k='franchise'),repeat('7',64),1,(select(v->>'mandate_version_id')::uuid from p332 where k='franchise'),public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from p332 where k='franchise'))->>'mandateHash',true,'credit332-franchise-simulation'));
select is((select v->>'activationMode'from p332 where k='franchise-demo'),'NON_CONTRACTUAL_DEMO','allocation fixture never claims a legally signed real franchise');
select pg_temp.actor332(2);
insert into p332 values('book',public.open_franchise_pnl_book('e3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','EUR',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and status='ACTIVE'order by version desc limit 1),'credit332-book'));
insert into p332 values('benefit',public.create_benefit_version('b3320000-0000-4000-8000-000000000001','CREDIT332_BENEFIT','CONSULTATION','MATRICIA_INTERNAL','Consultation SQL uniquement','استشارة اختبار فقط','Prestation synthétique du contrat SQL','خدمة تجريبية لاختبار SQL',1,1000,0,'EUR','e3320000-0000-4000-8000-000000000001',null,null,'{}','{}','SQL332_CANCELLATION',clock_timestamp()-interval'1 minute','credit332-benefit-create'));
select pg_temp.actor332(3);
select public.activate_benefit_version('b3320000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),'credit332-benefit-activate');
-- Admission is independently governed too (Provider268060).
select pg_temp.actor332(2);
insert into p332 values('admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p332 where k='benefit')));
insert into p332 values('admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),(select v->>'source_hash'from p332 where k='admission-context'),(select(v->>'head_id')::uuid from p332 where k='admission-context'),'NONE',null,null,'{}','{}',now()-interval'1 minute',null,'Politique admission synthétique explicitement revue','SQL332_ADMISSION_TEST_ONLY','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','f332a000-0000-4000-8000-000000000001'));
select pg_temp.actor332(3);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p332 where k='admission-policy'),(select v->>'content_hash'from p332 where k='admission-policy'),true,'SQL332_INDEPENDENT_APPROVAL','Revue indépendante de la politique admission SQL');
select pg_temp.actor332(1);
insert into p332 values('reserve',public.reserve_benefit_credits('b3320000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p332 where k='paid'),(select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),1,clock_timestamp()+interval'1 day','credit332-reserve'));
select pg_temp.actor332(2);
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p332 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='reserve')),'SCHEDULE',clock_timestamp()-interval'1 second','Planification opérationnelle effective de recette','credit332-schedule');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p332 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='reserve')),'START',null,'Réalisation opérationnelle effective de recette','credit332-start');
insert into p332 values('delivery',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from p332 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='reserve')),'Compte rendu synthétique du service effectivement exécuté dans ce contrat SQL','SQL332_OPERATIONAL_REPORT',null,'credit332-delivery'));
select pg_temp.actor332(1);
insert into p332 values('receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p332 where k='delivery'),(select v->>'source_hash'from p332 where k='delivery'),(select(v->>'row_version')::bigint from p332 where k='delivery'),true,'Réception indépendante de la prestation de cette recette SQL','credit332-receipt'));
select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p332 where k='reserve'),(select v->>'receipt_hash'from p332 where k='receipt'),'credit332-consume');
reset role;
select is((select count(*)from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p332 where k='reserve')),1::bigint,'public consumption appends its real canonical movement and independent receipt');
select is((select status from public.credit_economic_processing_events_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p332 where k='reserve')order by id desc limit 1),'PENDING_MANDATE','no arbitrary first book is selected without an approved library route');
select is((select count(*)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')),0::bigint,'unreviewed route cannot create library income');
set local role authenticated;select pg_temp.actor332(2);
insert into p332 values('route',public.create_credit_revenue_policy_v1('BOOK_ROUTE','LIBRARY','e3320000-0000-4000-8000-000000000001','b3320000-0000-4000-8000-000000000001','EUR','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('book_id',(select v->>'book_id'from p332 where k='book'),'franchise_id',(select v->>'franchise_id'from p332 where k='franchise'),'mandate_version_id',(select v->>'active_mandate_version_id'from p332 where k='franchise-demo')),'Affectation explicite bibliothèque client et mandat de recette','credit332-book-route'));
select pg_temp.actor332(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p332 where k='route'),true,(select v->>'request_hash'from p332 where k='route'),'Approbation indépendante du mandat et livre exacts');
insert into p332 values('allocated',public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p332 where k='reserve')));
reset role;
select is((select sum(amount_minor)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')and allocation_kind='PURCHASE_CONSUMPTION'),2778::numeric,'one of three purchased credits attributes its exact net share to the consumed library');
select is((select sum(amount_minor)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p332 where k='book')and source_type='CREDIT_ECONOMIC_ALLOCATION_V1'),2778::numeric,'canonical library attribution reaches the real P&L without invented cash');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),5556::numeric,'unspent purchased credits retain the remaining net value');
select pg_temp.actor332(3);set local role authenticated;
select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p332 where k='reserve'));
reset role;
select is((select count(*)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')),1::bigint,'consumption reconciliation never duplicates the P&L revenue');
create function pg_temp.refund_id()returns uuid language sql as $$select(v->>'redemption_id')::uuid from p332 where k='reserve'$$;
create function pg_temp.refund_version()returns bigint language sql as $$select row_version from public.benefit_redemptions where id=pg_temp.refund_id()$$;
create function pg_temp.request_refund(key text default'refund332-request')returns jsonb language sql as $$select public.request_benefit_refund_v1('b3320000-0000-4000-8000-000000000001',pg_temp.refund_id(),pg_temp.refund_version(),'TEST consumed service dispute requiring independent Finance',key)$$;
-- The Client cannot manufacture a policy or invent a credit extension.
set local role authenticated;select pg_temp.actor332(1);
select throws_ok($$select pg_temp.request_refund()$$,'55000','APPROVED_BENEFIT_REFUND_POLICY_REQUIRED','no default commercial refund policy is invented');
select throws_ok($$select public.propose_benefit_refund_policy_v1((select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),86400,'PRESERVE_ORIGINAL_DENY_EXPIRED',now()-interval'1 day',null,'TEST governed refund terms')$$,'42501','BENEFIT_REFUND_FINANCE_REVIEW_REQUIRED','Client cannot publish commercial refund terms');
select pg_temp.actor332(2,'aal1');
select throws_ok($$select public.propose_benefit_refund_policy_v1((select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),86400,'PRESERVE_ORIGINAL_DENY_EXPIRED',now()-interval'1 day',null,'TEST governed refund terms')$$,'42501','BENEFIT_REFUND_FINANCE_REVIEW_REQUIRED','policy configuration requires fresh Finance MFA');
select pg_temp.actor332(2);
insert into p332 values('refund-policy',public.propose_benefit_refund_policy_v1((select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),86400,'PRESERVE_ORIGINAL_DENY_EXPIRED',now()-interval'1 day',null,'TEST exact original expiry and one-day refund window'));
select throws_ok($$select public.decide_benefit_refund_policy_v1((select(v->>'policy_id')::uuid from p332 where k='refund-policy'),(select v->>'content_hash'from p332 where k='refund-policy'),true,'TEST prohibited self approval')$$,'42501','INDEPENDENT_BENEFIT_REFUND_POLICY_REVIEW_REQUIRED','policy requires an independent Finance decision');
select pg_temp.actor332(3);
select public.decide_benefit_refund_policy_v1((select(v->>'policy_id')::uuid from p332 where k='refund-policy'),(select v->>'content_hash'from p332 where k='refund-policy'),true,'TEST independent approval of the exact refund terms');
-- A declared, approved one-second policy expires; no clock or ledger is rewritten.
select pg_temp.actor332(2);
insert into p332 values('refund-short-policy',public.propose_benefit_refund_policy_v1((select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),1,'PRESERVE_ORIGINAL_DENY_EXPIRED',now()-interval'1 day',null,'TEST one-second refund window, no commercial default'));
select pg_temp.actor332(3);
select public.decide_benefit_refund_policy_v1((select(v->>'policy_id')::uuid from p332 where k='refund-short-policy'),(select v->>'content_hash'from p332 where k='refund-short-policy'),true,'TEST independent review of short-window refusal scenario');
select pg_sleep(1.1);
select pg_temp.actor332(1);
select throws_ok($$select pg_temp.request_refund('refund332-expired-window')$$,'55000','BENEFIT_REFUND_WINDOW_ELAPSED','approved refund window is enforced without inventing extended validity');
select pg_temp.actor332(2);
insert into p332 values('refund-live-policy',public.propose_benefit_refund_policy_v1((select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),86400,'PRESERVE_ORIGINAL_DENY_EXPIRED',now()-interval'1 day',null,'TEST explicitly approved one-day terms for remaining scenarios'));
select pg_temp.actor332(3);
select public.decide_benefit_refund_policy_v1((select(v->>'policy_id')::uuid from p332 where k='refund-live-policy'),(select v->>'content_hash'from p332 where k='refund-live-policy'),true,'TEST independent review of exact one-day refund terms');
select pg_temp.actor332(4);
select throws_ok($$select pg_temp.request_refund()$$,'42501','BENEFIT_REFUND_REQUEST_DENIED','foreign Client cannot request credit restitution');
select throws_ok($$select public.list_benefit_refunds_v1('b3320000-0000-4000-8000-000000000001',1)$$,'42501','BENEFIT_REFUND_READ_DENIED','refund reader preserves tenant scope');
select pg_temp.actor332(1,'aal1');
select throws_ok($$select pg_temp.request_refund()$$,'42501','BENEFIT_REFUND_REQUEST_DENIED','refund request requires Client MFA');
select pg_temp.actor332(1);
select throws_ok($$select public.request_benefit_refund_v1('b3320000-0000-4000-8000-000000000004',pg_temp.refund_id(),pg_temp.refund_version(),'TEST tampered organization is refused','refund332-wrong-org')$$,'42501','BENEFIT_REFUND_REQUEST_DENIED','explicit organization and redemption must agree');
insert into p332 values('refund-request',pg_temp.request_refund());
select is(pg_temp.request_refund(),(select v from p332 where k='refund-request'),'a lost request response replays the exact durable request');
select is((select status from public.benefit_redemptions where id=pg_temp.refund_id()),'CONSUMED','request does not refund credits before Finance review');
select is(public.list_benefit_refunds_v1('b3320000-0000-4000-8000-000000000001',1)#>>'{rows,0,request,can_decide}','false','the Client is never shown Finance decision authority');
reset role;
insert into public.platform_user_roles(user_id,role_code)values('a3320000-0000-4000-8000-000000000001','FINANCE_MANAGER');
select pg_temp.actor332(1);set local role authenticated;
select throws_ok($$select public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='refund-request'),(select v->>'content_hash'from p332 where k='refund-request'),true,'TEST dual role cannot approve its own request','refund332-self')$$,'42501','INDEPENDENT_BENEFIT_REFUND_REVIEW_REQUIRED','even a Finance Client cannot approve their own refund');
select pg_temp.actor332(3,'aal1');
select throws_ok($$select public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='refund-request'),(select v->>'content_hash'from p332 where k='refund-request'),true,'TEST weak Finance cannot execute credits','refund332-weak')$$,'42501','BENEFIT_REFUND_FINANCE_REVIEW_REQUIRED','execution requires current independent Finance MFA');
select pg_temp.actor332(3);
select throws_ok($$select public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='refund-request'),repeat('0',64),true,'TEST changed request hash is refused','refund332-stale')$$,'40001','STALE_BENEFIT_REFUND_SOURCE','approval binds exact immutable request and consumed sources');
reset role;
-- Inject a transactional outbox failure, preserving all original enforcement.
-- This verifies failure rollback and retry, rather than pretending a command ran.
create function pg_temp.refund_outage()returns trigger language plpgsql as $$begin if new.event_type='BenefitRefundedV1'then raise exception'TEST_REFUND_OUTBOX_UNAVAILABLE'using errcode='55000';end if;return new;end$$;
create trigger test0332_refund_outage before insert on public.event_outbox for each row execute function pg_temp.refund_outage();
set local role authenticated;select pg_temp.actor332(3);
select throws_ok($$select public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='refund-request'),(select v->>'content_hash'from p332 where k='refund-request'),true,'TEST independently verified exact refund and economic reversal','refund332-execute')$$,'55000','TEST_REFUND_OUTBOX_UNAVAILABLE','outbox outage rolls the complete atomic financial command back');
reset role;
select is((select count(*)from public.credit_ledger_entries where reference_id=pg_temp.refund_id()::text and entry_type='REFUND'),0::bigint,'outage cannot leave a credited ledger');
select is((select count(*)from public.credit_economic_allocations_v1 where allocation_kind='REVERSAL'and funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')),0::bigint,'outage cannot leave an economic reversal');
select is((select status from public.benefit_redemptions where id=pg_temp.refund_id()),'CONSUMED','outage cannot falsely mark a consumed benefit refunded');
select is((select count(*)from private.benefit_refund_write_capabilities_v1),0::bigint,'outage leaves no transient authority behind');
drop trigger test0332_refund_outage on public.event_outbox;
set local role authenticated;select pg_temp.actor332(3);
insert into p332 values('refund-execute',public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='refund-request'),(select v->>'content_hash'from p332 where k='refund-request'),true,'TEST independently verified exact refund and economic reversal','refund332-execute'));
select is(public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='refund-request'),(select v->>'content_hash'from p332 where k='refund-request'),true,'TEST independently verified exact refund and economic reversal','refund332-execute'),(select v from p332 where k='refund-execute'),'lost execution response replays exact credit and economic reversal once');
select throws_ok($$select public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='refund-request'),(select v->>'content_hash'from p332 where k='refund-request'),true,'TEST another key cannot double credit','refund332-double')$$,'40001','STALE_BENEFIT_REFUND_SOURCE','another key cannot refund an already refunded consumption');
reset role;
select is((select count(*)from private.benefit_refund_write_capabilities_v1),0::bigint,'completed refund removes its transient authority');
select is((select status from public.benefit_redemptions where id=pg_temp.refund_id()),'REFUNDED','approved independent Finance command effects CONSUMED to REFUNDED');
select is((select sum(quantity)from public.credit_ledger_entries where reference_id=pg_temp.refund_id()::text and entry_type='REFUND'),1::numeric,'exact consumed quantity is credited with explicit REFUND entry');
select is((select count(*)from public.credit_lots where organization_id='b3320000-0000-4000-8000-000000000001'),1::bigint,'refund never synthesizes a new ADMIN_GRANT or loses payment origin');
select is((select available from public.client_credit_lot_positions_v1 where id=(select(v->>'credit_lot_id')::uuid from p332 where k='paid')),'3','original lot becomes spendable again through refund-aware FEFO');
select is((select reserved from public.client_credit_lot_positions_v1 where id=(select(v->>'credit_lot_id')::uuid from p332 where k='paid')),'0','a returned consumed lot has no phantom negative reservation');
select is((select sum(case when allocation_kind='REVERSAL'then-amount_minor else amount_minor end)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')),0::numeric,'immutable economic allocation has an exact counterallocation');
select is((select sum(case when effect_type='REVERSAL_REVENUE'then-amount_minor else amount_minor end)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p332 where k='book')and source_type='CREDIT_ECONOMIC_ALLOCATION_V1'),0::numeric,'original library P&L revenue is exactly reversed');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),8334::numeric,'net purchased funds are returned to their original unallocated class');
select is((select count(*)from public.credit_economic_allocations_v1 where allocation_kind='REVERSAL'and funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')),1::bigint,'double execution never creates a second counterallocation');
select is((select count(*)from public.event_outbox where aggregate_id=(select v->>'request_id'from p332 where k='refund-request')and event_type='BenefitRefundedV1'),1::bigint,'refund audit outbox is emitted exactly once');
select is((select expires_at from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p332 where k='paid')),(select(source_snapshot#>>'{consumptions,0,lot,expires_at}')::timestamptz from public.benefit_refund_requests_v1 where id=(select(v->>'request_id')::uuid from p332 where k='refund-request')),'refund preserves exact original expiry');
select ok(not has_column_privilege('authenticated','public.benefit_refund_requests_v1','source_snapshot','SELECT'),'own-request readers cannot obtain private accounting snapshots');
select ok(not has_table_privilege('authenticated','public.benefit_refund_executions_v1','INSERT'),'browser cannot fabricate execution facts');
select ok(not has_function_privilege('authenticated','private.reverse_benefit_economic_allocation_v1(uuid,uuid,uuid)','EXECUTE'),'browser cannot reverse economic sources directly');
set local role authenticated;select pg_temp.actor332(4);
select is((select count(*)from public.benefit_refund_requests_v1),0::bigint,'foreign tenant RLS hides refund reasons');
select is((select count(*)from public.benefit_refund_executions_v1),0::bigint,'foreign tenant RLS hides refund financial executions');
reset role;
-- Re-spend the same, original paid lot through the complete native workflow.
-- Net consumption and exact revenue must not count refunded quantities twice.
select pg_temp.actor332(1);set local role authenticated;
insert into p332 values('respent-reserve',public.reserve_benefit_credits('b3320000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p332 where k='paid'),(select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),3,clock_timestamp()+interval'1 day','refund332-respent-reserve'));
select pg_temp.actor332(2);
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p332 where k='respent-reserve'),1,'SCHEDULE',clock_timestamp()-interval'1 second','TEST scheduling all original returned credits','refund332-respent-schedule');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p332 where k='respent-reserve'),2,'START',null,'TEST actual execution with original returned credits','refund332-respent-start');
insert into p332 values('respent-delivery',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from p332 where k='respent-reserve'),3,'TEST all three service units actually completed after original credit restitution','TEST_RESPENT_332_REPORT',null,'refund332-respent-delivery'));
select pg_temp.actor332(1);
insert into p332 values('respent-receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p332 where k='respent-delivery'),(select v->>'source_hash'from p332 where k='respent-delivery'),(select(v->>'row_version')::bigint from p332 where k='respent-delivery'),true,'TEST client independently receives all three re-spent service units','refund332-respent-receipt'));
select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p332 where k='respent-reserve'),(select v->>'receipt_hash'from p332 where k='respent-receipt'),'refund332-respent-consume');
reset role;
select is((select sum(case when allocation_kind='REVERSAL'then-amount_minor else amount_minor end)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')),8334::numeric,'returned lot can be consumed again without exceeding its exact original net funding');
select is((select available from public.client_credit_lot_positions_v1 where id=(select(v->>'credit_lot_id')::uuid from p332 where k='paid')),'0','re-consumption spends the real returned lot, not a phantom balance');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p332 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),0::numeric,'re-consumption allocates the exact remaining funded net with no rounding leakage');
set local role authenticated;select pg_temp.actor332(1);
insert into p332 values('rejected-request',public.request_benefit_refund_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'redemption_id')::uuid from p332 where k='respent-reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='respent-reserve')),'TEST separate dispute that Finance will reject with exact reason','refund332-rejected-request'));
select pg_temp.actor332(3);
select is(public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='rejected-request'),(select v->>'content_hash'from p332 where k='rejected-request'),false,'TEST evidence does not establish grounds for a second credit return','refund332-rejected-decision')->>'outcome','BENEFIT_REFUND_REJECTED','independent Finance can reject the actual request without financial effects');
reset role;
select is((select status from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='respent-reserve')),'CONSUMED','refusal preserves the genuine consumed state');
select is((select count(*)from public.credit_lot_movements where redemption_id=(select(v->>'redemption_id')::uuid from p332 where k='respent-reserve')and movement_type='REFUND'),0::bigint,'refusal cannot restore credits or reverse P&L');
select throws_ok($$insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)select organization_id,wallet_id,'REFUND',reserved_credits,'benefit.refund.execute','refund332-forged-ledger',extensions.gen_random_uuid(),'BENEFIT_REDEMPTION',id::text,'a3320000-0000-4000-8000-000000000003'from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='respent-reserve')$$,'42501','CANONICAL_BENEFIT_REFUND_WRITE_REQUIRED','even privileged accidental credit inserts require the exact governed transaction authority');
select throws_ok($$insert into public.credit_lot_movements(organization_id,credit_lot_id,redemption_id,movement_type,quantity,idempotency_scope,idempotency_key,correlation_id,created_by)select organization_id,credit_lot_id,redemption_id,'REFUND',quantity,'benefit.refund.execute','refund332-forged-movement',extensions.gen_random_uuid(),'a3320000-0000-4000-8000-000000000003'from public.credit_lot_movements where redemption_id=(select(v->>'redemption_id')::uuid from p332 where k='respent-reserve')and movement_type='CONSUME'$$,'42501','CANONICAL_BENEFIT_REFUND_WRITE_REQUIRED','a lot return cannot be forged outside an independent approved command');

-- A separate real governed gift provides a deliberately short-lived original
-- lot. Its actual consumption is not restored after the approved expiry rule.
select pg_temp.actor332(2);set local role authenticated;
insert into p332 values('expiry-gift',public.request_manual_credit_grant_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p332 where k='paid'),'PROMOTION',1,clock_timestamp()+interval'8 seconds',null,'TEST_SHORT_LIVED_332','TEST separately governed short-lived lot for expiry refusal','refund332-expiry-gift'));
select pg_temp.actor332(3);
insert into p332 values('expiry-gift-review',public.review_manual_credit_grant_v1((select(v->>'request_id')::uuid from p332 where k='expiry-gift'),(select v->>'content_hash'from p332 where k='expiry-gift'),true,true,'TEST_SHORT_LIVED_332_REVIEW','TEST independent verification of explicit short-lived lot'));
select pg_temp.actor332(2);
insert into p332 values('expiry-gift-execute',public.execute_manual_credit_grant_v1((select(v->>'request_id')::uuid from p332 where k='expiry-gift'),(select v->>'content_hash'from p332 where k='expiry-gift'),(select v->>'review_proof_hash'from p332 where k='expiry-gift-review'),'refund332-expiry-gift-execute'));
select pg_temp.actor332(1);
insert into p332 values('expiry-reserve',public.reserve_benefit_credits('b3320000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p332 where k='paid'),(select(v->>'benefit_version_id')::uuid from p332 where k='benefit'),1,clock_timestamp()+interval'5 seconds','refund332-expiry-reserve'));
select pg_temp.actor332(2);
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve'),1,'SCHEDULE',clock_timestamp()-interval'1 second','TEST scheduling the short-lived funded benefit','refund332-expiry-schedule');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve'),2,'START',null,'TEST actual execution before original lot expiry','refund332-expiry-start');
insert into p332 values('expiry-delivery',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve'),3,'TEST service actually completed before expiry for independent client receipt','TEST_SHORT_LIVED_332_REPORT',null,'refund332-expiry-delivery'));
select pg_temp.actor332(1);
insert into p332 values('expiry-receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p332 where k='expiry-delivery'),(select v->>'source_hash'from p332 where k='expiry-delivery'),(select(v->>'row_version')::bigint from p332 where k='expiry-delivery'),true,'TEST client independently received the completed short-lived benefit','refund332-expiry-receipt'));
select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve'),(select v->>'receipt_hash'from p332 where k='expiry-receipt'),'refund332-expiry-consume');
insert into p332 values('expiry-refund-request',public.request_benefit_refund_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve')),'TEST request made before expiry then independently reviewed after expiry','refund332-expiry-request'));
reset role;
select pg_sleep(greatest(0,extract(epoch from((select expires_at from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p332 where k='expiry-gift-execute'))-clock_timestamp())))+0.02);
set local role authenticated;select pg_temp.actor332(3);
select throws_ok($$select public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p332 where k='expiry-refund-request'),(select v->>'content_hash'from p332 where k='expiry-refund-request'),true,'TEST expired source cannot gain new credit validity','refund332-expired-decide')$$,'55000','BENEFIT_REFUND_ORIGINAL_LOT_EXPIRED','approval cannot resurrect an expired original lot');
select pg_temp.actor332(1);
select throws_ok($$select public.request_benefit_refund_v1('b3320000-0000-4000-8000-000000000001',(select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p332 where k='expiry-reserve')),'TEST request cannot extend an already expired original lot','refund332-expired-request')$$,'55000','BENEFIT_REFUND_ORIGINAL_LOT_EXPIRED','a later request cannot resurrect expired credits either');
reset role;
select*from finish();
rollback;
