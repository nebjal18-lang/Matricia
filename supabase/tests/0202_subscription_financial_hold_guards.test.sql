begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0202',configured_at=clock_timestamp()where singleton;
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
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a2020000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','finance202@example.invalid','',now(),'{}','{}',now(),now());
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('a2020000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','hold202-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(2,3)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2020000-0000-4000-8000-000000000001','Financial hold 202','Financial hold 202','ACTIVE','a2020000-0000-4000-8000-000000000001'),
('b2020000-0000-4000-8000-000000000002','Unaffected 202','Unaffected 202','ACTIVE','a2020000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2020000-0000-4000-8000-000000000001','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c2020000-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a2020000-0000-4000-8000-000000000001','FINANCE_MANAGER');
insert into public.credit_wallets(id,organization_id,wallet_type)values('d2020000-0000-4000-8000-000000000001','b2020000-0000-4000-8000-000000000001','CLIENT');
insert into public.benefit_definitions(id,code,status,created_by)values('e2020000-0000-4000-8000-000000000001','HOLD_TEST_202','ACTIVE','a2020000-0000-4000-8000-000000000001');
insert into public.benefit_versions(id,benefit_id,version,status,benefit_type,fulfillment_mode,name_fr,name_ar,description_fr,description_ar,credit_cost,reference_value_minor,internal_cost_minor,currency,cancellation_rule_version,effective_from,content_hash,created_by)values('e2020000-0000-4000-8000-000000000002','e2020000-0000-4000-8000-000000000001',1,'ACTIVE','CONSULTATION','MATRICIA_INTERNAL','Conseil','استشارة','Conseil de test','استشارة للاختبار',10,1000,500,'MAD','v1',now()-interval'1 day',repeat('a',64),'a2020000-0000-4000-8000-000000000001');

insert into public.platform_user_roles(user_id,role_code)values('a2020000-0000-4000-8000-000000000001','SUPER_ADMIN'),('a2020000-0000-4000-8000-000000000002','FINANCE_MANAGER');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2020000-0000-4000-8000-000000000003','b2020000-0000-4000-8000-000000000001','a2020000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c2020000-0000-4000-8000-000000000003','CLIENT_OWNER');

-- Explicit historical published plan/rollover Box; no customer Box assignment or
-- real commercial approval is claimed by this setup. PSP callbacks below are a
-- synthetic trusted service boundary, not an external payment certification.
insert into public.subscription_plans(id,code,status,created_by)values('d2029000-0000-4000-8000-000000000001','GOLD','ACTIVE','a2020000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)values('d2029000-0000-4000-8000-000000000002','d2029000-0000-4000-8000-000000000001',1,'ACTIVE','MAD',10000,100000,100,5000,5000,'{}',current_date-365,repeat('c',64),'a2020000-0000-4000-8000-000000000001');
insert into public.box_definitions(id,code,status,created_by)values('d2029000-0000-4000-8000-000000000003','TEST_ROLLOVER_202','ACTIVE','a2020000-0000-4000-8000-000000000001');
insert into public.box_versions(id,box_id,version,status,box_type,name_fr,name_ar,credit_budget,rollover_months,rules_snapshot,cost_low_minor,cost_expected_minor,cost_full_minor,currency,content_hash,effective_from,created_by,created_at)values('d2029000-0000-4000-8000-000000000004','d2029000-0000-4000-8000-000000000003',1,'ACTIVE','FIXED','TEST rollover202','ترحيل اختبار202',100,1,'{}',0,0,0,'MAD',repeat('b',64),now()-interval'1 year','a2020000-0000-4000-8000-000000000001',now()-interval'1 year');
insert into public.plan_box_rules(plan_version_id,box_version_id,status,effective_from,rule_snapshot,created_at)values('d2029000-0000-4000-8000-000000000002','d2029000-0000-4000-8000-000000000004','ACTIVE',now()-interval'1 year','{}',now()-interval'1 year');
insert into public.subscriptions(id,organization_id,status)values('d2029000-0000-4000-8000-000000000005','b2020000-0000-4000-8000-000000000001','TRIAL_EXPIRED');
select pg_temp.seed_approved_box_checkout('b2020000-0000-4000-8000-000000000001','d2029000-0000-4000-8000-000000000002',1);
create temporary table funding202(k text primary key,v jsonb);
create function pg_temp.actor202(p_uid uuid)returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub',p_uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_uid,'role','authenticated','aal','aal2')::text,true);end$$;
select pg_temp.actor202('a2020000-0000-4000-8000-000000000001');
insert into funding202 values('posting',public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2029000-0000-4000-8000-000000000002',null,'MAD','DEVELOPMENT',1,current_date-1,null,jsonb_build_object('cash_account_code','TEST202_CASH_MAD','cash_name_fr','TEST cash','cash_name_ar','خزينة اختبار','suspense_account_code','TEST202_PENDING_MAD','suspense_name_fr','TEST pending','suspense_name_ar','قيد اختبار'),'TEST synthetic posting only','TEST-202-posting'));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000002');
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from funding202 where k='posting'),true,(select v->>'request_hash'from funding202 where k='posting'),'TEST independent synthetic posting approval');
select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');
insert into funding202 values('prepared',public.prepare_subscription_payment_intent_v2('b2020000-0000-4000-8000-000000000001','d2029000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','TEST-202-prepare'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into funding202 values('registered',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from funding202 where k='prepared'),'SANDBOX','SYNTHETIC-202-ORDER',10000,'MAD'));
insert into funding202 values('paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-202-CAPTURE-EVENT','SYNTHETIC-202-ORDER','PAYMENT_SUCCEEDED',10000,'MAD',clock_timestamp(),'SYNTHETIC-202-CAPTURE',repeat('d',64),repeat('e',64)));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000001');
insert into funding202 select'payment-id',to_jsonb(id::text)from public.subscription_payment_events where provider_event_id='SYNTHETIC-202-CAPTURE-EVENT';
insert into funding202 values('terms',public.get_subscription_credit_grant_context_v1('b2020000-0000-4000-8000-000000000001',(select(v#>>'{}')::bigint from funding202 where k='payment-id'),1));
insert into funding202 values('grant',public.issue_subscription_credit_grant_v1('b2020000-0000-4000-8000-000000000001',(select(v#>>'{}')::bigint from funding202 where k='payment-id'),1,(select v#>>'{terms,terms_hash}'from funding202 where k='terms'),'grant-before-202'));
insert into funding202 values('policy-context',public.get_admin_benefit_admission_context_v1('e2020000-0000-4000-8000-000000000002'));
insert into funding202 values('policy',public.propose_benefit_admission_policy_v1('e2020000-0000-4000-8000-000000000002',(select v->>'source_hash'from funding202 where k='policy-context'),null,'NONE',null,null,'{}','{}',clock_timestamp()-interval'1 minute',null,'TEST explicit human report and independent Client receipt policy','TEST_POLICY_202','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1','e2029000-0000-4000-8000-000000000001'));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000002');
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from funding202 where k='policy'),(select v->>'content_hash'from funding202 where k='policy'),true,'TEST_POLICY_REVIEW_202','TEST independent admission policy approval');
select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');

select ok(private.current_subscription_funding_v1('b2020000-0000-4000-8000-000000000001')is not null,'before hold, credits are backed by native PSP/cycle/journal and posting approval');
insert into funding202 values('release-reserve',public.reserve_benefit_credits('b2020000-0000-4000-8000-000000000001','d2020000-0000-4000-8000-000000000001','e2020000-0000-4000-8000-000000000002',1,clock_timestamp()+interval'1 day','TEST-202-release-reserve'));
insert into funding202 values('consume-reserve',public.reserve_benefit_credits('b2020000-0000-4000-8000-000000000001','d2020000-0000-4000-8000-000000000001','e2020000-0000-4000-8000-000000000002',1,clock_timestamp()+interval'1 day','TEST-202-consume-reserve'));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000001');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from funding202 where k='consume-reserve'),1,'SCHEDULE',clock_timestamp()-interval'1 second','TEST operator schedule for real receipt202','TEST-202-schedule');
select public.advance_benefit_fulfillment_v1((select(v->>'redemption_id')::uuid from funding202 where k='consume-reserve'),2,'START',null,'TEST operator actual start202','TEST-202-start');
insert into funding202 values('report',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from funding202 where k='consume-reserve'),3,'TEST operator account of consultation performed in this synthetic fixture','TEST_SERVICE_REPORT_202',null,'TEST-202-report'));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');
insert into funding202 values('receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from funding202 where k='report'),(select v->>'source_hash'from funding202 where k='report'),(select(v->>'row_version')::bigint from funding202 where k='report'),true,'TEST Client independent receipt of this operational report','TEST-202-receipt'));
select is((select status from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from funding202 where k='consume-reserve')),'DELIVERED','DELIVERED comes only from genuine operator report and independent Client receipt');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into funding202 values('dispute-open',public.process_verified_subscription_adjustment_v2('SANDBOX','SYNTHETIC-202-DISPUTE-OPEN','SYNTHETIC-202-CAPTURE','SYNTHETIC-202-DISPUTE','DISPUTE_OPENED',10000,'MAD',clock_timestamp(),repeat('f',64),repeat('a',64)));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');
select ok(not private.subscription_financially_clear('b2020000-0000-4000-8000-000000000001'),'actual verified dispute creates a blocking financial hold');
select is((select item->>'status'from jsonb_array_elements(public.list_client_financial_page('b2020000-0000-4000-8000-000000000001'))item where item->>'event_type'='PAYMENT_SUCCEEDED'),'DISPUTED','Client receipt reflects actual open dispute');
select ok(not private.client_may_open_new_service_request('b2020000-0000-4000-8000-000000000001'),'financial hold blocks new request eligibility');
select ok(private.client_may_open_new_service_request('b2020000-0000-4000-8000-000000000002'),'hold does not propagate to a foreign organisation');
select pg_temp.actor202('a2020000-0000-4000-8000-000000000001');
select is(public.issue_subscription_credit_grant_v1('b2020000-0000-4000-8000-000000000001',(select(v#>>'{}')::bigint from funding202 where k='payment-id'),1,(select v#>>'{terms,terms_hash}'from funding202 where k='terms'),'grant-before-202'),(select v from funding202 where k='grant'),'authorized grant replay remains the exact prior result during hold');
select throws_ok($$select public.issue_credits('b2020000-0000-4000-8000-000000000001',(select wallet_id from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from funding202 where k='grant')),'SUBSCRIPTION_GRANT',(select(v#>>'{terms,quantity}')::bigint from funding202 where k='terms'),(select(v#>>'{terms,expires_at}')::timestamptz from funding202 where k='terms'),null,(select v#>>'{terms,source_reference}'from funding202 where k='terms'),0,(select v#>>'{terms,rule_version}'from funding202 where k='terms'),null,'TEST-new-grant-during-hold-202')$$,'55000','SUBSCRIPTION_FINANCIAL_HOLD','new canonical grant command is blocked by actual hold');

select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');
select throws_ok($$select public.reserve_benefit_credits('b2020000-0000-4000-8000-000000000001','d2020000-0000-4000-8000-000000000001','e2020000-0000-4000-8000-000000000002',1,clock_timestamp()+interval'1 day','TEST-reserve-during-hold-202')$$,'55000','SUBSCRIPTION_FINANCIAL_HOLD','new reservation is blocked while the real capture is held');
select throws_ok($$select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from funding202 where k='consume-reserve'),(select v->>'receipt_hash'from funding202 where k='receipt'),'TEST-consume-during-hold-202')$$,'55000','CREDIT_LOT_FUNDING_NOT_ADMISSIBLE','native accepted receipt cannot bypass the actual funding hold');
select is((select sum(quantity)::bigint from public.credit_ledger_entries where wallet_id='d2020000-0000-4000-8000-000000000001'),80::bigint,'refused effects preserve the exact derived credit balance');
select is((select count(*)::integer from public.credit_lot_movements where redemption_id=(select(v->>'redemption_id')::uuid from funding202 where k='consume-reserve')and movement_type='CONSUME'),0,'failed consumption rolls back all lot movements');
select lives_ok($$select public.release_benefit_credits((select(v->>'redemption_id')::uuid from funding202 where k='release-reserve'),'CLIENT_CANCELLATION','TEST-release-during-hold-202')$$,'return of a prior reservation remains possible during hold');
select is((select sum(quantity)::bigint from public.credit_ledger_entries where wallet_id='d2020000-0000-4000-8000-000000000001'),90::bigint,'release appends exact returned credit quantity');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.process_verified_subscription_adjustment_v2('SANDBOX','SYNTHETIC-202-DISPUTE-WON','SYNTHETIC-202-CAPTURE','SYNTHETIC-202-DISPUTE','DISPUTE_WON',10000,'MAD',clock_timestamp()+interval'1 second',repeat('b',64),repeat('c',64));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');
select ok(private.client_may_open_new_service_request('b2020000-0000-4000-8000-000000000001'),'actual dispute resolution restores eligibility under the original guards');
select lives_ok($$select public.consume_benefit_credits((select(v->>'redemption_id')::uuid from funding202 where k='consume-reserve'),(select v->>'receipt_hash'from funding202 where k='receipt'),'TEST-consume-after-hold-202')$$,'accepted native service can be consumed after hold resolution');
select is((select sum(quantity)::bigint from public.credit_ledger_entries where wallet_id='d2020000-0000-4000-8000-000000000001'),90::bigint,'reservation conversion never debits historical credits twice');
-- No P&L/cost closure is inferred here: missing economic allocation remains an
-- explicit pending fact handled by the separate native allocation recipe0247.
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.process_verified_subscription_adjustment_v2('SANDBOX','SYNTHETIC-202-PARTIAL-REFUND','SYNTHETIC-202-CAPTURE','SYNTHETIC-202-REFUND','REFUND_SUCCEEDED',2500,'MAD',clock_timestamp()+interval'2 seconds',repeat('d',64),repeat('e',64));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');
select is((select item->>'status'from jsonb_array_elements(public.list_client_financial_page('b2020000-0000-4000-8000-000000000001'))item where item->>'event_type'='PAYMENT_SUCCEEDED'),'PARTIALLY_REFUNDED','actual partial refund changes current receipt');
select is((select item->>'refunded_minor'from jsonb_array_elements(public.list_client_financial_page('b2020000-0000-4000-8000-000000000001'))item where item->>'event_type'='PAYMENT_SUCCEEDED'),'2500','Client receives exact refunded minor units');
select is((select item->>'remaining_minor'from jsonb_array_elements(public.list_client_financial_page('b2020000-0000-4000-8000-000000000001'))item where item->>'event_type'='PAYMENT_SUCCEEDED'),'7500','Client receives exact retained minor amount');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.process_verified_subscription_adjustment_v2('SANDBOX','SYNTHETIC-202-REVERSED','SYNTHETIC-202-CAPTURE','SYNTHETIC-202-REVERSAL','PAYMENT_REVERSED',7500,'MAD',clock_timestamp()+interval'3 seconds',repeat('f',64),repeat('a',64));
select pg_temp.actor202('a2020000-0000-4000-8000-000000000003');
select is((select item->>'status'from jsonb_array_elements(public.list_client_financial_page('b2020000-0000-4000-8000-000000000001'))item where item->>'event_type'='PAYMENT_SUCCEEDED'),'REVERSED','full restitution is never reported as confirmed payment');
select is((select item->>'remaining_minor'from jsonb_array_elements(public.list_client_financial_page('b2020000-0000-4000-8000-000000000001'))item where item->>'event_type'='PAYMENT_SUCCEEDED'),'0','full restitution retains no paid balance');
select is((select amount_minor::text from public.subscription_payment_events where provider_event_id='SYNTHETIC-202-CAPTURE-EVENT'),'10000','original native capture remains immutable');
select is((select count(*)::integer from jsonb_array_elements(public.list_client_financial_page('b2020000-0000-4000-8000-000000000001'))item where item->>'event_type'in('REFUND_SUCCEEDED','PAYMENT_REVERSED')),2,'refund and reversal each have an immutable dated history row');
select ok(not has_function_privilege('authenticated','private.subscription_financially_clear(uuid)','EXECUTE')and not has_function_privilege('service_role','private.guard_subscription_financial_credit_operation()','EXECUTE'),'financial eligibility and ledger trigger remain private');
select*from finish();rollback;
