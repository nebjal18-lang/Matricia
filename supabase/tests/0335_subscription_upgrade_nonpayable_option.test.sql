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
insert into p245 values('paid',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-DEMO-EVENT-245','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp()-interval'2 minutes','SYNTHETIC-DEMO-CAPTURE-245',repeat('d',64),repeat('e',64)));
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

-- The only payment actor is the existing explicit DEV/SANDBOX trusted SQL port;
-- no external provider is contacted and every fixture rolls back.
create temporary table u331(k text primary key,v jsonb);
insert into public.subscription_plans(id,code,status,created_by)values('d3310000-0000-4000-8000-000000000001','GOLD','ACTIVE','a2450000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d3310000-0000-4000-8000-000000000002','d3310000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12346,123460,20,5000,5000,'{}',current_date-1,repeat('b',64),'a2450000-0000-4000-8000-000000000001');
insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d3310000-0000-4000-8000-000000000001','d3310000-0000-4000-8000-000000000002','UPGRADE_TARGET_FEATURE',true);
select pg_temp.seed_approved_box_checkout('b2450000-0000-4000-8000-000000000001','d3310000-0000-4000-8000-000000000002',3);
select pg_temp.approve_posting245('DEVELOPMENT','d3310000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

insert into u331 values('policy',public.propose_subscription_proration_policy_v1('d2450000-0000-4000-8000-000000000002','d3310000-0000-4000-8000-000000000002','MONTHLY','TEST ONLY one minor unit differential with floor rounding, no free upgrade.','شروط اختبار فقط: فرق وحدة نقدية صغيرة مع التقريب للأسفل، دون تغيير مجاني.',clock_timestamp()-interval'1 minute',null,900,'TEST-0335-ZERO-ROUNDING','FLOOR'));
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_subscription_upgrade_policy_v1((select(v->>'policy_id')::uuid from u331 where k='policy'),(select v->>'content_hash'from u331 where k='policy'),true,'TEST ONLY approve exact zero rounding edge case');
select set_config('request.jwt.claim.sub','a2450000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2450000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.list_client_subscription_upgrade_options_v1('b2450000-0000-4000-8000-000000000001')->>'status','AVAILABLE','zero-rounded price does not turn options into a technical outage');
select is(jsonb_array_length(public.list_client_subscription_upgrade_options_v1('b2450000-0000-4000-8000-000000000001')->'options'),0,'a zero-rounded supplement is not offered as a free upgrade');
select throws_ok($$select public.create_client_subscription_upgrade_quote_v1('b2450000-0000-4000-8000-000000000001',(select(v->>'policy_id')::uuid from u331 where k='policy'),'upgrade335-zero-quote')$$,'22003','PRORATION_AMOUNT_NOT_PAYABLE','direct quote cannot bypass the non-payable amount rule');
select is(public.list_client_subscription_upgrade_options_v1('b2450000-0000-4000-8000-000000000001')->>'availability_reason','NO_PAYABLE_UPGRADE','UI can distinguish a published non-payable rule from missing approval');
select ok(not public.subscription_has_entitlement('b2450000-0000-4000-8000-000000000001','UPGRADE_TARGET_FEATURE'),'zero-rounded unavailable offer grants no target right');
select is((select count(*)::integer from private.subscription_upgrade_quotes_v1 where organization_id='b2450000-0000-4000-8000-000000000001'),0,'failed non-payable quote emits no invented quote or success');
select *from finish();rollback;
