begin;
set local search_path=public,extensions;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='NON_CONTRACTUAL_SQL_CREDIT_247',configured_at=clock_timestamp()where singleton;
-- SQL authorization/accounting contracts with declared synthetic identities and
-- the native DEMO payment constructor. No PSP signature or physical bytes are
-- certified by this fixture; API verification is tested by the payment owner.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a2470000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','credit247-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)n;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2470000-0000-4000-8000-000000000001','Credit 247 SARL','Credit 247 SARL','ACTIVE','a2470000-0000-4000-8000-000000000001'),
('b2470000-0000-4000-8000-000000000004','Other247 SARL','Other247 SARL','ACTIVE','a2470000-0000-4000-8000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','a2470000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2470000-0000-4000-8000-000000000004','b2470000-0000-4000-8000-000000000004','a2470000-0000-4000-8000-000000000004','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c2470000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2470000-0000-4000-8000-000000000004','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a2470000-0000-4000-8000-000000000002','FINANCE_MANAGER'),('a2470000-0000-4000-8000-000000000003','FINANCE_MANAGER'),('a2470000-0000-4000-8000-000000000005','FINANCE_MANAGER'),('a2470000-0000-4000-8000-000000000005','READ_ONLY_AUDITOR');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b2470000-0000-4000-8000-000000000001','ICE','997247000000001','VERIFIED'),('b2470000-0000-4000-8000-000000000001','IF','99724701','VERIFIED'),('b2470000-0000-4000-8000-000000000001','RC','TEST247','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
set local session_replication_role=replica;
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','VERIFIED',1,'a2470000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99724701","rc_number":"TEST247","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Credit 247 SARL","display_name":"Credit 247 SARL","country_code":"MA","identifiers":{"ICE":"997247000000001","IF":"99724701","RC":"TEST247"}}',1,'a2470000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001',1,now()-interval'1 day','a2470000-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f2471000-0000-0000-0000-000000000001','f2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b2470000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a2470000-0000-4000-8000-000000000002',clock_timestamp(),'a2470000-0000-4000-8000-000000000001'),
('f2471000-0000-0000-0000-000000000002','f2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b2470000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a2470000-0000-4000-8000-000000000002',clock_timestamp(),'a2470000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f2472000-0000-0000-0000-000000000001','f2471000-0000-0000-0000-000000000001','b2470000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2473000-0000-0000-0000-000000000001'),
('f2472000-0000-0000-0000-000000000002','f2471000-0000-0000-0000-000000000002','b2470000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2473000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f2471000-0000-0000-0000-000000000001' then 'f2472000-0000-0000-0000-000000000001'::uuid
  else 'f2472000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f2471000-0000-0000-0000-000000000001','f2471000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a2470000-0000-4000-8000-000000000002',clock_timestamp(),'a2470000-0000-4000-8000-000000000001','f2471000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a2470000-0000-4000-8000-000000000002',clock_timestamp(),'a2470000-0000-4000-8000-000000000001','f2471000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');


set local session_replication_role=origin;

create temporary table p247(k text primary key,v jsonb);grant all on p247 to authenticated,service_role;
grant usage on schema extensions to authenticated,service_role;
create function pg_temp.actor247(n integer,aal text default 'aal2')returns void language plpgsql as $$declare actor uuid:=('a2470000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;begin
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal',aal)::text,true);
end$$;
create function pg_temp.service247()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;
set local role authenticated;select pg_temp.actor247(2);
insert into p247 values('pack',public.create_credit_pack_version('b2470000-0000-4000-8000-000000000001','CREDIT247_EUR','Pack de recette','حزمة الاختبار',3,10001,'EUR',365,'credit247-create-pack'));
select public.activate_credit_pack_version('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'credit247-activate-pack');
select pg_temp.actor247(1);
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'DEMO','DEMO','credit247-no-mapping')$$,'55000','APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED','checkout refuses before PSP when no approved posting mapping exists');
select pg_temp.actor247(2);
insert into p247 values('posting',public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,'{"cash_account_code":"CREDIT247_CASH_EUR","cash_name_fr":"Trésorerie de recette","cash_name_ar":"خزينة الاختبار","suspense_account_code":"CREDIT247_PENDING_EUR","suspense_name_fr":"Encaissement en attente","suspense_name_ar":"تحصيل قيد المراجعة"}','Mapping synthétique exclusivement pour recette SQL','credit247-posting-policy'));
select throws_ok($$select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='posting'),true,(select v->>'request_hash'from p247 where k='posting'),'Tentative auto approbation interdite')$$,'42501','CREDIT_REVENUE_INDEPENDENT_REVIEW_REQUIRED','mapping maker cannot approve its own proposal');
select pg_temp.actor247(3);
select throws_ok($$select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='posting'),true,repeat('f',64),'Revue avec empreinte périmée interdite')$$,'40001','STALE_CREDIT_REVENUE_POLICY_REQUEST','review pins the exact policy request hash');
insert into p247 values('posting-approved',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='posting'),true,(select v->>'request_hash'from p247 where k='posting'),'Approbation indépendante de recette SQL'));
select pg_temp.actor247(1);
insert into p247 values('prep',public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'DEMO','DEMO','credit247-checkout'));
select is((select v->>'create_authorized'from p247 where k='prep'),'true','only first preparation authorizes provider CREATE');
insert into p247 values('prep-replay',public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'DEMO','DEMO','credit247-checkout'));
select is((select v->>'create_authorized'from p247 where k='prep-replay'),'false','same-key ambiguity never authorizes a second provider CREATE');
select is((select v->>'creation_state'from p247 where k='prep-replay'),'CREATE_REQUESTED_UNKNOWN','unregistered attempt remains explicitly unknown');
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'DEMO','DEMO','credit247-another-key')$$,'55000','CREDIT_PACK_PAYMENT_ATTEMPT_ALREADY_PENDING','another key cannot order twice while creation is ambiguous');
select pg_temp.actor247(2);
insert into p247 values('posting-revoke',public.request_credit_revenue_policy_revocation_v1((select(v->>'policy_version_id')::uuid from p247 where k='posting'),'Révocation gouvernée après préparation de la recette','credit247-revoke-posting'));
select pg_temp.actor247(3);
insert into p247 values('posting-revoked',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='posting-revoke'),true,(select v->>'request_hash'from p247 where k='posting-revoke'),'Approbation indépendante de révocation'));
reset role;select pg_temp.service247();set local role service_role;
insert into p247 values('intent',public.register_credit_pack_payment_intent_v1((select(v->>'preparation_id')::uuid from p247 where k='prep'),'DEMO','SYNTHETIC-CREDIT247-ORDER',10001,'EUR'));
select is(public.resolve_verified_payment_kind_v1('DEMO','DEMO','SYNTHETIC-CREDIT247-ORDER',null)->>'kind','CREDIT_PACK','verified native order reference resolves the pack domain');
insert into p247 values('paid-at',to_jsonb(statement_timestamp()));
insert into p247 values('paid',public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT247-EVENT','SYNTHETIC-CREDIT247-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p247 where k='paid-at'),'SYNTHETIC-CREDIT247-CAPTURE',repeat('a',64),repeat('b',64),'f247c000-0000-4000-8000-000000000001'));
reset role;
select is((select v->>'outcome'from p247 where k='paid'),'CREDIT_PACK_CAPTURED','native DEMO capture creates the paid pack fact');
select is((select count(*)from public.credit_pack_payment_events_v1 where organization_id='b2470000-0000-4000-8000-000000000001'),1::bigint,'one immutable native capture exists');
select is((select count(*)from public.financial_journals where organization_id='b2470000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'capture posts one balanced cash/suspense journal');
select is((select currency::text from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p247 where k='paid')),'EUR','non-MAD pack retains its actual paid currency in the lot');
select is((select quantity from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p247 where k='paid')),3::bigint,'pack quantity is pinned to the frozen offer');
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p247 where k='paid')),'ELIGIBLE','captured pack is funded even while fiscal valuation is pending');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select id from public.credit_economic_funding_sources_v1 where organization_id='b2470000-0000-4000-8000-000000000001')),10001::numeric,'gross capture is retained exactly in the pending economic ledger');
select is((select count(*)from public.credit_economic_classifications_v1 c join public.credit_economic_funding_sources_v1 f on f.id=c.funding_source_id where f.organization_id='b2470000-0000-4000-8000-000000000001'),0::bigint,'missing fiscal context never invents a net revenue classification');
select is((select count(*)from public.credit_economic_allocations_v1 c join public.credit_economic_funding_sources_v1 f on f.id=c.funding_source_id where f.organization_id='b2470000-0000-4000-8000-000000000001'),0::bigint,'missing fiscal context never announces library income');

-- First capture retained its frozen approved mapping after revocation.
select is((select v->>'outcome'from p247 where k='posting-revoked'),'CREDIT_REVENUE_POLICY_REVOKED','posting policy was actually revoked before the paid callback');
select pg_temp.service247();
select is(public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT247-EVENT','SYNTHETIC-CREDIT247-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p247 where k='paid-at'),'SYNTHETIC-CREDIT247-CAPTURE',repeat('a',64),repeat('c',64),'f247c000-0000-4000-8000-000000000099')->>'replayed','true','same verified body with new transmission fingerprint replays without another cash journal');
select throws_ok($$select public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT247-EVENT','SYNTHETIC-CREDIT247-ORDER','PAYMENT_SUCCEEDED',10002,'EUR',(select(v#>>'{}')::timestamptz from p247 where k='paid-at'),'SYNTHETIC-CREDIT247-CAPTURE',repeat('a',64),repeat('c',64))$$,'23514','CREDIT_PACK_CAPTURE_CONTEXT_MISMATCH','wrong paid amount cannot mutate the captured fact');
select throws_ok($$select public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT247-EVENT','SYNTHETIC-CREDIT247-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p247 where k='paid-at'),'SYNTHETIC-CREDIT247-CAPTURE',repeat('f',64),repeat('c',64))$$,'22000','CREDIT_PACK_CAPTURE_REPLAY_MISMATCH','same provider event cannot change its verified payload');
select is((select count(*)from public.financial_journals where organization_id='b2470000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'duplicate callback creates no second journal');
select is((select count(*)from public.credit_ledger_entries where organization_id='b2470000-0000-4000-8000-000000000001'and entry_type='GRANT'),1::bigint,'duplicate callback creates no second credit grant');
select throws_ok($$select private.register_payment_provider_target_v1('SUBSCRIPTION',extensions.gen_random_uuid(),'DEMO','DEMO','INTENT','SYNTHETIC-CREDIT247-ORDER',repeat('e',64))$$,'23514','PAYMENT_PROVIDER_REFERENCE_ALREADY_BOUND','same native order cannot be routed to subscription and pack');
select pg_temp.actor247(2);
select throws_ok($$select public.issue_credits('b2470000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p247 where k='paid'),'EXTRA_PURCHASE',3,clock_timestamp()+interval'1 year',null,'manual-payment-ref',10001,'MANUAL_V1',null,'credit247-forged-extra')$$,'55000','CREDIT_PACK_CANONICAL_PAYMENT_REQUIRED','an admin free-text reference cannot fabricate paid credits');
select pg_temp.actor247(1);
insert into p247 values('paid-replay',public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'DEMO','DEMO','credit247-checkout'));
select is((select v->>'create_authorized'from p247 where k='paid-replay'),'false','paid preparation replay never authorizes another provider order');
select is((select v->'capture_result'->>'outcome'from p247 where k='paid-replay'),'CREDIT_PACK_CAPTURED','paid preparation replay returns its exact canonical capture');
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'DEMO','DEMO','credit247-after-revocation')$$,'55000','APPROVED_PAYMENT_POSTING_MAPPING_REQUIRED','revoked mapping blocks a new order before external money calls');
select pg_temp.actor247(4);
select throws_ok($$select public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'DEMO','DEMO','credit247-cross-tenant')$$,'42501','CREDIT_PACK_CHECKOUT_DENIED','sibling organization cannot initiate another tenant purchase');
set local role authenticated;
select is((select count(*)from public.credit_pack_payment_events_v1 where organization_id='b2470000-0000-4000-8000-000000000001'),0::bigint,'sibling tenant cannot read the native payment capture');
reset role;
select pg_temp.actor247(5);
select throws_ok($$select public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),null,'EUR','DEVELOPMENT',2,current_date,null,'{}','Auditeur ne peut configurer le paiement','credit247-auditor-policy')$$,'42501','CREDIT_REVENUE_POLICY_CREATE_DENIED','combined read-only auditor remains unable to mutate finance policy');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p247 where k='paid')),'ENVIRONMENT_INCOMPATIBLE','DEMO capture cannot fund credits after retag to production');
select is((select provider_environment from public.credit_pack_payment_events_v1 where id=(select(v->>'payment_event_id')::uuid from p247 where k='paid')),'DEMO','retag never rewrites immutable payment provenance');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select ok(not has_function_privilege('authenticated','private.post_verified_payment_suspense_v1(uuid,uuid,text,text,bigint,character,timestamp with time zone,uuid,uuid)','EXECUTE'),'browser cannot post a journal through the private payment constructor');
select ok(not has_function_privilege('authenticated','public.process_verified_credit_pack_payment_v1(text,text,text,text,text,bigint,character,timestamp with time zone,text,text,text,uuid)','EXECUTE'),'browser cannot impersonate the verified callback');
select throws_ok($$update public.credit_pack_payment_events_v1 set amount_minor=1 where organization_id='b2470000-0000-4000-8000-000000000001'$$,'55000','IMMUTABLE_RECORD','captured payment cannot be rewritten');
-- Explicit synthetic fiscal configuration, approved through the real commands.
insert into p247 select'funding',to_jsonb(id)from public.credit_economic_funding_sources_v1 where organization_id='b2470000-0000-4000-8000-000000000001';
set local role authenticated;select pg_temp.actor247(1);
select throws_ok($$select public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p247 where k='funding'))$$,'42501','CREDIT_ECONOMIC_RECONCILIATION_DENIED','client cannot classify its own captured money');
select pg_temp.actor247(2);
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p247 where k='funding'))->>'status','PENDING_FISCAL_REVIEW','captured gross never becomes revenue without an approved fiscal context');
insert into p247 values('billing',public.create_client_billing_policy_v1(jsonb_build_object('series_key','SQL247_FISCAL','version',1,'currency','EUR','tax_rate_bps',2000,'tax_label_fr','Taxe synthétique de recette','tax_label_ar','ضريبة اختبار','jurisdiction','TEST_ONLY','issuer',jsonb_build_object('legal_name','SQL Test Issuer','legal_form','TEST','address','Synthetic SQL fixture address','ice','997247000000002','if_number','99724702','rc_number','SQL247','contact_email','fiscal247@example.invalid'),'invoice_prefix','SQL247I','credit_prefix','SQL247C','invoice_start_number','1','credit_start_number','1','valid_from',(current_date-2)::text,'service_label_fr','Produit de recette uniquement','service_label_ar','منتج اختبار فقط','approval_reference','SYNTHETIC_SQL_NOT_REAL_FISCAL_POLICY'),'credit247-billing-policy'));
select pg_temp.actor247(3);
select public.approve_client_billing_policy_v1((select(v->>'policy_id')::uuid from p247 where k='billing'),true,'Approbation fiscale indépendante de recette','credit247-approve-billing');
select pg_temp.actor247(2);
insert into p247 values('fiscal',public.create_credit_revenue_policy_v1('FISCAL','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 jsonb_build_object('billing_policy_version_id',(select v->>'policy_id'from p247 where k='billing'),'recognition_accounts',jsonb_build_object('core',jsonb_build_object('code','SQL247_CORE_EUR','name_fr','Core de recette','name_ar','إيراد أساسي للاختبار'),'benefit_pool',jsonb_build_object('code','SQL247_POOL_EUR','name_fr','Pool de recette','name_ar','مجمع اختبار'),'unallocated',jsonb_build_object('code','SQL247_UNALLOC_EUR','name_fr','Crédits achetés non affectés','name_ar','أرصدة مشتراة غير مخصصة'),'tax',jsonb_build_object('code','SQL247_TAX_EUR','name_fr','Taxe de recette due','name_ar','ضريبة اختبار مستحقة'))),'Contexte fiscal de recette explicitement approuvé','credit247-fiscal-context'));
select pg_temp.actor247(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='fiscal'),true,(select v->>'request_hash'from p247 where k='fiscal'),'Revue indépendante contexte fiscal de recette');
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p247 where k='funding'))->>'status','PENDING_ALLOCATION_POLICY','approved fiscal context does not invent an allocation policy');
select pg_temp.actor247(2);
insert into p247 values('allocation',public.create_credit_revenue_policy_v1('ALLOCATION','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 '{"purchase_rounding":"CUMULATIVE_FLOOR_REMAINDER","accepted_evidence_kinds":["OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT"],"fulfillment_modes":["MATRICIA_INTERNAL"]}',
 'Politique allocation de recette sans règle de production','credit247-allocation-policy'));
select pg_temp.actor247(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='allocation'),true,(select v->>'request_hash'from p247 where k='allocation'),'Revue indépendante allocation de recette');
insert into p247 values('classified',public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p247 where k='funding')));
select is((select v->>'status'from p247 where k='classified'),'READY','governed fiscal and allocation policies classify the verified purchase');
select is((select v->>'net_minor'from p247 where k='classified'),'8334','gross-to-net derives only from the approved synthetic tax context');
select is((select v->>'tax_minor'from p247 where k='classified'),'1667','half-up tax remainder conserves the paid gross exactly');
reset role;
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),8334::numeric,'net purchased value waits for actual library consumption');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')and revenue_class='CAPTURE_GROSS_PENDING'),0::numeric,'classification clears the gross waiting economic balance');
select is((select count(*)from public.franchise_pnl_entries where financial_journal_id=(select financial_journal_id from public.credit_economic_funding_sources_v1 where id=(select(v#>>'{}')::uuid from p247 where k='funding'))),0::bigint,'unconsumed purchased value is not franchise profit');
select is((select count(*)from public.financial_journals where organization_id='b2470000-0000-4000-8000-000000000001'and journal_type='CREDIT_PACK_PAYMENT'),1::bigint,'fiscal recognition never posts a second cash journal');
select is((select sum(case direction when'DEBIT'then amount_minor else-amount_minor end)from public.financial_entries where journal_id=(select(v->>'classification_journal_id')::uuid from p247 where k='classified')),0::numeric,'recognition journal balances liability to revenue and tax without cash');
select pg_temp.actor247(3);set local role authenticated;
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p247 where k='funding'))->>'replayed','true','classification retry reuses the immutable source');
reset role;
select is((select count(*)from public.credit_economic_classifications_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')),1::bigint,'classification is appended once');
-- Actual builder/onboarding commands create a clearly labelled DEV franchise,
-- and real benefit operations/independent receipt consume the purchased lot.
insert into public.platform_user_roles(user_id,role_code)values('a2470000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),('a2470000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e2470000-0000-4000-8000-000000000001','SQL247_LIBRARY','sql247-library','b2470000-0000-4000-8000-000000000001','DRAFT','a2470000-0000-4000-8000-000000000002');
set local role authenticated;select pg_temp.actor247(2);
insert into p247 values('franchise',public.propose_franchise_governance('e2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','FRANCHISEE','SQL247','Territoire TEST uniquement','نطاق اختبار فقط','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{}','credit247-1@example.invalid',repeat('7',64),'fr-MA','{}','Franchise de recette non contractuelle uniquement','credit247-franchise-propose'));
select pg_temp.actor247(3);
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from p247 where k='franchise'),'APPROVE','Approbation indépendante simulation de recette',1,'credit247-franchise-approve');
select pg_temp.actor247(1);
insert into p247 values('franchise-demo',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from p247 where k='franchise'),repeat('7',64),1,(select(v->>'mandate_version_id')::uuid from p247 where k='franchise'),public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from p247 where k='franchise'))->>'mandateHash',true,'credit247-franchise-simulation'));
select is((select v->>'activationMode'from p247 where k='franchise-demo'),'NON_CONTRACTUAL_DEMO','allocation fixture never claims a legally signed real franchise');
select pg_temp.actor247(2);
insert into p247 values('book',public.open_franchise_pnl_book('e2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','EUR',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and status='ACTIVE'order by version desc limit 1),'credit247-book'));
insert into p247 values('benefit',public.create_benefit_version('b2470000-0000-4000-8000-000000000001','CREDIT247_BENEFIT','CONSULTATION','MATRICIA_INTERNAL','Consultation SQL uniquement','استشارة اختبار فقط','Prestation synthétique du contrat SQL','خدمة تجريبية لاختبار SQL',1,1000,0,'EUR','e2470000-0000-4000-8000-000000000001',null,null,'{}','{}','SQL247_CANCELLATION',clock_timestamp()-interval'1 minute','credit247-benefit-create'));
select pg_temp.actor247(3);
select public.activate_benefit_version('b2470000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p247 where k='benefit'),'credit247-benefit-activate');
-- Admission is independently governed too (Provider268060).
select pg_temp.actor247(2);
insert into p247 values('admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p247 where k='benefit')));
insert into p247 values('admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p247 where k='benefit'),(select v->>'source_hash'from p247 where k='admission-context'),(select(v->>'head_id')::uuid from p247 where k='admission-context'),'NONE',null,null,'{}','{}',now()-interval'1 minute',null,'Politique admission synthétique explicitement revue','SQL247_ADMISSION_TEST_ONLY','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','f247a000-0000-4000-8000-000000000001'));
select pg_temp.actor247(3);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p247 where k='admission-policy'),(select v->>'content_hash'from p247 where k='admission-policy'),true,'SQL247_INDEPENDENT_APPROVAL','Revue indépendante de la politique admission SQL');
select pg_temp.actor247(1);
insert into p247 values('reserve',public.reserve_benefit_credits('b2470000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p247 where k='paid'),(select(v->>'benefit_version_id')::uuid from p247 where k='benefit'),1,clock_timestamp()+interval'1 day','credit247-reserve'));
select pg_temp.actor247(2);
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p247 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p247 where k='reserve')),'SCHEDULE',clock_timestamp()-interval'1 second','Planification opérationnelle effective de recette','credit247-schedule');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p247 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p247 where k='reserve')),'START',null,'Réalisation opérationnelle effective de recette','credit247-start');
insert into p247 values('delivery',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from p247 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p247 where k='reserve')),'Compte rendu synthétique du service effectivement exécuté dans ce contrat SQL','SQL247_OPERATIONAL_REPORT',null,'credit247-delivery'));
select pg_temp.actor247(1);
insert into p247 values('receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p247 where k='delivery'),(select v->>'source_hash'from p247 where k='delivery'),(select(v->>'row_version')::bigint from p247 where k='delivery'),true,'Réception indépendante de la prestation de cette recette SQL','credit247-receipt'));
select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p247 where k='reserve'),(select v->>'receipt_hash'from p247 where k='receipt'),'credit247-consume');
reset role;
select is((select count(*)from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p247 where k='reserve')),1::bigint,'public consumption appends its real canonical movement and independent receipt');
select is((select status from public.credit_economic_processing_events_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p247 where k='reserve')order by id desc limit 1),'PENDING_MANDATE','no arbitrary first book is selected without an approved library route');
select is((select count(*)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')),0::bigint,'unreviewed route cannot create library income');
set local role authenticated;select pg_temp.actor247(2);
insert into p247 values('route',public.create_credit_revenue_policy_v1('BOOK_ROUTE','LIBRARY','e2470000-0000-4000-8000-000000000001','b2470000-0000-4000-8000-000000000001','EUR','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('book_id',(select v->>'book_id'from p247 where k='book'),'franchise_id',(select v->>'franchise_id'from p247 where k='franchise'),'mandate_version_id',(select v->>'active_mandate_version_id'from p247 where k='franchise-demo')),'Affectation explicite bibliothèque client et mandat de recette','credit247-book-route'));
select pg_temp.actor247(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='route'),true,(select v->>'request_hash'from p247 where k='route'),'Approbation indépendante du mandat et livre exacts');
insert into p247 values('allocated',public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p247 where k='reserve')));
reset role;
select is((select sum(amount_minor)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')and allocation_kind='PURCHASE_CONSUMPTION'),2778::numeric,'one of three purchased credits attributes its exact net share to the consumed library');
select is((select sum(amount_minor)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p247 where k='book')and source_type='CREDIT_ECONOMIC_ALLOCATION_V1'),2778::numeric,'canonical library attribution reaches the real P&L without invented cash');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),5556::numeric,'unspent purchased credits retain the remaining net value');
select pg_temp.actor247(3);set local role authenticated;
select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p247 where k='reserve'));
reset role;
select is((select count(*)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')),1::bigint,'consumption reconciliation never duplicates the P&L revenue');
select pg_temp.actor247(4);set local role authenticated;
select throws_ok($$select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p247 where k='reserve'))$$,'42501','CREDIT_ECONOMIC_RECONCILIATION_DENIED','foreign Client cannot allocate another tenant consumption');
select pg_temp.actor247(3,'aal1');
select throws_ok($$select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p247 where k='reserve'))$$,'42501','CREDIT_ECONOMIC_RECONCILIATION_DENIED','Finance needs current MFA for an economic allocation');
reset role;select pg_temp.actor247(3);
select ok(not has_function_privilege('authenticated','private.post_credit_economic_allocation_v1(uuid,uuid,uuid,text,text,bigint,uuid,jsonb,jsonb,date,uuid)','EXECUTE'),'browser cannot forge a canonical analytical allocation');
select throws_ok($$insert into public.franchise_pnl_entries(book_id,effect_type,category,amount_minor,currency,financial_journal_id,source_type,source_id,effective_on,reason,correlation_id,created_by)select book_id,'REVENUE','COLLECTED_NET_REVENUE',amount_minor,currency,(select financial_journal_id from public.credit_economic_funding_sources_v1 where id=funding_source_id),'CREDIT_ECONOMIC_ALLOCATION_V1',id::text,current_date,'Spoofed source rejected','f247ffff-0000-4000-8000-000000000001','a2470000-0000-4000-8000-000000000003'from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p247 where k='funding')$$,'42501','CANONICAL_CREDIT_ECONOMIC_PNL_SOURCE_REQUIRED','reserved P&L source cannot be replayed through an unrelated writer');
select pg_temp.service247();set local role service_role;
insert into p247 values('dispute',public.process_verified_credit_pack_adjustment_v1('DEMO','DEMO','SQL247-DISPUTE-OPEN-EVENT','SYNTHETIC-CREDIT247-CAPTURE','SQL247-NATIVE-DISPUTE','DISPUTE_OPENED',10001,'EUR',clock_timestamp(),repeat('d',64),repeat('e',64),(select v->>'payment_intent_id'from p247 where k='intent')));
reset role;
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p247 where k='paid')),'PAYMENT_HELD','materialized native dispute holds the remaining purchased credits');
select pg_temp.service247();set local role service_role;
insert into p247 values('won',public.process_verified_credit_pack_adjustment_v1('DEMO','DEMO','SQL247-DISPUTE-WON-EVENT','SYNTHETIC-CREDIT247-CAPTURE','SQL247-NATIVE-DISPUTE','DISPUTE_WON',10001,'EUR',clock_timestamp()+interval'1 second',repeat('a',64),repeat('b',64),(select v->>'payment_intent_id'from p247 where k='intent')));
reset role;
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p247 where k='paid')),'ELIGIBLE','a later exact native WON resolves that dispute hold');
insert into p247 values('refund-at',to_jsonb(clock_timestamp()));
select pg_temp.service247();set local role service_role;
insert into p247 values('refund',public.process_verified_credit_pack_adjustment_v1('DEMO','DEMO','SQL247-REFUND-EVENT','SYNTHETIC-CREDIT247-CAPTURE','SQL247-NATIVE-REFUND','REFUND_SUCCEEDED',1000,'EUR',(select(v#>>'{}')::timestamptz from p247 where k='refund-at'),repeat('c',64),repeat('d',64),(select v->>'payment_intent_id'from p247 where k='intent')));
select is(public.process_verified_credit_pack_adjustment_v1('DEMO','DEMO','SQL247-REFUND-EVENT','SYNTHETIC-CREDIT247-CAPTURE','SQL247-NATIVE-REFUND','REFUND_SUCCEEDED',1000,'EUR',(select(v#>>'{}')::timestamptz from p247 where k='refund-at'),repeat('c',64),repeat('f',64),(select v->>'payment_intent_id'from p247 where k='intent'))->>'replayed','true','refund retry preserves its first verified facts despite rotating transmission proof');
select throws_ok($$select public.process_verified_credit_pack_adjustment_v1('DEMO','DEMO','SQL247-REFUND-OVER-EVENT','SYNTHETIC-CREDIT247-CAPTURE','SQL247-NATIVE-REFUND-OVER','REFUND_SUCCEEDED',10000,'EUR',clock_timestamp(),repeat('c',64),repeat('d',64))$$,'23514','CREDIT_PACK_REFUND_EXCEEDS_CAPTURE','cumulative refunds cannot exceed native paid gross');
reset role;
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p247 where k='paid')),'PAYMENT_HELD','a native refund cannot leave remaining credits spendable before reconciliation');
select is((select sum(amount_minor)from public.financial_entries where journal_id=(select(v->>'financial_journal_id')::uuid from p247 where k='refund')and direction='CREDIT'and account_id=(select c.cash_account_id from private.payment_posting_contexts_v1 c where preparation_id=(select(v->>'preparation_id')::uuid from p247 where k='prep'))),1000::numeric,'refund uses the exact frozen cash account instead of a hardcoded code');
select pg_temp.actor247(3);set local role authenticated;
select is(public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p247 where k='funding'))->>'status','SOURCE_REVIEW_REQUIRED','an old classification cannot report refunded funds as currently ready');
reset role;
select pg_temp.actor247(2);set local role authenticated;
insert into p247 select'posting-v2',public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),null,'EUR','DEVELOPMENT',2,current_date-1,null,policy_snapshot,'Second mapping synthétique de recette après revue','credit247-posting-v2')from public.credit_revenue_policy_versions_v1 where id=(select(v->>'policy_version_id')::uuid from p247 where k='posting');
select pg_temp.actor247(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p247 where k='posting-v2'),true,(select v->>'request_hash'from p247 where k='posting-v2'),'Approbation indépendante du second mapping de recette');
select pg_temp.actor247(1);
insert into p247 values('paypal-prep',public.prepare_credit_pack_payment_intent_v1('b2470000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p247 where k='pack'),'PAYPAL','SANDBOX','credit247-paypal-marker'));
reset role;select pg_temp.service247();set local role service_role;
insert into p247 values('paypal-intent',public.register_credit_pack_payment_intent_v1((select(v->>'preparation_id')::uuid from p247 where k='paypal-prep'),'SANDBOX','SQL247-SANDBOX-ORDER-NO-PSP-CALL',10001,'EUR'));
reset role;select pg_temp.actor247(1);set local role authenticated;
insert into p247 values('capture-first',public.prepare_credit_pack_payment_capture_v1((select(v->>'payment_intent_id')::uuid from p247 where k='paypal-intent'),'SANDBOX'));
insert into p247 values('capture-retry',public.prepare_credit_pack_payment_capture_v1((select(v->>'payment_intent_id')::uuid from p247 where k='paypal-intent'),'SANDBOX'));
select is((select v->>'capture_authorized'from p247 where k='capture-first'),'true','only the first durable capture transition authorizes a PSP POST');
select is((select v->>'capture_authorized'from p247 where k='capture-retry'),'false','same operation never authorizes a second PSP capture POST');
select is((select v->>'capture_state'from p247 where k='capture-retry'),'PENDING_NATIVE_REVIEW','uncertain capture state requires a native GET instead of timeout retry');
select is((select v->>'capture_operation_key'from p247 where k='capture-retry'),(select v->>'capture_operation_key'from p247 where k='capture-first'),'uncertain capture keeps its first immutable operation identity');
reset role;
select is((select count(*)from private.credit_pack_capture_attempts_v1 where payment_intent_id=(select(v->>'payment_intent_id')::uuid from p247 where k='paypal-intent')),1::bigint,'capture attempts remain single-flight without mutable lease resets');
select*from finish();
rollback;
