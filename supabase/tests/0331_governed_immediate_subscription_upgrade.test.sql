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
  benefit jsonb; box jsonb; rule jsonb; approval_context jsonb; admission jsonb;
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
  benefit := public.create_benefit_version(p_organization_id,'CHECKOUT_BENEFIT_'||right(replace(p_plan_version_id::text,'-',''),12),'CREDIT_SERVICE','MATRICIA_INTERNAL',
    'Avantage synthétique de recette','ميزة اختبار اصطناعية','Prérequis de recette uniquement','شرط للاختبار فقط',
    1,0,0,plan.currency,null,null,null,'{}','{}','TEST_ONLY_CHECKOUT',clock_timestamp()-interval '1 minute',fixture_key||'-benefit');
  perform public.activate_benefit_version(p_organization_id,(benefit->>'benefit_version_id')::uuid,fixture_key||'-benefit-active');
  admission:=public.propose_benefit_admission_policy_v1((benefit->>'benefit_version_id')::uuid,private.canonical_request_hash(private.benefit_admission_source_v1((benefit->>'benefit_version_id')::uuid)),null,'NONE',null,null,'{}','{}',clock_timestamp()-interval'1 minute',null,'TEST ONLY source admission for upgrade','TEST-0331-ADMISSION','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid());
  perform set_config('request.jwt.claim.sub',reviewer_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer_id,'role','authenticated','aal','aal2')::text,true);
  perform public.decide_benefit_admission_policy_v1((admission->>'policy_id')::uuid,admission->>'content_hash',true,'TEST-0331-REVIEW','TEST ONLY independent benefit approval');
  perform set_config('request.jwt.claim.sub',author_id::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',author_id,'role','authenticated','aal','aal2')::text,true);
  box := public.create_box_version(p_organization_id,'CHECKOUT_BOX_'||right(replace(p_plan_version_id::text,'-',''),12),'FIXED','Box synthétique de recette','صندوق اختبار اصطناعي',
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
create function pg_temp.approve_posting245(target_environment text,target_plan uuid default'd2450000-0000-4000-8000-000000000002')returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION',target_plan,null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING245_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING245_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0245','funding245-posting-'||lower(target_environment)||':'||target_plan::text);
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

-- The only payment actor is the existing explicit DEV/SANDBOX trusted SQL port;
-- no external provider is contacted and every fixture rolls back.
create temporary table u331(k text primary key,v jsonb);
insert into public.subscription_plans(id,code,status,created_by)values('d3310000-0000-4000-8000-000000000001','GOLD','ACTIVE','a2450000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d3310000-0000-4000-8000-000000000002','d3310000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',24690,246900,20,5000,5000,'{}',current_date-1,repeat('b',64),'a2450000-0000-4000-8000-000000000001');
insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d3310000-0000-4000-8000-000000000001','d3310000-0000-4000-8000-000000000002','UPGRADE_TARGET_FEATURE',true);
select pg_temp.seed_approved_box_checkout('b2450000-0000-4000-8000-000000000001','d3310000-0000-4000-8000-000000000002',3);
select pg_temp.approve_posting245('DEVELOPMENT','d3310000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok(private.subscription_payment_cycle_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-245'))is not null,'source is a canonical paid cycle');
select is(jsonb_array_length(public.list_client_subscription_upgrade_options_v1('b2450000-0000-4000-8000-000000000001')->'options'),0,'no upgrade policy is invented or published automatically');
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2450000-0000-4000-8000-000000000001','d3310000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','upgrade331-generic-bypass')$$,'55000','SUBSCRIPTION_NOT_ACTIVATABLE','ordinary checkout cannot bypass the active-cycle guard');
insert into u331 values('policy',public.propose_subscription_upgrade_policy_v1('d2450000-0000-4000-8000-000000000002','d3310000-0000-4000-8000-000000000002','MONTHLY','TEST ONLY approved restart at full price, no automatic refund; original paid credits retain their schedules.','شروط اختبار فقط: فترة جديدة بالسعر الكامل دون استرداد آلي مع الحفاظ على الأرصدة المدفوعة.',clock_timestamp()-interval'1 minute',null,900,'TEST-0331-POLICY-REFERENCE'));
select throws_ok($$select public.decide_subscription_upgrade_policy_v1((select(v->>'policy_id')::uuid from u331 where k='policy'),(select v->>'content_hash'from u331 where k='policy'),true,'TEST ONLY self review forbidden')$$,'42501','UPGRADE_POLICY_INDEPENDENT_REVIEW_REQUIRED','policy author cannot activate their own commercial rule');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_subscription_upgrade_policy_v1((select(v->>'policy_id')::uuid from u331 where k='policy'),(select v->>'content_hash'from u331 where k='policy'),true,'TEST ONLY independently approved restart');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.create_client_subscription_upgrade_quote_v1('b2450000-0000-4000-8000-000000000001',(select(v->>'policy_id')::uuid from u331 where k='policy'),'upgrade331-aal1')$$,'42501','UPGRADE_QUOTE_DENIED','AAL1 cannot create a payable upgrade');
select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into u331 values('quote',public.create_client_subscription_upgrade_quote_v1('b2450000-0000-4000-8000-000000000001',(select(v->>'policy_id')::uuid from u331 where k='policy'),'upgrade331-quote'));
select is((select v->>'amount_minor'from u331 where k='quote'),'24690','server quotes exact full target price without a guessed proration');
select is((select v#>>'{snapshot,paid_credits_treatment}'from u331 where k='quote'),'PRESERVE_ORIGINAL_SCHEDULES_AND_EXPIRIES','paid old credits keep their acquired schedule and expiry');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','UPGRADE_TARGET_FEATURE'),'quote does not grant unpaid target rights');
select throws_ok($$select public.prepare_client_subscription_upgrade_payment_v1('b2450000-0000-4000-8000-000000000001',(select(v->>'quote_id')::uuid from u331 where k='quote'),(select v->>'content_hash'from u331 where k='quote'),false,'PAYPAL','SANDBOX','upgrade331-checkout')$$,'22023','UPGRADE_TERMS_CONSENT_REQUIRED','full-price restart requires explicit acceptance');
select throws_ok($$select public.prepare_client_subscription_upgrade_payment_v1('b2450000-0000-4000-8000-000000000001',(select(v->>'quote_id')::uuid from u331 where k='quote'),repeat('f',64),true,'PAYPAL','SANDBOX','upgrade331-checkout')$$,'42501','UPGRADE_QUOTE_SCOPE_DENIED','acceptance hash binds exactly the quoted terms');
insert into u331 values('preparation',public.prepare_client_subscription_upgrade_payment_v1('b2450000-0000-4000-8000-000000000001',(select(v->>'quote_id')::uuid from u331 where k='quote'),(select v->>'content_hash'from u331 where k='quote'),true,'PAYPAL','SANDBOX','upgrade331-checkout'));
select is((select v->>'create_authorized'from u331 where k='preparation'),'true','new approved source durably authorizes one PSP creation');
select ok(not exists(select 1 from private.subscription_upgrade_admission_context_v1),'transaction-private admission capability is removed before returning');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','UPGRADE_TARGET_FEATURE'),'payable preparation still grants no rights');
select is(public.prepare_client_subscription_upgrade_payment_v1('b2450000-0000-4000-8000-000000000001',(select(v->>'quote_id')::uuid from u331 where k='quote'),(select v->>'content_hash'from u331 where k='quote'),true,'PAYPAL','SANDBOX','upgrade331-checkout')->>'create_authorized','false','replay cannot authorize a second external order');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into u331 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from u331 where k='preparation'),'SANDBOX','SYNTHETIC-UPGRADE-ORDER-0331',24690,'EUR'));
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from u331 where k='intent'),'SANDBOX')$$,'native capture can prepare only the accepted source-bound upgrade');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into u331 values('time',jsonb_build_object('paid_at',clock_timestamp()));
insert into u331 values('paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-UPGRADE-EVENT-0331','SYNTHETIC-UPGRADE-ORDER-0331','PAYMENT_SUCCEEDED',24690,'EUR',(select(v->>'paid_at')::timestamptz from u331 where k='time'),'SYNTHETIC-UPGRADE-CAPTURE-0331',repeat('3',64),repeat('4',64)));
select is((select v->>'outcome'from u331 where k='paid'),'SUBSCRIPTION_ACTIVATED','only verified paid source activates the new period');
select is((select count(*)::integer from public.subscription_cycles where organization_id='b2450000-0000-4000-8000-000000000001'),2,'new upgrade appends a cycle without rewriting the paid source cycle');
select is((select count(*)::integer from private.subscription_upgrade_applications_v1 where organization_id='b2450000-0000-4000-8000-000000000001'),1,'source cycle, target cycle, policy and journal have one immutable application proof');
select is((select amount_minor from public.subscription_cycles where organization_id='b2450000-0000-4000-8000-000000000001'and cycle_number=1),12345::bigint,'original paid amount remains immutable');
select ok(private.subscription_payment_cycle_v1((select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-UPGRADE-EVENT-0331'))is not null,'upgraded payment is still canonically funded by exact target price, intent, journal and cycle');
insert into u331 values('replay',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-UPGRADE-EVENT-0331','SYNTHETIC-UPGRADE-ORDER-0331','PAYMENT_SUCCEEDED',24690,'EUR',(select(v->>'paid_at')::timestamptz from u331 where k='time'),'SYNTHETIC-UPGRADE-CAPTURE-0331',repeat('3',64),repeat('4',64)));
select is((select v->>'replayed'from u331 where k='replay'),'true','verified event replay is acknowledged without a second debit or cycle');
select is((select count(*)::integer from public.subscription_cycles where organization_id='b2450000-0000-4000-8000-000000000001'),2,'replayed upgrade creates no extra paid cycle');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok(public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','UPGRADE_TARGET_FEATURE'),'target rights follow the verified new funding');
select is(private.current_subscription_funding_v1('b2450000-0000-4000-8000-000000000001')->>'funded_plan_version_id','d3310000-0000-4000-8000-000000000002','funded plan is the actual paid target version');
select ok(not has_function_privilege('authenticated','private.subscription_upgrade_admission_context_valid_v1(uuid,uuid)','execute'),'browser cannot manufacture a transaction capability');
select ok(not has_table_privilege('authenticated','private.subscription_upgrade_checkouts_v1','insert'),'browser cannot forge source-bound checkout evidence');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.discover_subscription_credit_jobs_v1(10);
create temporary table jobs331(job jsonb);
insert into jobs331 select*from public.claim_subscription_credit_jobs_v1('f3310000-0000-4000-8000-000000000001',5,120);
select public.execute_subscription_credit_job_v1((job->>'job_id')::uuid,(job->>'worker_id')::uuid,(job->>'lease_token')::uuid,(job->>'row_version')::bigint)from jobs331;
select is((select count(*)::integer from public.credit_lot_payment_sources_v1 s join public.credit_lots l on l.id=s.credit_lot_id where l.organization_id='b2450000-0000-4000-8000-000000000001'),2,'old and new genuinely paid monthly grants are independently source-bound');
select is((select sum(quantity)::text from public.credit_lots where organization_id='b2450000-0000-4000-8000-000000000001'),'30','only the old paid ten plus the new paid twenty credits are granted');
select public.discover_subscription_credit_jobs_v1(10);
select is((select count(*)::integer from public.claim_subscription_credit_jobs_v1('f3310000-0000-4000-8000-000000000001',5,120)),0,'repeated discovery creates no duplicate credit job');
select *from finish();
rollback;
