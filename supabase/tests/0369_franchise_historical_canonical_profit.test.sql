-- TEST ONLY: prove the historical-import boundary rather than forge elapsed history.
-- No initial money journal, P&L income, distribution or payout is injected.
-- This fixture intentionally DOES NOT claim a positive historical closing.
-- Native current payment/admission setup is followed by actual prohibited writes.
begin;

set local search_path=public,extensions;

select no_plan();

update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST_HISTORY_IMPORT_BOUNDARY_369',configured_at=clock_timestamp()where singleton;

-- TEST ONLY complete native current economic flow; historical closing fixture
-- is separately identified below. No trigger, role, clock or guard is bypassed.
-- SQL authorization/accounting contracts with declared synthetic identities and
-- the native DEMO payment constructor. No PSP signature or physical bytes are
-- certified by this fixture; API verification is tested by the payment owner.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3690000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','credit369-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)n;

insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3690000-0000-4000-8000-000000000001','Credit 369 SARL','Credit 369 SARL','ACTIVE','a3690000-0000-4000-8000-000000000001'),
('b3690000-0000-4000-8000-000000000004','Other369 SARL','Other369 SARL','ACTIVE','a3690000-0000-4000-8000-000000000004');

insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','a3690000-0000-4000-8000-000000000001','ACTIVE',now()),
('c3690000-0000-4000-8000-000000000004','b3690000-0000-4000-8000-000000000004','a3690000-0000-4000-8000-000000000004','ACTIVE',now());

insert into public.organization_member_roles(membership_id,role_code)values('c3690000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c3690000-0000-4000-8000-000000000004','CLIENT_OWNER');

insert into public.platform_user_roles(user_id,role_code)values('a3690000-0000-4000-8000-000000000002','FINANCE_MANAGER'),('a3690000-0000-4000-8000-000000000003','FINANCE_MANAGER'),('a3690000-0000-4000-8000-000000000005','FINANCE_MANAGER'),('a3690000-0000-4000-8000-000000000005','READ_ONLY_AUDITOR');

insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b3690000-0000-4000-8000-000000000001','ICE','997369000000001','VERIFIED'),('b3690000-0000-4000-8000-000000000001','IF','99736901','VERIFIED'),('b3690000-0000-4000-8000-000000000001','RC','TEST369','VERIFIED');

-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','VERIFIED',1,'a3690000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');

insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99736901","rc_number":"TEST369","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Credit 369 SARL","display_name":"Credit 369 SARL","country_code":"MA","identifiers":{"ICE":"997369000000001","IF":"99736901","RC":"TEST369"}}',1,'a3690000-0000-4000-8000-000000000001');

insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001',1,now()-interval'1 day','a3690000-0000-4000-8000-000000000002','COMPLIANCE_DECISION');

insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f3691000-0000-0000-0000-000000000001','f3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b3690000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3690000-0000-4000-8000-000000000002',clock_timestamp(),'a3690000-0000-4000-8000-000000000001'),
('f3691000-0000-0000-0000-000000000002','f3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b3690000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3690000-0000-4000-8000-000000000002',clock_timestamp(),'a3690000-0000-4000-8000-000000000001');

insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f3692000-0000-0000-0000-000000000001','f3691000-0000-0000-0000-000000000001','b3690000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3693000-0000-0000-0000-000000000001'),
('f3692000-0000-0000-0000-000000000002','f3691000-0000-0000-0000-000000000002','b3690000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3693000-0000-0000-0000-000000000002');

update public.client_compliance_documents set current_scan_result_id=case id
  when 'f3691000-0000-0000-0000-000000000001' then 'f3692000-0000-0000-0000-000000000001'::uuid
  else 'f3692000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f3691000-0000-0000-0000-000000000001','f3691000-0000-0000-0000-000000000002');

insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a3690000-0000-4000-8000-000000000002',clock_timestamp(),'a3690000-0000-4000-8000-000000000001','f3691000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a3690000-0000-4000-8000-000000000002',clock_timestamp(),'a3690000-0000-4000-8000-000000000001','f3691000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');




create temporary table p369(k text primary key,v jsonb);
grant all on p369 to authenticated,service_role;

grant usage on schema extensions to authenticated,service_role;

create function pg_temp.actor369(n integer,aal text default 'aal2')returns void language plpgsql as $$declare actor uuid:=('a3690000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;begin
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal',aal)::text,true);
end$$;

create function pg_temp.service369()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;

set local role authenticated;
select pg_temp.actor369(2);

insert into p369 values('pack',public.create_credit_pack_version('b3690000-0000-4000-8000-000000000001','CREDIT369_EUR','Pack de recette','حزمة الاختبار',3,10001,'EUR',365,'credit369-create-pack'));

select public.activate_credit_pack_version('b3690000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p369 where k='pack'),'credit369-activate-pack');

select pg_temp.actor369(1);

select pg_temp.actor369(2);

insert into p369 values('posting',public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p369 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,'{"cash_account_code":"CREDIT369_CASH_EUR","cash_name_fr":"Trésorerie de recette","cash_name_ar":"خزينة الاختبار","suspense_account_code":"CREDIT369_PENDING_EUR","suspense_name_fr":"Encaissement en attente","suspense_name_ar":"تحصيل قيد المراجعة"}','Mapping synthétique exclusivement pour recette SQL','credit369-posting-policy'));

select pg_temp.actor369(3);

insert into p369 values('posting-approved',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p369 where k='posting'),true,(select v->>'request_hash'from p369 where k='posting'),'Approbation indépendante de recette SQL'));

select pg_temp.actor369(1);

insert into p369 values('prep',public.prepare_credit_pack_payment_intent_v1('b3690000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p369 where k='pack'),'DEMO','DEMO','credit369-checkout'));

insert into p369 values('prep-replay',public.prepare_credit_pack_payment_intent_v1('b3690000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p369 where k='pack'),'DEMO','DEMO','credit369-checkout'));

select pg_temp.actor369(2);

insert into p369 values('posting-revoke',public.request_credit_revenue_policy_revocation_v1((select(v->>'policy_version_id')::uuid from p369 where k='posting'),'Révocation gouvernée après préparation de la recette','credit369-revoke-posting'));

select pg_temp.actor369(3);

insert into p369 values('posting-revoked',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p369 where k='posting-revoke'),true,(select v->>'request_hash'from p369 where k='posting-revoke'),'Approbation indépendante de révocation'));

reset role;
select pg_temp.service369();
set local role service_role;

insert into p369 values('intent',public.register_credit_pack_payment_intent_v1((select(v->>'preparation_id')::uuid from p369 where k='prep'),'DEMO','SYNTHETIC-CREDIT369-ORDER',10001,'EUR'));

insert into p369 values('paid-at',to_jsonb(statement_timestamp()));

insert into p369 values('paid',public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT369-EVENT','SYNTHETIC-CREDIT369-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p369 where k='paid-at'),'SYNTHETIC-CREDIT369-CAPTURE',repeat('a',64),repeat('b',64),'f369c000-0000-4000-8000-000000000001'));

reset role;

select pg_temp.service369();

select pg_temp.actor369(2);

select pg_temp.actor369(1);

insert into p369 values('paid-replay',public.prepare_credit_pack_payment_intent_v1('b3690000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p369 where k='pack'),'DEMO','DEMO','credit369-checkout'));

select pg_temp.actor369(4);

set local role authenticated;

reset role;

select pg_temp.actor369(3);

select set_config('request.jwt.claims','{"sub":"a3690000-0000-4000-8000-000000000003","role":"authenticated"}',true);

select pg_temp.actor369(3,null);

select pg_temp.actor369(5);

update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;

update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;

-- Explicit synthetic fiscal configuration, approved through the real commands.
insert into p369 select'funding',to_jsonb(id)from public.credit_economic_funding_sources_v1 where organization_id='b3690000-0000-4000-8000-000000000001';

set local role authenticated;
select pg_temp.actor369(1);

select pg_temp.actor369(2);

insert into p369 values('billing',public.create_client_billing_policy_v1(jsonb_build_object('series_key','SQL369_FISCAL','version',1,'currency','EUR','tax_rate_bps',2000,'tax_label_fr','Taxe synthétique de recette','tax_label_ar','ضريبة اختبار','jurisdiction','TEST_ONLY','issuer',jsonb_build_object('legal_name','SQL Test Issuer','legal_form','TEST','address','Synthetic SQL fixture address','ice','997369000000002','if_number','99736902','rc_number','SQL369','contact_email','fiscal369@example.invalid'),'invoice_prefix','SQL369I','credit_prefix','SQL369C','invoice_start_number','1','credit_start_number','1','valid_from',(current_date-2)::text,'service_label_fr','Produit de recette uniquement','service_label_ar','منتج اختبار فقط','approval_reference','SYNTHETIC_SQL_NOT_REAL_FISCAL_POLICY'),'credit369-billing-policy'));

select pg_temp.actor369(3);

select public.approve_client_billing_policy_v1((select(v->>'policy_id')::uuid from p369 where k='billing'),true,'Approbation fiscale indépendante de recette','credit369-approve-billing');

select pg_temp.actor369(2);

insert into p369 values('fiscal',public.create_credit_revenue_policy_v1('FISCAL','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p369 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 jsonb_build_object('billing_policy_version_id',(select v->>'policy_id'from p369 where k='billing'),'recognition_accounts',jsonb_build_object('core',jsonb_build_object('code','SQL369_CORE_EUR','name_fr','Core de recette','name_ar','إيراد أساسي للاختبار'),'benefit_pool',jsonb_build_object('code','SQL369_POOL_EUR','name_fr','Pool de recette','name_ar','مجمع اختبار'),'unallocated',jsonb_build_object('code','SQL369_UNALLOC_EUR','name_fr','Crédits achetés non affectés','name_ar','أرصدة مشتراة غير مخصصة'),'tax',jsonb_build_object('code','SQL369_TAX_EUR','name_fr','Taxe de recette due','name_ar','ضريبة اختبار مستحقة'))),'Contexte fiscal de recette explicitement approuvé','credit369-fiscal-context'));

select pg_temp.actor369(3);

select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p369 where k='fiscal'),true,(select v->>'request_hash'from p369 where k='fiscal'),'Revue indépendante contexte fiscal de recette');

select pg_temp.actor369(2);

insert into p369 values('allocation',public.create_credit_revenue_policy_v1('ALLOCATION','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p369 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 '{"purchase_rounding":"CUMULATIVE_FLOOR_REMAINDER","accepted_evidence_kinds":["OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT"],"fulfillment_modes":["MATRICIA_INTERNAL"]}',
 'Politique allocation de recette sans règle de production','credit369-allocation-policy'));

select pg_temp.actor369(3);

select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p369 where k='allocation'),true,(select v->>'request_hash'from p369 where k='allocation'),'Revue indépendante allocation de recette');

insert into p369 values('classified',public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p369 where k='funding')));

reset role;

select pg_temp.actor369(3);
set local role authenticated;

reset role;

-- This regression repeats the native payment/receipt fixture with its own UUID scope.
-- Actual builder/onboarding commands create a clearly labelled DEV franchise,
-- and real benefit operations/independent receipt consume the purchased lot.
insert into public.platform_user_roles(user_id,role_code)values('a3690000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),('a3690000-0000-4000-8000-000000000003','MATRICIA_ADMIN');

insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e3690000-0000-4000-8000-000000000001','SQL369_LIBRARY','sql369-library','b3690000-0000-4000-8000-000000000001','DRAFT','a3690000-0000-4000-8000-000000000002');

set local role authenticated;
select pg_temp.actor369(2);

insert into p369 values('franchise',public.propose_franchise_governance('e3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','FRANCHISEE','SQL369','Territoire TEST uniquement','نطاق اختبار فقط','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{}','credit369-1@example.invalid',repeat('7',64),'fr-MA','{}','Franchise de recette non contractuelle uniquement','credit369-franchise-propose'));

select pg_temp.actor369(3);

select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from p369 where k='franchise'),'APPROVE','Approbation indépendante simulation de recette',1,'credit369-franchise-approve');

select pg_temp.actor369(1);

insert into p369 values('franchise-demo',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from p369 where k='franchise'),repeat('7',64),1,(select(v->>'mandate_version_id')::uuid from p369 where k='franchise'),public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from p369 where k='franchise'))->>'mandateHash',true,'credit369-franchise-simulation'));

select pg_temp.actor369(2);

insert into p369 values('book',public.open_franchise_pnl_book('e3690000-0000-4000-8000-000000000001','b3690000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','EUR',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and status='ACTIVE'order by version desc limit 1),'credit369-book'));

insert into p369 values('benefit',public.create_benefit_version('b3690000-0000-4000-8000-000000000001','CREDIT369_BENEFIT','CONSULTATION','MATRICIA_INTERNAL','Consultation SQL uniquement','استشارة اختبار فقط','Prestation synthétique du contrat SQL','خدمة تجريبية لاختبار SQL',1,1000,0,'EUR','e3690000-0000-4000-8000-000000000001',null,null,'{}','{}','SQL369_CANCELLATION',clock_timestamp()-interval'1 minute','credit369-benefit-create'));

select pg_temp.actor369(3);

select public.activate_benefit_version('b3690000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p369 where k='benefit'),'credit369-benefit-activate');

-- Admission is independently governed too (Provider268060).
select pg_temp.actor369(2);

insert into p369 values('admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p369 where k='benefit')));

insert into p369 values('admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p369 where k='benefit'),(select v->>'source_hash'from p369 where k='admission-context'),(select(v->>'head_id')::uuid from p369 where k='admission-context'),'NONE',null,null,'{}','{}',now()-interval'1 minute',null,'Politique admission synthétique explicitement revue','SQL369_ADMISSION_TEST_ONLY','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','f369a000-0000-4000-8000-000000000001'));

select pg_temp.actor369(3);

select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p369 where k='admission-policy'),(select v->>'content_hash'from p369 where k='admission-policy'),true,'SQL369_INDEPENDENT_APPROVAL','Revue indépendante de la politique admission SQL');

select pg_temp.actor369(1);

insert into p369 values('reserve',public.reserve_benefit_credits('b3690000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p369 where k='paid'),(select(v->>'benefit_version_id')::uuid from p369 where k='benefit'),1,clock_timestamp()+interval'1 day','credit369-reserve'));
-- Fixture owner reaches the admission trigger; runtime actors keep INSERT denied.
-- The verified TEST actor claims remain CLIENT_OWNER/AAL2 for domain checks.
reset role;
select throws_ok($$insert into public.benefit_redemptions(id,organization_id,wallet_id,benefit_version_id,units,credit_cost_snapshot,reserved_credits,status,reservation_expires_at,correlation_id,created_by,created_at,updated_at)
 select 'f369b000-0000-4000-8000-000000000001',organization_id,wallet_id,benefit_version_id,units,credit_cost_snapshot,reserved_credits,'RESERVED',clock_timestamp()+interval'1 day',extensions.gen_random_uuid(),created_by,statement_timestamp()-interval'1 day',statement_timestamp()-interval'1 day'
 from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p369 where k='reserve')$$,
 '22023','INVALID_BENEFIT_ADMISSION_RESERVATION','a seeded historical reservation is refused even when its own organization, wallet and governed benefit are valid');
select throws_ok($$insert into public.benefit_redemptions(id,organization_id,wallet_id,benefit_version_id,units,credit_cost_snapshot,reserved_credits,status,reservation_expires_at,correlation_id,created_by)
 select 'f369b000-0000-4000-8000-000000000002',organization_id,wallet_id,benefit_version_id,units,credit_cost_snapshot,reserved_credits,'IN_PROGRESS',clock_timestamp()+interval'1 day',extensions.gen_random_uuid(),created_by
 from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p369 where k='reserve')$$,
 '22023','INVALID_BENEFIT_ADMISSION_RESERVATION','a historical in-progress seed cannot skip native admission and operational transitions');
select throws_ok($$insert into public.benefit_redemptions(id,organization_id,wallet_id,benefit_version_id,units,credit_cost_snapshot,reserved_credits,status,reservation_expires_at,delivery_proof_hash,correlation_id,created_by)
 select 'f369b000-0000-4000-8000-000000000003',organization_id,wallet_id,benefit_version_id,units,credit_cost_snapshot,reserved_credits,'CONSUMED',clock_timestamp()+interval'1 day',repeat('0',64),extensions.gen_random_uuid(),created_by
 from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p369 where k='reserve')$$,
 '55000','BENEFIT_NATIVE_CLIENT_RECEIPT_REQUIRED','a historical consumed row with a made-up hash cannot create a canonical receipt');
reset role;
select is((select count(*)::integer from public.benefit_redemptions where id in('f369b000-0000-4000-8000-000000000001','f369b000-0000-4000-8000-000000000002','f369b000-0000-4000-8000-000000000003')),0,'all three refused import attempts leave no hidden historical redemption');
select is((select status from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p369 where k='reserve')),'RESERVED','the real current reservation remains unchanged');
select is((select count(*)::integer from public.credit_economic_consumption_facts_v1 where organization_id='b3690000-0000-4000-8000-000000000001'),0,'rejected historical seeds never manufacture economic consumption');
select is((select count(*)::integer from public.franchise_distribution_ledger_entries where book_id=(select(v->>'book_id')::uuid from p369 where k='book')),0,'no distributable balance is invented for the unconsumed purchase');
select ok(private.credit_pack_payment_source_v1((select(v->>'payment_event_id')::uuid from p369 where k='paid'))is not null,'the purchase used for this boundary test has the actual native DEMO capture chain');
select is((select sum(amount_minor)::bigint from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p369 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),8334::bigint,'the exact captured net remains unallocated rather than becoming franchise profit');
select pg_temp.actor369(3);set local role authenticated;
select throws_ok($$select public.close_franchise_profit_period((select(v->>'book_id')::uuid from p369 where k='book'),(clock_timestamp()at time zone'Africa/Casablanca')::date,(clock_timestamp()at time zone'Africa/Casablanca')::date,(select opened_under_rule_version_id from public.franchise_pnl_books where id=(select(v->>'book_id')::uuid from p369 where k='book')),clock_timestamp(),'TEST historical import cannot be replaced by closing an unelapsed current period','TEST369-current-period-denied')$$,
 '22023','INVALID_FRANCHISE_CLOSURE','the inability to import history is not worked around by closing the current civil day');
reset role;
select*from finish();rollback;
