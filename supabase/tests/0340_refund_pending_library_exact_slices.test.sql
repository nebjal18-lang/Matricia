begin;
set local search_path=public,extensions;
select no_plan();
-- Native DEMO payment, independent receipt and real P&L allocation; all triggers enabled.
-- Synthetic test identities and explicit TEST fiscal policies are not production evidence.
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='NON_CONTRACTUAL_SQL_CREDIT_340',configured_at=clock_timestamp()where singleton;
-- SQL authorization/accounting contracts with declared synthetic identities and
-- the native DEMO payment constructor. No PSP signature or physical bytes are
-- certified by this fixture; API verification is tested by the payment owner.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','credit340-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)n;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b3400000-0000-4000-8000-000000000001','Credit 340 SARL','Credit 340 SARL','ACTIVE','a3400000-0000-4000-8000-000000000001'),
('b3400000-0000-4000-8000-000000000004','Other340 SARL','Other340 SARL','ACTIVE','a3400000-0000-4000-8000-000000000004');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','a3400000-0000-4000-8000-000000000001','ACTIVE',now()),
('c3400000-0000-4000-8000-000000000004','b3400000-0000-4000-8000-000000000004','a3400000-0000-4000-8000-000000000004','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c3400000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c3400000-0000-4000-8000-000000000004','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a3400000-0000-4000-8000-000000000002','FINANCE_MANAGER'),('a3400000-0000-4000-8000-000000000003','FINANCE_MANAGER'),('a3400000-0000-4000-8000-000000000005','FINANCE_MANAGER'),('a3400000-0000-4000-8000-000000000005','READ_ONLY_AUDITOR');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b3400000-0000-4000-8000-000000000001','ICE','997340000000001','VERIFIED'),('b3400000-0000-4000-8000-000000000001','IF','99734001','VERIFIED'),('b3400000-0000-4000-8000-000000000001','RC','TEST340','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.

insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','VERIFIED',1,'a3400000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99734001","rc_number":"TEST340","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Credit 340 SARL","display_name":"Credit 340 SARL","country_code":"MA","identifiers":{"ICE":"997340000000001","IF":"99734001","RC":"TEST340"}}',1,'a3400000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001',1,now()-interval'1 day','a3400000-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f3401000-0000-0000-0000-000000000001','f3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b3400000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3400000-0000-4000-8000-000000000002',clock_timestamp(),'a3400000-0000-4000-8000-000000000001'),
('f3401000-0000-0000-0000-000000000002','f3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b3400000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a3400000-0000-4000-8000-000000000002',clock_timestamp(),'a3400000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f3402000-0000-0000-0000-000000000001','f3401000-0000-0000-0000-000000000001','b3400000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3403000-0000-0000-0000-000000000001'),
('f3402000-0000-0000-0000-000000000002','f3401000-0000-0000-0000-000000000002','b3400000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f3403000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f3401000-0000-0000-0000-000000000001' then 'f3402000-0000-0000-0000-000000000001'::uuid
  else 'f3402000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f3401000-0000-0000-0000-000000000001','f3401000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a3400000-0000-4000-8000-000000000002',clock_timestamp(),'a3400000-0000-4000-8000-000000000001','f3401000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a3400000-0000-4000-8000-000000000002',clock_timestamp(),'a3400000-0000-4000-8000-000000000001','f3401000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');




create temporary table p340(k text primary key,v jsonb);grant all on p340 to authenticated,service_role;
grant usage on schema extensions to authenticated,service_role;
create function pg_temp.actor340(n integer,aal text default 'aal2')returns void language plpgsql as $$declare actor uuid:=('a3400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;begin
 perform set_config('request.jwt.claim.sub',actor::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal',aal)::text,true);
end$$;
create function pg_temp.service340()returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claim.role','service_role',true);perform set_config('request.jwt.claims','{"role":"service_role"}',true);end$$;
set local role authenticated;select pg_temp.actor340(2);
insert into p340 values('pack',public.create_credit_pack_version('b3400000-0000-4000-8000-000000000001','CREDIT340_EUR','Pack de recette','حزمة الاختبار',5,10001,'EUR',365,'credit340-create-pack'));
select public.activate_credit_pack_version('b3400000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p340 where k='pack'),'credit340-activate-pack');
select pg_temp.actor340(1);
select pg_temp.actor340(2);
insert into p340 values('posting',public.create_credit_revenue_policy_v1('POSTING','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p340 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,'{"cash_account_code":"CREDIT340_CASH_EUR","cash_name_fr":"Trésorerie de recette","cash_name_ar":"خزينة الاختبار","suspense_account_code":"CREDIT340_PENDING_EUR","suspense_name_fr":"Encaissement en attente","suspense_name_ar":"تحصيل قيد المراجعة"}','Mapping synthétique exclusivement pour recette SQL','credit340-posting-policy'));
select pg_temp.actor340(3);
insert into p340 values('posting-approved',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p340 where k='posting'),true,(select v->>'request_hash'from p340 where k='posting'),'Approbation indépendante de recette SQL'));
select pg_temp.actor340(1);
insert into p340 values('prep',public.prepare_credit_pack_payment_intent_v1('b3400000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p340 where k='pack'),'DEMO','DEMO','credit340-checkout'));
insert into p340 values('prep-replay',public.prepare_credit_pack_payment_intent_v1('b3400000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p340 where k='pack'),'DEMO','DEMO','credit340-checkout'));
select pg_temp.actor340(2);
insert into p340 values('posting-revoke',public.request_credit_revenue_policy_revocation_v1((select(v->>'policy_version_id')::uuid from p340 where k='posting'),'Révocation gouvernée après préparation de la recette','credit340-revoke-posting'));
select pg_temp.actor340(3);
insert into p340 values('posting-revoked',public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p340 where k='posting-revoke'),true,(select v->>'request_hash'from p340 where k='posting-revoke'),'Approbation indépendante de révocation'));
reset role;select pg_temp.service340();set local role service_role;
insert into p340 values('intent',public.register_credit_pack_payment_intent_v1((select(v->>'preparation_id')::uuid from p340 where k='prep'),'DEMO','SYNTHETIC-CREDIT340-ORDER',10001,'EUR'));
insert into p340 values('paid-at',to_jsonb(statement_timestamp()));
insert into p340 values('paid',public.process_verified_credit_pack_payment_v1('DEMO','DEMO','SYNTHETIC-CREDIT340-EVENT','SYNTHETIC-CREDIT340-ORDER','PAYMENT_SUCCEEDED',10001,'EUR',(select(v#>>'{}')::timestamptz from p340 where k='paid-at'),'SYNTHETIC-CREDIT340-CAPTURE',repeat('a',64),repeat('b',64),'f340c000-0000-4000-8000-000000000001'));
reset role;

-- First capture retained its frozen approved mapping after revocation.
select pg_temp.service340();
select pg_temp.actor340(2);
select pg_temp.actor340(1);
insert into p340 values('paid-replay',public.prepare_credit_pack_payment_intent_v1('b3400000-0000-4000-8000-000000000001',(select(v->>'pack_version_id')::uuid from p340 where k='pack'),'DEMO','DEMO','credit340-checkout'));
select pg_temp.actor340(4);
set local role authenticated;
reset role;
select pg_temp.actor340(5);
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
-- Explicit synthetic fiscal configuration, approved through the real commands.
insert into p340 select'funding',to_jsonb(id)from public.credit_economic_funding_sources_v1 where organization_id='b3400000-0000-4000-8000-000000000001';
set local role authenticated;select pg_temp.actor340(1);
select pg_temp.actor340(2);
insert into p340 values('billing',public.create_client_billing_policy_v1(jsonb_build_object('series_key','SQL340_FISCAL','version',1,'currency','EUR','tax_rate_bps',2000,'tax_label_fr','Taxe synthétique de recette','tax_label_ar','ضريبة اختبار','jurisdiction','TEST_ONLY','issuer',jsonb_build_object('legal_name','SQL Test Issuer','legal_form','TEST','address','Synthetic SQL fixture address','ice','997340000000002','if_number','99734002','rc_number','SQL340','contact_email','fiscal340@example.invalid'),'invoice_prefix','SQL340I','credit_prefix','SQL340C','invoice_start_number','1','credit_start_number','1','valid_from',(current_date-2)::text,'service_label_fr','Produit de recette uniquement','service_label_ar','منتج اختبار فقط','approval_reference','SYNTHETIC_SQL_NOT_REAL_FISCAL_POLICY'),'credit340-billing-policy'));
select pg_temp.actor340(3);
select public.approve_client_billing_policy_v1((select(v->>'policy_id')::uuid from p340 where k='billing'),true,'Approbation fiscale indépendante de recette','credit340-approve-billing');
select pg_temp.actor340(2);
insert into p340 values('fiscal',public.create_credit_revenue_policy_v1('FISCAL','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p340 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 jsonb_build_object('billing_policy_version_id',(select v->>'policy_id'from p340 where k='billing'),'recognition_accounts',jsonb_build_object('core',jsonb_build_object('code','SQL340_CORE_EUR','name_fr','Core de recette','name_ar','إيراد أساسي للاختبار'),'benefit_pool',jsonb_build_object('code','SQL340_POOL_EUR','name_fr','Pool de recette','name_ar','مجمع اختبار'),'unallocated',jsonb_build_object('code','SQL340_UNALLOC_EUR','name_fr','Crédits achetés non affectés','name_ar','أرصدة مشتراة غير مخصصة'),'tax',jsonb_build_object('code','SQL340_TAX_EUR','name_fr','Taxe de recette due','name_ar','ضريبة اختبار مستحقة'))),'Contexte fiscal de recette explicitement approuvé','credit340-fiscal-context'));
select pg_temp.actor340(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p340 where k='fiscal'),true,(select v->>'request_hash'from p340 where k='fiscal'),'Revue indépendante contexte fiscal de recette');
select pg_temp.actor340(2);
insert into p340 values('allocation',public.create_credit_revenue_policy_v1('ALLOCATION','CREDIT_PACK',(select(v->>'pack_version_id')::uuid from p340 where k='pack'),null,'EUR','DEVELOPMENT',1,current_date-1,null,
 '{"purchase_rounding":"CUMULATIVE_FLOOR_REMAINDER","accepted_evidence_kinds":["OPERATIONAL_REPORT_WITH_INDEPENDENT_CLIENT_RECEIPT"],"fulfillment_modes":["MATRICIA_INTERNAL"]}',
 'Politique allocation de recette sans règle de production','credit340-allocation-policy'));
select pg_temp.actor340(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p340 where k='allocation'),true,(select v->>'request_hash'from p340 where k='allocation'),'Revue indépendante allocation de recette');
insert into p340 values('classified',public.reconcile_credit_economic_funding_v1((select(v#>>'{}')::uuid from p340 where k='funding')));
reset role;
select pg_temp.actor340(3);set local role authenticated;
reset role;
-- Actual builder/onboarding commands create a clearly labelled DEV franchise,
-- and real benefit operations/independent receipt consume the purchased lot.
insert into public.platform_user_roles(user_id,role_code)values('a3400000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),('a3400000-0000-4000-8000-000000000003','MATRICIA_ADMIN');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e3400000-0000-4000-8000-000000000001','SQL340_LIBRARY','sql340-library','b3400000-0000-4000-8000-000000000001','DRAFT','a3400000-0000-4000-8000-000000000002');
set local role authenticated;select pg_temp.actor340(2);
insert into p340 values('franchise',public.propose_franchise_governance('e3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','FRANCHISEE','SQL340','Territoire TEST uniquement','نطاق اختبار فقط','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{}','credit340-1@example.invalid',repeat('7',64),'fr-MA','{}','Franchise de recette non contractuelle uniquement','credit340-franchise-propose'));
select pg_temp.actor340(3);
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from p340 where k='franchise'),'APPROVE','Approbation indépendante simulation de recette',1,'credit340-franchise-approve');
select pg_temp.actor340(1);
insert into p340 values('franchise-demo',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from p340 where k='franchise'),repeat('7',64),1,(select(v->>'mandate_version_id')::uuid from p340 where k='franchise'),public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from p340 where k='franchise'))->>'mandateHash',true,'credit340-franchise-simulation'));
select pg_temp.actor340(2);
insert into p340 values('book',public.open_franchise_pnl_book('e3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','EUR',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and status='ACTIVE'order by version desc limit 1),'credit340-book'));
insert into p340 values('benefit',public.create_benefit_version('b3400000-0000-4000-8000-000000000001','CREDIT340_BENEFIT','CONSULTATION','MATRICIA_INTERNAL','Consultation SQL uniquement','استشارة اختبار فقط','Prestation synthétique du contrat SQL','خدمة تجريبية لاختبار SQL',1,1000,0,'EUR','e3400000-0000-4000-8000-000000000001',null,null,'{}','{}','SQL340_CANCELLATION',clock_timestamp()-interval'1 minute','credit340-benefit-create'));
select pg_temp.actor340(3);
select public.activate_benefit_version('b3400000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),'credit340-benefit-activate');
-- Admission is independently governed too (Provider268060).
select pg_temp.actor340(2);
insert into p340 values('admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p340 where k='benefit')));
insert into p340 values('admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),(select v->>'source_hash'from p340 where k='admission-context'),(select(v->>'head_id')::uuid from p340 where k='admission-context'),'NONE',null,null,'{}','{}',now()-interval'1 minute',null,'Politique admission synthétique explicitement revue','SQL340_ADMISSION_TEST_ONLY','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','f340a000-0000-4000-8000-000000000001'));
select pg_temp.actor340(3);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p340 where k='admission-policy'),(select v->>'content_hash'from p340 where k='admission-policy'),true,'SQL340_INDEPENDENT_APPROVAL','Revue indépendante de la politique admission SQL');
select pg_temp.actor340(1);
insert into p340 values('reserve',public.reserve_benefit_credits('b3400000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p340 where k='paid'),(select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),1,clock_timestamp()+interval'1 day','credit340-reserve'));
select pg_temp.actor340(2);
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p340 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p340 where k='reserve')),'SCHEDULE',clock_timestamp()-interval'1 second','Planification opérationnelle effective de recette','credit340-schedule');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from p340 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p340 where k='reserve')),'START',null,'Réalisation opérationnelle effective de recette','credit340-start');
insert into p340 values('delivery',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from p340 where k='reserve'),(select row_version from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p340 where k='reserve')),'Compte rendu synthétique du service effectivement exécuté dans ce contrat SQL','SQL340_OPERATIONAL_REPORT',null,'credit340-delivery'));
select pg_temp.actor340(1);
insert into p340 values('receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p340 where k='delivery'),(select v->>'source_hash'from p340 where k='delivery'),(select(v->>'row_version')::bigint from p340 where k='delivery'),true,'Réception indépendante de la prestation de cette recette SQL','credit340-receipt'));
select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p340 where k='reserve'),(select v->>'receipt_hash'from p340 where k='receipt'),'credit340-consume');
reset role;
set local role authenticated;select pg_temp.actor340(2);
insert into p340 values('route',public.create_credit_revenue_policy_v1('BOOK_ROUTE','LIBRARY','e3400000-0000-4000-8000-000000000001','b3400000-0000-4000-8000-000000000001','EUR','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('book_id',(select v->>'book_id'from p340 where k='book'),'franchise_id',(select v->>'franchise_id'from p340 where k='franchise'),'mandate_version_id',(select v->>'active_mandate_version_id'from p340 where k='franchise-demo')),'Affectation explicite bibliothèque client et mandat de recette','credit340-book-route'));
select pg_temp.actor340(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p340 where k='route'),true,(select v->>'request_hash'from p340 where k='route'),'Approbation indépendante du mandat et livre exacts');
insert into p340 values('allocated',public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p340 where k='reserve')));
reset role;
select pg_temp.actor340(3);set local role authenticated;
select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p340 where k='reserve'));
reset role;
create function pg_temp.refund_id()returns uuid language sql as $$select(v->>'redemption_id')::uuid from p340 where k='reserve'$$;
create function pg_temp.refund_version()returns bigint language sql as $$select row_version from public.benefit_redemptions where id=pg_temp.refund_id()$$;
create function pg_temp.request_refund(key text default'refund340-request')returns jsonb language sql as $$select public.request_benefit_refund_v1('b3400000-0000-4000-8000-000000000001',pg_temp.refund_id(),pg_temp.refund_version(),'TEST consumed service dispute requiring independent Finance',key)$$;

-- Return the first exact unit before spending the original lot in two libraries.
set local role authenticated;select pg_temp.actor340(2);
insert into p340 values('refund-policy',public.propose_benefit_refund_policy_v1((select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),86400,'PRESERVE_ORIGINAL_DENY_EXPIRED',now()-interval'1 day',null,'TEST explicit refund terms for cross-library exact recognition'));
select pg_temp.actor340(3);
select public.decide_benefit_refund_policy_v1((select(v->>'policy_id')::uuid from p340 where k='refund-policy'),(select v->>'content_hash'from p340 where k='refund-policy'),true,'TEST independent approval of exact original-lot return');
select pg_temp.actor340(1);
insert into p340 values('refund-request',pg_temp.request_refund());
select pg_temp.actor340(3);
insert into p340 values('refund-execution',public.decide_benefit_refund_v1((select(v->>'request_id')::uuid from p340 where k='refund-request'),(select v->>'content_hash'from p340 where k='refund-request'),true,'TEST independently verified original consumption refund','refund340-execute'));
reset role;
select is((select amount_minor from public.credit_economic_allocations_v1 where allocation_kind='PURCHASE_CONSUMPTION'and consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id=pg_temp.refund_id())),1666::bigint,'original unit retains its exact cumulative-floor value before reversal');
select is((select available from public.client_credit_lot_positions_v1 where id=(select(v->>'credit_lot_id')::uuid from p340 where k='paid')),'5','all five original funded credit positions are available after the real refund');

-- Library A has a real governed franchise, mandate and book but no approved
-- book-route policy yet. Library B already has its approved route above.
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('e3400000-0000-4000-8000-000000000002','SQL340_PENDING_A','sql340-pending-a','b3400000-0000-4000-8000-000000000001','DRAFT','a3400000-0000-4000-8000-000000000002');
set local role authenticated;select pg_temp.actor340(2);
insert into p340 values('franchise-a',public.propose_franchise_governance('e3400000-0000-4000-8000-000000000002','b3400000-0000-4000-8000-000000000001','FRANCHISEE','SQL340_A','Territoire TEST uniquement A','نطاق اختبار فقط أ','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{}','credit340-1@example.invalid',repeat('8',64),'fr-MA','{}','Franchise A de recette non contractuelle uniquement','credit340-franchise-a-propose'));
select pg_temp.actor340(3);
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from p340 where k='franchise-a'),'APPROVE','Approbation indépendante simulation bibliothèque A',1,'credit340-franchise-a-approve');
select pg_temp.actor340(1);
insert into p340 values('franchise-a-demo',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from p340 where k='franchise-a'),repeat('8',64),1,(select(v->>'mandate_version_id')::uuid from p340 where k='franchise-a'),public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from p340 where k='franchise-a'))->>'mandateHash',true,'credit340-franchise-a-simulation'));
select pg_temp.actor340(2);
insert into p340 values('book-a',public.open_franchise_pnl_book('e3400000-0000-4000-8000-000000000002','b3400000-0000-4000-8000-000000000001','STANDARD','FRANCHISEE','EUR',(select id from public.franchise_finance_rule_versions where franchise_type='STANDARD'and status='ACTIVE'order by version desc limit 1),'credit340-book-a'));
insert into p340 values('benefit-a',public.create_benefit_version('b3400000-0000-4000-8000-000000000001','CREDIT340_BENEFIT_A','CONSULTATION','MATRICIA_INTERNAL','Consultation bibliothèque A','استشارة المكتبة أ','Prestation A synthétique du contrat SQL','خدمة أ تجريبية لاختبار SQL',1,1000,0,'EUR','e3400000-0000-4000-8000-000000000002',null,null,'{}','{}','SQL340_CANCELLATION_A',clock_timestamp()-interval'1 minute','credit340-benefit-a-create'));
select pg_temp.actor340(3);
select public.activate_benefit_version('b3400000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p340 where k='benefit-a'),'credit340-benefit-a-activate');
select pg_temp.actor340(2);
insert into p340 values('admission-a-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p340 where k='benefit-a')));
insert into p340 values('admission-a-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p340 where k='benefit-a'),(select v->>'source_hash'from p340 where k='admission-a-context'),(select(v->>'head_id')::uuid from p340 where k='admission-a-context'),'NONE',null,null,'{}','{}',now()-interval'1 minute',null,'Politique admission A synthétique explicitement revue','SQL340_ADMISSION_A_TEST_ONLY','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','f340a000-0000-4000-8000-000000000002'));
select pg_temp.actor340(3);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p340 where k='admission-a-policy'),(select v->>'content_hash'from p340 where k='admission-a-policy'),true,'SQL340_A_INDEPENDENT_APPROVAL','Revue indépendante de la politique admission A SQL');
reset role;
create function pg_temp.consume_library340(p_benefit uuid,p_units bigint,p_key text)returns jsonb language plpgsql as $$
declare reservation jsonb;proposal jsonb;receipt jsonb;redemption uuid;version bigint;begin
 perform pg_temp.actor340(1);
 reservation:=public.reserve_benefit_credits('b3400000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p340 where k='paid'),p_benefit,p_units,clock_timestamp()+interval'1 day',p_key||':reserve');
 redemption:=(reservation->>'redemption_id')::uuid;
 perform pg_temp.actor340(2);select row_version into version from public.benefit_redemptions where id=redemption;
 perform public.advance_benefit_fulfillment_v1(redemption,version,'SCHEDULE',clock_timestamp()-interval'1 second','TEST actual scheduled cross-library service',p_key||':schedule');
 select row_version into version from public.benefit_redemptions where id=redemption;
 perform public.advance_benefit_fulfillment_v1(redemption,version,'START',null,'TEST actual execution of cross-library service',p_key||':start');
 select row_version into version from public.benefit_redemptions where id=redemption;
 proposal:=public.propose_benefit_delivery_v1(redemption,version,'TEST cross-library service actually performed for independent client receipt','TEST_NATIVE_CROSS_LIBRARY_'||p_key,null,p_key||':report');
 perform pg_temp.actor340(1);
 receipt:=public.decide_my_benefit_delivery_v1((proposal->>'proposal_id')::uuid,proposal->>'source_hash',(proposal->>'row_version')::bigint,true,'TEST independently received the actual cross-library service',p_key||':receipt');
 return public.consume_benefit_credits(redemption,receipt->>'receipt_hash',p_key||':consume');
end$$;
set local role authenticated;
insert into p340 values('pending-a',pg_temp.consume_library340((select(v->>'benefit_version_id')::uuid from p340 where k='benefit-a'),2,'credit340-pending-a'));
reset role;
select is((select status from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p340 where k='pending-a')),'CONSUMED','library A consumes two actual credits before its economic mandate route is ready');
select is((select status from public.credit_economic_processing_events_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='pending-a')order by id desc limit 1),'PENDING_MANDATE','library A explicitly awaits an approved economic route');
select is((select count(*)from public.credit_economic_allocations_v1 where consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='pending-a'))),0::bigint,'pending library A has no announced P&L allocation');
set local role authenticated;
insert into p340 values('ready-b',pg_temp.consume_library340((select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),3,'credit340-ready-b'));
reset role;
select is((select amount_minor from public.credit_economic_allocations_v1 where allocation_kind='PURCHASE_CONSUMPTION'and consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='ready-b'))),5001::bigint,'ready library B receives only its own three-position exact share, never pending library A value');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p340 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),3333::numeric,'pending library A exact share remains in the original unallocated funded class');
select is((select coalesce(sum(case effect_type when'REVENUE'then amount_minor when'REVERSAL_REVENUE'then-amount_minor else 0 end),0)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p340 where k='book')),5001::numeric,'library B P&L records its own exact share despite library A pending first');

select is((select private.credit_economic_consumption_slices_v1(id)::text from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='pending-a')),'{[0,2)}','pending A reserves its own immutable original-credit positions despite delayed recognition');
select is((select private.credit_economic_consumption_slices_v1(id)::text from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='ready-b')),'{[2,5)}','ready B is priced only on its own three original-credit positions');

-- Publish A's exact route later, then reconcile in the opposite recognition order.
set local role authenticated;select pg_temp.actor340(2);
insert into p340 values('route-a',public.create_credit_revenue_policy_v1('BOOK_ROUTE','LIBRARY','e3400000-0000-4000-8000-000000000002','b3400000-0000-4000-8000-000000000001','EUR','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('book_id',(select v->>'book_id'from p340 where k='book-a'),'franchise_id',(select v->>'franchise_id'from p340 where k='franchise-a'),'mandate_version_id',(select v->>'active_mandate_version_id'from p340 where k='franchise-a-demo')),'Affectation exacte bibliothèque A après consommation en attente','credit340-book-route-a'));
select pg_temp.actor340(3);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p340 where k='route-a'),true,(select v->>'request_hash'from p340 where k='route-a'),'Approbation indépendante du mandat et livre A exacts');
select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p340 where k='pending-a'));
select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p340 where k='ready-b'));
select public.reconcile_credit_economic_consumption_v1((select(v->>'redemption_id')::uuid from p340 where k='pending-a'));
reset role;
select is((select amount_minor from public.credit_economic_allocations_v1 where allocation_kind='PURCHASE_CONSUMPTION'and consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='pending-a'))),3333::bigint,'late reconciliation attributes the original two-position share to library A');
select is((select amount_minor from public.credit_economic_allocations_v1 where allocation_kind='PURCHASE_CONSUMPTION'and consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='ready-b'))),5001::bigint,'library B immutable recognition is unchanged by A reconciliation');
select is((select coalesce(sum(case effect_type when'REVENUE'then amount_minor when'REVERSAL_REVENUE'then-amount_minor else 0 end),0)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p340 where k='book-a')),3333::numeric,'library A P&L eventually receives its own exact rounded value');
select is((select sum(case when allocation_kind='REVERSAL'then-amount_minor else amount_minor end)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p340 where k='funding')),8334::numeric,'both libraries and the original refund conserve exact original net funding');
select is((select sum(amount_minor)from public.credit_revenue_ledger_v1 where funding_source_id=(select(v#>>'{}')::uuid from p340 where k='funding')and revenue_class='UNALLOCATED_CREDIT_REVENUE'),0::numeric,'all five original paid positions are attributed once with no rounding leak');
select is((select count(*)from public.credit_economic_allocations_v1 where allocation_kind='PURCHASE_CONSUMPTION'and consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id in((select(v->>'redemption_id')::uuid from p340 where k='pending-a'),(select(v->>'redemption_id')::uuid from p340 where k='ready-b')))),2::bigint,'repeated opposite-order reconciliation never duplicates either library allocation');
select ok(not has_function_privilege('authenticated','private.credit_economic_refund_aware_amount_v1(uuid,uuid)','EXECUTE'),'browser cannot choose economic per-fact pricing');
-- Reuse fragmented freed ranges through actual refunds and actual consumption.
-- The two spans [0,1) and [2,3) carry 1666 and 1667 minor units respectively.
set local role authenticated;select pg_temp.actor340(2);
insert into p340 values('refund-policy-a',public.propose_benefit_refund_policy_v1((select(v->>'benefit_version_id')::uuid from p340 where k='benefit-a'),86400,'PRESERVE_ORIGINAL_DENY_EXPIRED',now()-interval'1 day',null,'TEST explicit library A original-credit refund terms'));
select pg_temp.actor340(3);
select public.decide_benefit_refund_policy_v1((select(v->>'policy_id')::uuid from p340 where k='refund-policy-a'),(select v->>'content_hash'from p340 where k='refund-policy-a'),true,'TEST independent library A original-credit refund approval');
reset role;
create function pg_temp.refund_consumption340(p_redemption uuid,p_key text)returns jsonb language plpgsql as $$
declare request jsonb;begin
 perform pg_temp.actor340(1);
 request:=public.request_benefit_refund_v1('b3400000-0000-4000-8000-000000000001',p_redemption,(select row_version from public.benefit_redemptions where id=p_redemption),'TEST exact original consumed-credit ranges returned for independent review',p_key||':request');
 perform pg_temp.actor340(3);
 return public.decide_benefit_refund_v1((request->>'request_id')::uuid,request->>'content_hash',true,'TEST independent verification of exact original consumed-credit slice reversal',p_key||':execute');
end$$;
set local role authenticated;
select pg_temp.refund_consumption340((select(v->>'redemption_id')::uuid from p340 where k='pending-a'),'credit340-return-a');
select pg_temp.refund_consumption340((select(v->>'redemption_id')::uuid from p340 where k='ready-b'),'credit340-return-b');
insert into p340 values('fragment-a1',pg_temp.consume_library340((select(v->>'benefit_version_id')::uuid from p340 where k='benefit-a'),1,'credit340-fragment-a1'));
insert into p340 values('fragment-b1',pg_temp.consume_library340((select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),1,'credit340-fragment-b1'));
insert into p340 values('fragment-a2',pg_temp.consume_library340((select(v->>'benefit_version_id')::uuid from p340 where k='benefit-a'),1,'credit340-fragment-a2'));
insert into p340 values('fragment-b2',pg_temp.consume_library340((select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),2,'credit340-fragment-b2'));
select pg_temp.refund_consumption340((select(v->>'redemption_id')::uuid from p340 where k='fragment-a1'),'credit340-free-span-a1');
select pg_temp.refund_consumption340((select(v->>'redemption_id')::uuid from p340 where k='fragment-a2'),'credit340-free-span-a2');
insert into p340 values('fragment-reused',pg_temp.consume_library340((select(v->>'benefit_version_id')::uuid from p340 where k='benefit'),2,'credit340-fragment-reused'));
reset role;
select is((select private.credit_economic_consumption_slices_v1(id)::text from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='fragment-reused')),'{[0,1),[2,3)}','one native re-consumption owns the two exact disjoint refunded original-credit spans');
select is((select amount_minor from public.credit_economic_allocations_v1 where allocation_kind='PURCHASE_CONSUMPTION'and consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='fragment-reused'))),3333::bigint,'fragmented re-consumption adds exact span values with cumulative-floor rounding');
select is((select allocation_snapshot#>>'{evidence,credit_position_slices}'from public.credit_economic_allocations_v1 where allocation_kind='PURCHASE_CONSUMPTION'and consumption_fact_id in(select id from public.credit_economic_consumption_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p340 where k='fragment-reused'))),'{[0,1),[2,3)}','immutable allocation evidence records the exact disjoint original-credit positions');
select is((select sum(case when allocation_kind='REVERSAL'then-amount_minor else amount_minor end)from public.credit_economic_allocations_v1 where funding_source_id=(select(v#>>'{}')::uuid from p340 where k='funding')),8334::numeric,'fragmented refund and re-consumption still conserve exact original net funding');
select is((select coalesce(sum(case effect_type when'REVENUE'then amount_minor when'REVERSAL_REVENUE'then-amount_minor else 0 end),0)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p340 where k='book-a')),0::numeric,'refunded A spans leave no residual revenue in the original A book');
select is((select coalesce(sum(case effect_type when'REVENUE'then amount_minor when'REVERSAL_REVENUE'then-amount_minor else 0 end),0)from public.franchise_pnl_entries where book_id=(select(v->>'book_id')::uuid from p340 where k='book')),8334::numeric,'B receives exactly the spans of its actual remaining consumptions');
select ok(not has_function_privilege('authenticated','private.credit_economic_consumption_slices_v1(uuid)','EXECUTE'),'browser cannot select or forge original-credit economic positions');
select*from finish();
rollback;
