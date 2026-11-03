begin;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0245',configured_at=clock_timestamp()where singleton;
set local search_path=public,extensions;
-- Synthetic checkout prerequisite, executed through the actual public commands.
-- Two dedicated Finance actors keep content authorship and approval independent;
-- both their fixture identities and the resulting audit/outbox roll back below.
create function pg_temp.seed_approved_box_checkout(
  p_organization_id uuid, p_plan_version_id uuid, p_rollover_months integer default 3
) returns void language plpgsql as $$
declare
  author_id uuid := 'ff850000-0000-4000-8000-000000000001';
  reviewer_id uuid := 'ff850000-0000-4000-8000-000000000002';
  prior_sub text := current_setting('request.jwt.claim.sub', true);
  prior_claims text := current_setting('request.jwt.claims', true);
  plan public.subscription_plan_versions%rowtype;
  benefit jsonb; box jsonb; rule jsonb; approval_context jsonb;
  fixture_key text := 'checkout-fixture-' || p_plan_version_id::text;
begin
  select * into strict plan from public.subscription_plan_versions where id = p_plan_version_id;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(author_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','box-checkout-author@example.invalid','',now(),'{}','{}',now(),now()),
        (reviewer_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','box-checkout-reviewer@example.invalid','',now(),'{}','{}',now(),now())
  on conflict (id) do nothing;
  insert into public.platform_user_roles(user_id,role_code) values(author_id,'FINANCE_MANAGER'),(reviewer_id,'FINANCE_MANAGER') on conflict do nothing;
  perform set_config('request.jwt.claim.sub',author_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',author_id,'role','authenticated','aal','aal2')::text,true);
  benefit := public.create_benefit_version(p_organization_id,'CHECKOUT_FIXTURE_BENEFIT','CREDIT_SERVICE','MATRICIA_INTERNAL',
    'Avantage synthétique de recette','ميزة اختبار اصطناعية','Prérequis de recette uniquement','شرط للاختبار فقط',
    1,0,0,plan.currency,null,null,null,'{}','{}','TEST_ONLY_CHECKOUT',clock_timestamp()-interval '1 minute',fixture_key||'-benefit');
  perform public.activate_benefit_version(p_organization_id,(benefit->>'benefit_version_id')::uuid,fixture_key||'-benefit-active');
  box := public.create_box_version(p_organization_id,'CHECKOUT_FIXTURE_BOX','FIXED','Box synthétique de recette','صندوق اختبار اصطناعي',
    plan.monthly_credit_grant,p_rollover_months,'{}',0,0,0,plan.currency,clock_timestamp()-interval '1 minute',
    jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,
      'allowed_benefit_version_ids',jsonb_build_array(benefit->>'benefit_version_id'))),fixture_key||'-box');
  perform public.activate_box_version(p_organization_id,(box->>'box_version_id')::uuid,null,fixture_key||'-box-active');
  rule := public.link_plan_box_rule(p_organization_id,p_plan_version_id,(box->>'box_version_id')::uuid,
    '{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"AT_MOST"}',clock_timestamp()-interval '1 minute',fixture_key||'-rule');
  approval_context := public.get_box_configuration_approval_context_v1((rule->>'plan_box_rule_id')::uuid);
  perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer_id,'role','authenticated','aal','aal2')::text,true);
  perform public.approve_box_configuration_v1((rule->>'plan_box_rule_id')::uuid,approval_context->>'source_hash',
    'TEST ONLY independent approval of synthetic checkout terms',fixture_key||'-approve');
  perform set_config('request.jwt.claim.sub',coalesce(prior_sub,''),true);
  perform set_config('request.jwt.claims',coalesce(prior_claims,'{}'),true);
end;
$$;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2450000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-245@example.invalid','',now(),'{}','{}',now(),now()),
('a2450000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-245@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2450000-0000-4000-8000-000000000001','Payment 245 SARL','Payment 245','ACTIVE','a2450000-0000-4000-8000-000000000001'),
('b2450000-0000-4000-8000-000000000002','Other 245 SARL','Other 245','ACTIVE','a2450000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2450000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001','a2450000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2450000-0000-4000-8000-000000000002','b2450000-0000-4000-8000-000000000002','a2450000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c2450000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2450000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d2450000-0000-4000-8000-000000000001','PREMIUM','ACTIVE','a2450000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2450000-0000-4000-8000-000000000002','d2450000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a2450000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2450000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2450000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a2450000-0000-4000-8000-000000000002','FINANCE_MANAGER');

select pg_temp.seed_approved_box_checkout('b2450000-0000-4000-8000-000000000001','d2450000-0000-4000-8000-000000000002',3);
create temporary table p245(k text primary key,v jsonb);

insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2450000-0000-4000-8000-000000000001','d2450000-0000-4000-8000-000000000002','FUNDING_PROBE',true);
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting245(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2450000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING245_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING245_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0245','funding245-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0245');
end$$;
select pg_temp.approve_posting245('DEVELOPMENT');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p245 values('prep',public.prepare_subscription_payment_intent_v2('b2450000-0000-4000-8000-000000000001','d2450000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','funding245-demo-prepare'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p245 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p245 where k='prep'),'DEMO','SYNTHETIC-CLONE-DEMO-ORDER-245',12345,'EUR'));
insert into p245 values('paid',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-DEMO-EVENT-245','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-DEMO-CAPTURE-245',repeat('d',64),repeat('e',64)));
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

select ok(private.subscription_payment_cycle_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-245'))is not null,'canonical DEMO fixture binds its real intent, cycle and balanced journal');
select ok(private.subscription_payment_funding_environment_compatible_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-245')),'explicit DEVELOPMENT admits its DEMO fixture');
select ok(public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','FUNDING_PROBE'),'paid fixture grants its financed plan feature in DEVELOPMENT');
select ok(private.client_may_open_new_service_request('b2450000-0000-4000-8000-000000000001'),'compatible current fixture can start a new request');
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2450000-0000-4000-8000-000000000001','d2450000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','funding245-active-second-payment')$$,'55000','SUBSCRIPTION_NOT_ACTIVATABLE','ACTIVE cannot order another unactivatable payment before external money calls');
select is(public.prepare_subscription_payment_intent_v2('b2450000-0000-4000-8000-000000000001','d2450000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','funding245-demo-prepare')->>'preparation_id',(select v->>'preparation_id'from p245 where k='prep'),'authenticated replay retains the original preparation rather than creating another payable order');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select set_config('matricia.environment','DEVELOPMENT',true);
select ok(not private.subscription_payment_funding_environment_compatible_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-245')),'caller hint cannot make a DEMO capture real in PRODUCTION');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','FUNDING_PROBE'),'retagged DEMO does not grant paid features');
select ok(not private.client_may_open_new_service_request('b2450000-0000-4000-8000-000000000001'),'retagged DEMO does not fund a new request');
select is(public.get_client_subscription_funding_v1('b2450000-0000-4000-8000-000000000001')->>'status','PAYMENT_FUNDING_REVIEW_REQUIRED','projection reports review without relabelling the original payment');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,status,created_by)values('f2450000-0000-4000-8000-000000000001','FUNDING245','funding245','b2450000-0000-4000-8000-000000000001','DRAFT','a2450000-0000-4000-8000-000000000001');
select throws_ok($$insert into public.service_requests(client_organization_id,library_id,status,created_by)values('b2450000-0000-4000-8000-000000000001','f2450000-0000-4000-8000-000000000001','DRAFT','a2450000-0000-4000-8000-000000000001')$$,'55000','SUBSCRIPTION_CURRENT_FUNDING_REQUIRED','direct insertion cannot bypass the same admission guard');
select is((select count(*)from public.subscription_cycles where organization_id='b2450000-0000-4000-8000-000000000001'),1::bigint,'refusals preserve the original immutable cycle');
select is((select count(*)from public.financial_journals where organization_id='b2450000-0000-4000-8000-000000000001'and journal_type='SUBSCRIPTION_PAYMENT'),1::bigint,'refusals preserve the original balanced accounting journal');
update private.admin_execution_environment_v1 set environment=null where singleton;
select ok(not private.subscription_payment_funding_environment_compatible_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-245')),'unknown trusted deployment never admits paid funding');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
-- Second real SQL command chain emulates a verified LIVE callback, without contacting a provider.
select pg_temp.approve_posting245('PRODUCTION');
insert into public.subscriptions(id,organization_id,status)values('e2450000-0000-4000-8000-000000000002','b2450000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p245 values('live-prep',public.prepare_subscription_payment_intent_v2('b2450000-0000-4000-8000-000000000002','d2450000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','LIVE','funding245-live-prepare'));
-- A payable legacy order prepared before durable coordination existed. The private predecessor
-- constructs its real immutable source; this is not a new public checkout permitted by 268001.
insert into p245 values('live-other-prep',private.prepare_subscription_payment_admission_v1('b2450000-0000-4000-8000-000000000002','d2450000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','funding245-live-other-prepare','LIVE',false));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p245 values('live-intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p245 where k='live-prep'),'LIVE','SYNTHETIC-CLONE-LIVE-ORDER-245',12345,'EUR'));
insert into p245 values('live-other-intent',private.register_subscription_intent_before_coordination_v2((select(v->>'preparation_id')::uuid from p245 where k='live-other-prep'),'LIVE','SYNTHETIC-CLONE-OTHER-ORDER-245',12345,'EUR'));
insert into p245 values('live-paid',public.process_verified_subscription_payment_v2('PAYPAL','LIVE','SYNTHETIC-LIVE-EVENT-245','SYNTHETIC-CLONE-LIVE-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-LIVE-CAPTURE-245',repeat('1',64),repeat('2',64)));
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select ok(private.subscription_payment_funding_environment_compatible_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-LIVE-EVENT-245')),'canonical LIVE fixture has compatible production funding');
select ok(public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000002','FUNDING_PROBE'),'paid rights follow the canonical LIVE-funded plan snapshot');
select ok(private.client_may_open_new_service_request('b2450000-0000-4000-8000-000000000002'),'canonical current LIVE cycle preserves request admission');
select is(public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p245 where k='live-intent'),'LIVE')->>'replayed','true','already-paid capture resolves its verified receipt without another provider capture');
select throws_ok($$select public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p245 where k='live-other-intent'),'LIVE')$$,'55000','SUBSCRIPTION_NOT_ACTIVATABLE','another unpaid order cannot capture after a different order activates the subscription');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000002','FUNDING_PROBE',clock_timestamp()-interval'1 month'),'paid entitlement is unavailable before the exact funded period');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000002','FUNDING_PROBE',clock_timestamp()+interval'2 months'),'paid entitlement is unavailable after the exact funded period');
insert into public.subscription_plans(id,code,status,created_by)values('d2450000-0000-4000-8000-000000000003','GOLD','ACTIVE','a2450000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)values('d2450000-0000-4000-8000-000000000004','d2450000-0000-4000-8000-000000000003',1,'ACTIVE','EUR',45678,456780,100,5000,5000,'{}',current_date-1,repeat('3',64),'a2450000-0000-4000-8000-000000000001');
insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2450000-0000-4000-8000-000000000003','d2450000-0000-4000-8000-000000000004','HIGH_TIER_ONLY',true);
select throws_ok($$select public.change_subscription_plan('e2450000-0000-4000-8000-000000000002','d2450000-0000-4000-8000-000000000004','UPGRADE_IMMEDIATE','funding245-unpaid-upgrade')$$,'55000','SUBSCRIPTION_UPGRADE_CHECKOUT_REQUIRED','legacy immediate upgrade cannot invent new payment or proration');
select is((select plan_version_id from public.subscriptions where id='e2450000-0000-4000-8000-000000000002'),'d2450000-0000-4000-8000-000000000002'::uuid,'refused upgrade changes no plan');
-- A legacy mutable pointer is emulated only; no cycle/payment/journal is changed or fabricated.
update public.subscriptions set plan_version_id='d2450000-0000-4000-8000-000000000004'where id='e2450000-0000-4000-8000-000000000002';
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000002','HIGH_TIER_ONLY'),'legacy mutable plan cannot inherit unfinanced high-tier features');
select ok(public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000002','FUNDING_PROBE'),'funded original plan features remain available despite that pointer');
update public.subscriptions set plan_version_id='d2450000-0000-4000-8000-000000000002'where id='e2450000-0000-4000-8000-000000000002';
insert into p245 values('next-plan',public.change_subscription_plan('e2450000-0000-4000-8000-000000000002','d2450000-0000-4000-8000-000000000004','DOWNGRADE_NEXT_CYCLE','funding245-scheduled-plan'));
select is((select pending_plan_version_id from public.subscriptions where id='e2450000-0000-4000-8000-000000000002'),'d2450000-0000-4000-8000-000000000004'::uuid,'next-cycle choice is recorded without granting current-period features');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000002','HIGH_TIER_ONLY'),'a pending next-cycle plan has no immediate entitlement');
select is(public.change_subscription_plan('e2450000-0000-4000-8000-000000000002','d2450000-0000-4000-8000-000000000004','DOWNGRADE_NEXT_CYCLE','funding245-scheduled-plan'),(select v from p245 where k='next-plan'),'authenticated schedule retry returns the same fact');
select is(public.get_client_subscription_funding_v1('b2450000-0000-4000-8000-000000000002')#>>'{funded_cycle,funded_plan_version_id}','d2450000-0000-4000-8000-000000000002','funding projection exposes the exact paid snapshot');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select ok(private.subscription_payment_funding_environment_compatible_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-LIVE-EVENT-245')),'a verified LIVE source is not reclassified as unreal after infrastructure promotion');
insert into public.organization_identifiers(organization_id,identifier_type,normalized_value,verification_status)values('b2450000-0000-4000-8000-000000000001','ICE','997245000000001','VERIFIED'),('b2450000-0000-4000-8000-000000000001','IF','99724501','VERIFIED'),('b2450000-0000-4000-8000-000000000001','RC','TEST245','VERIFIED');
-- Pre-existing verified profile and qualification setup. No eligibility stub.
insert into public.client_compliance_cases(id,organization_id,status,current_profile_version,created_by,verified_at,activated_at)values('f2490000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001','VERIFIED',1,'a2450000-0000-4000-8000-000000000001',now()-interval'1 day',now()-interval'1 day');
insert into public.client_profile_versions(compliance_case_id,organization_id,version,profile_data,organization_snapshot,source_organization_row_version,created_by)values('f2490000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001',1,'{"legal_form":"SARL","if_number":"99724501","rc_number":"TEST245","registered_city":"Casablanca","registered_address":{"line1":"TEST Client registered address","country_code":"MA"}}','{"legal_name":"Payment 245 SARL","display_name":"Payment 245 SARL","country_code":"MA","identifiers":{"ICE":"997245000000001","IF":"99724501","RC":"TEST245"}}',1,'a2450000-0000-4000-8000-000000000001');
insert into public.client_identity_verification_history(compliance_case_id,organization_id,profile_version,verified_at,verified_by,source)values('f2490000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001',1,now()-interval'1 day','a2450000-0000-4000-8000-000000000002','COMPLIANCE_DECISION');
insert into public.client_compliance_documents(
  id,compliance_case_id,organization_id,document_type,version,policy_version_id,
  document_number,issuer,issued_on,expires_on,original_file_name,file_extension,
  declared_mime_type,declared_size_bytes,declared_sha256,storage_object_path,
  detected_mime_type,detected_size_bytes,status,uploaded_at,reviewed_by,reviewed_at,created_by
) values
('f2491000-0000-0000-0000-000000000001','f2490000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT',1,(select id from public.client_document_policy_versions where document_type='REGISTRATION_DOCUMENT' and status='ACTIVE'),'RC-A','Tribunal',current_date-30,current_date+365,'registration-a.pdf','pdf','application/pdf',128,repeat('a',64),'b2450000-0000-4000-8000-000000000001/client-a/registration.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a2450000-0000-4000-8000-000000000002',clock_timestamp(),'a2450000-0000-4000-8000-000000000001'),
('f2491000-0000-0000-0000-000000000002','f2490000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY',1,(select id from public.client_document_policy_versions where document_type='REPRESENTATIVE_AUTHORITY' and status='ACTIVE'),'AUTH-A','Notaire',current_date-30,current_date+365,'authority-a.pdf','pdf','application/pdf',128,repeat('b',64),'b2450000-0000-4000-8000-000000000001/client-a/authority.pdf','application/pdf',128,'VERIFIED',clock_timestamp(),'a2450000-0000-4000-8000-000000000002',clock_timestamp(),'a2450000-0000-4000-8000-000000000001');
insert into private.client_document_scan_results(
  id,document_id,organization_id,sequence,result,engine_code,engine_version,computed_sha256,
  detected_mime_type,detected_size_bytes,observed_claims,recorded_by,scanner_principal,correlation_id
) values
('f2492000-0000-0000-0000-000000000001','f2491000-0000-0000-0000-000000000001','b2450000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('a',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2493000-0000-0000-0000-000000000001'),
('f2492000-0000-0000-0000-000000000002','f2491000-0000-0000-0000-000000000002','b2450000-0000-4000-8000-000000000001',1,'CLEAN','DEMO_SCANNER','1.0',repeat('b',64),'application/pdf',128,'{}',null,'SUPABASE_SERVICE_ROLE','f2493000-0000-0000-0000-000000000002');
update public.client_compliance_documents set current_scan_result_id=case id
  when 'f2491000-0000-0000-0000-000000000001' then 'f2492000-0000-0000-0000-000000000001'::uuid
  else 'f2492000-0000-0000-0000-000000000002'::uuid end,scan_status='CLEAN',scanned_at=clock_timestamp()
where id in ('f2491000-0000-0000-0000-000000000001','f2491000-0000-0000-0000-000000000002');
insert into public.client_compliance_evidence(
  compliance_case_id,organization_id,evidence_type,object_path,file_sha256,review_status,
  reviewed_by,reviewed_at,created_by,source_document_id,valid_until,validation_state
) values
('f2490000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001','REGISTRATION_DOCUMENT','compliance/client-a/registration.pdf',repeat('a',64),'VERIFIED','a2450000-0000-4000-8000-000000000002',clock_timestamp(),'a2450000-0000-4000-8000-000000000001','f2491000-0000-0000-0000-000000000001',current_date+365,'SCANNED_CLEAN'),
('f2490000-0000-4000-8000-000000000001','b2450000-0000-4000-8000-000000000001','REPRESENTATIVE_AUTHORITY','compliance/client-a/authority.pdf',repeat('b',64),'VERIFIED','a2450000-0000-4000-8000-000000000002',clock_timestamp(),'a2450000-0000-4000-8000-000000000001','f2491000-0000-0000-0000-000000000002',current_date+365,'SCANNED_CLEAN');



insert into public.client_trials(organization_id,compliance_case_id,verified_profile_version,status,trial_started_at,trial_ends_at,activated_by)values('b2450000-0000-4000-8000-000000000001','f2490000-0000-4000-8000-000000000001',1,'TRIAL_ACTIVE',statement_timestamp()-interval'1 day',statement_timestamp()+interval'29 days','a2450000-0000-4000-8000-000000000002');
insert into public.trial_entitlement_versions(entitlement_code,version,status,enabled,effective_from,content_hash,created_by)values('FUNDING_TRIAL',1,'ACTIVE',true,clock_timestamp()-interval'1 day',repeat('5',64),'a2450000-0000-4000-8000-000000000002');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok(private.client_identity_allows_new_operations('b2450000-0000-4000-8000-000000000001'),'trial fixture uses actual verified identity and clean reviewed evidence');
select ok(public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','FUNDING_TRIAL'),'genuine active trial retains its own approved feature despite incompatible DEMO paid history');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','FUNDING_PROBE'),'that trial does not inherit the unfinanced paid feature');
select ok(private.client_may_open_new_service_request('b2450000-0000-4000-8000-000000000001'),'genuine unexpired trial preserves new-request admission');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','FUNDING_TRIAL',clock_timestamp()+interval'31 days'),'expired trial cannot fall through to incompatible paid funding');
select ok(private.client_may_open_new_service_request('ffffffff-ffff-4fff-8fff-ffffffffffff'),'missing subscription alone does not invent an onboarding block');
select ok(not has_function_privilege('authenticated','private.subscription_payment_funding_environment_compatible_v1(bigint)','EXECUTE')and not has_function_privilege('service_role','private.subscription_payment_cycle_v1(bigint)','EXECUTE'),'funding proof routines have no caller-supplied private API grant');
select*from finish();rollback;
