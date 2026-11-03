begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0184',configured_at=clock_timestamp()where singleton;
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
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a1840000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-184@example.invalid','',now(),'{}','{}',now(),now()),
('a1840000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-184@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b1840000-0000-4000-8000-000000000001','Payment 184 SARL','Payment 184','ACTIVE','a1840000-0000-4000-8000-000000000001'),
('b1840000-0000-4000-8000-000000000002','Other 184 SARL','Other 184','ACTIVE','a1840000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c1840000-0000-4000-8000-000000000001','b1840000-0000-4000-8000-000000000001','a1840000-0000-4000-8000-000000000001','ACTIVE',now()),
('c1840000-0000-4000-8000-000000000002','b1840000-0000-4000-8000-000000000002','a1840000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c1840000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1840000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d1840000-0000-4000-8000-000000000001','PREMIUM','ACTIVE','a1840000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d1840000-0000-4000-8000-000000000002','d1840000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a1840000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e1840000-0000-4000-8000-000000000001','b1840000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a1840000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a1840000-0000-4000-8000-000000000002','FINANCE_MANAGER');
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting184(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d1840000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING184_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING184_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0184','funding184-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0184');
end$$;
select pg_temp.approve_posting184('DEVELOPMENT');
select pg_temp.seed_approved_box_checkout('b1840000-0000-4000-8000-000000000001','d1840000-0000-4000-8000-000000000002',3);
create temporary table p184(kind text primary key,value jsonb);
select set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p184 values('preparation',public.prepare_subscription_payment_intent_v2('b1840000-0000-4000-8000-000000000001','d1840000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','f1840000-0000-4000-8000-000000000001'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p184 values('intent',public.register_subscription_payment_intent_v2((select(value->>'preparation_id')::uuid from p184 where kind='preparation'),'SANDBOX','ORDER-18400001',12345,'EUR'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p184 values('paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','EVENT-18400001','ORDER-18400001','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'CAPTURE-18400001',repeat('b',64),repeat('c',64)));
insert into p184 select'payment_id',jsonb_build_object('id',id)from public.subscription_payment_events where provider_event_id='EVENT-18400001';
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p184 values('request',jsonb_build_object('id',public.request_subscription_refund_v1((select(value->>'id')::bigint from p184 where kind='payment_id'),4000,'Partial refund approved by client','f1840000-0000-4000-8000-000000000002')));
select is(public.request_subscription_refund_v1((select(value->>'id')::bigint from p184 where kind='payment_id'),4000,'Partial refund approved by client','f1840000-0000-4000-8000-000000000002'),(select(value->>'id')::uuid from p184 where kind='request'),'same refund request is idempotent');
select throws_ok($$select public.decide_subscription_refund_v1((select(value->>'id')::uuid from p184 where kind='request'),true)$$,'42501','FOUR_EYES_REQUIRED','finance requester cannot approve own refund');
select throws_ok($$select public.request_subscription_refund_v1((select(value->>'id')::bigint from p184 where kind='payment_id'),9000,'Over-refund while first request pending','f1840000-0000-4000-8000-000000000003')$$,'23514','REFUND_EXCEEDS_AVAILABLE_PAYMENT','pending refunds reserve the exact amount');
select set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(public.decide_subscription_refund_v1((select(value->>'id')::uuid from p184 where kind='request'),true)->>'outcome','REFUND_AUTHORIZED','distinct finance approver authorizes a durable refund');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.prepare_subscription_refund_send_v1((select(value->>'id')::uuid from p184 where kind='request'))->>'capture_id','CAPTURE-18400001','provider command binds only the stored capture');
select throws_ok($$select public.prepare_subscription_refund_send_v1((select(value->>'id')::uuid from p184 where kind='request'))$$,'55000','REFUND_RECONCILIATION_REQUIRED','ambiguous repeated send is blocked before a second provider call');
select is(public.record_subscription_refund_send_v1((select(value->>'id')::uuid from p184 where kind='request'),'REFUND-18400001')->>'outcome','REFUND_AWAITING_WEBHOOK','provider acceptance waits for verified refund webhook');
select is((select count(*)from public.subscription_payment_adjustments where payment_event_id=(select(value->>'id')::bigint from p184 where kind='payment_id')),0::bigint,'acceptance never creates a financial reversal');
insert into p184 values('partial',public.process_verified_subscription_adjustment_v1('REFUND-EVENT-184001','CAPTURE-18400001','REFUND-18400001','REFUND_SUCCEEDED',4000,'EUR',clock_timestamp(),repeat('d',64),repeat('e',64),(select(value->>'id')::uuid from p184 where kind='request')));
select is((select status from public.subscriptions where organization_id='b1840000-0000-4000-8000-000000000001'),'ACTIVE','partial refund retains current paid rights');
select is((select status from public.subscription_refund_requests where id=(select(value->>'id')::uuid from p184 where kind='request')),'CONFIRMED','verified merchant reference confirms the exact request');
select is(public.process_verified_subscription_adjustment_v1('REFUND-EVENT-184001','CAPTURE-18400001','REFUND-18400001','REFUND_SUCCEEDED',4000,'EUR',clock_timestamp(),repeat('d',64),repeat('e',64),(select(value->>'id')::uuid from p184 where kind='request'))->>'replayed','true','duplicate signed refund never books twice');
select throws_ok($$select public.process_verified_subscription_adjustment_v1('REFUND-EVENT-184001','CAPTURE-18400001','REFUND-18400001','REFUND_SUCCEEDED',4000,'EUR',clock_timestamp(),repeat('f',64),repeat('e',64))$$,'22000','PAYMENT_EVENT_REPLAY_MISMATCH','altered signed replay rejected atomically');
select ok((select sum(e.amount_minor)filter(where direction='DEBIT')=sum(e.amount_minor)filter(where direction='CREDIT')from public.financial_entries e join public.subscription_payment_adjustments a on a.financial_journal_id=e.journal_id where a.provider_event_id='REFUND-EVENT-184001'),'partial refund creates a balanced corrective journal');
select throws_ok($$select public.process_verified_subscription_adjustment_v1('REFUND-EVENT-184002','CAPTURE-18400001','REFUND-18400002','REFUND_SUCCEEDED',9000,'EUR',clock_timestamp(),repeat('1',64),repeat('2',64))$$,'23514','REFUND_EXCEEDS_PAYMENT','successive refund cannot exceed original payment');
select set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p184 values('rest',jsonb_build_object('id',public.request_subscription_refund_v1((select(value->>'id')::bigint from p184 where kind='payment_id'),8345,'Refund the remaining contract amount','f1840000-0000-4000-8000-000000000004')));
select set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_subscription_refund_v1((select(value->>'id')::uuid from p184 where kind='rest'),true);
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.prepare_subscription_refund_send_v1((select(value->>'id')::uuid from p184 where kind='rest'));
select is(public.record_subscription_refund_send_v1((select(value->>'id')::uuid from p184 where kind='rest'),null)->>'outcome','REFUND_RECONCILIATION_REQUIRED','timeout records uncertainty instead of success or resend');
select public.process_verified_subscription_adjustment_v1('REFUND-EVENT-184003','CAPTURE-18400001','REFUND-18400003','REFUND_SUCCEEDED',8345,'EUR',clock_timestamp(),repeat('3',64),repeat('4',64),(select(value->>'id')::uuid from p184 where kind='rest'));
select is((select status from public.subscription_refund_requests where id=(select(value->>'id')::uuid from p184 where kind='rest')),'CONFIRMED','webhook reconciles a lost refund response using signed invoice reference');
select is((select status from public.subscriptions where organization_id='b1840000-0000-4000-8000-000000000001'),'SUSPENDED','full refund suspends paid entitlement');
select is((select amount_minor from public.subscription_payment_events where provider_event_id='EVENT-18400001'),12345::bigint,'original payment remains unchanged');
select is((select sum(amount_minor)from public.subscription_payment_adjustments where payment_event_id=(select(value->>'id')::bigint from p184 where kind='payment_id')),12345::numeric,'successive partial refunds exactly equal the original total');
select throws_ok($$update public.subscription_payment_adjustments set amount_minor=1 where provider_event_id='REFUND-EVENT-184001'$$,'55000',null,'posted adjustment is immutable');
select throws_ok($$select public.process_verified_subscription_adjustment_v1('UNKNOWN-EVENT-184','CAPTURE-NOT-RECORDED','REFUND-UNKNOWN-184','REFUND_SUCCEEDED',100,'EUR',clock_timestamp(),repeat('5',64),repeat('6',64))$$,'P0002','CAPTURE_NOT_YET_RECORDED','out of order refund awaits original capture instead of being lost');
-- A second tenant proves ordered dispute projection and restoration boundaries.
insert into public.subscriptions(id,organization_id,status)values('e1840000-0000-4000-8000-000000000002','b1840000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p184 values('second-preparation',public.prepare_subscription_payment_intent_v2('b1840000-0000-4000-8000-000000000002','d1840000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','f1840000-0000-4000-8000-000000000005'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.register_subscription_payment_intent_v2((select(value->>'preparation_id')::uuid from p184 where kind='second-preparation'),'SANDBOX','ORDER-18400002',12345,'EUR');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','EVENT-18400002','ORDER-18400002','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'CAPTURE-18400002',repeat('7',64),repeat('8',64));
select public.process_verified_subscription_adjustment_v1('DISPUTE-WON-184001','CAPTURE-18400002','DISPUTE-18400001','DISPUTE_WON',1000,'EUR',clock_timestamp()-interval'10 seconds',repeat('9',64),repeat('a',64));
select public.process_verified_subscription_adjustment_v1('DISPUTE-OPEN-184001','CAPTURE-18400002','DISPUTE-18400001','DISPUTE_OPENED',1000,'EUR',clock_timestamp()-interval'20 seconds',repeat('b',64),repeat('c',64));
select is((select status from public.subscriptions where organization_id='b1840000-0000-4000-8000-000000000002'),'ACTIVE','late opening event cannot undo a later won dispute');

select set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p184 values('won-refund',jsonb_build_object('id',public.request_subscription_refund_v1((select id from public.subscription_payment_events where provider_event_id='EVENT-18400002'),1000,'Refund permitted after seller wins dispute','f1840000-0000-4000-8000-000000000006')));
select set_config('request.jwt.claim.sub','a1840000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1840000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select public.decide_subscription_refund_v1((select(value->>'id')::uuid from p184 where kind='won-refund'),true);
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.prepare_subscription_refund_send_v1((select(value->>'id')::uuid from p184 where kind='won-refund'))->>'outcome','REFUND_SEND_AUTHORIZED','OPEN then WON dispute permits a later authorized refund');
select public.process_verified_subscription_adjustment_v1('DISPUTE-OPEN-184002','CAPTURE-18400002','DISPUTE-18400002','DISPUTE_OPENED',2000,'EUR',clock_timestamp()-interval'5 seconds',repeat('d',64),repeat('e',64));
select is((select status from public.subscriptions where organization_id='b1840000-0000-4000-8000-000000000002'),'SUSPENDED','open dispute freezes paid entitlements');
select public.process_verified_subscription_adjustment_v1('DISPUTE-WON-184002','CAPTURE-18400002','DISPUTE-18400002','DISPUTE_WON',2000,'EUR',clock_timestamp(),repeat('f',64),repeat('1',64));
select is((select status from public.subscriptions where organization_id='b1840000-0000-4000-8000-000000000002'),'ACTIVE','won dispute restores only the lifecycle suspension');
select public.process_verified_subscription_adjustment_v1('DISPUTE-OPEN-184003','CAPTURE-18400002','DISPUTE-18400003','DISPUTE_OPENED',2000,'EUR',clock_timestamp(),repeat('2',64),repeat('3',64));
update public.subscriptions set row_version=row_version+1 where organization_id='b1840000-0000-4000-8000-000000000002';
select public.process_verified_subscription_adjustment_v1('DISPUTE-WON-184003','CAPTURE-18400002','DISPUTE-18400003','DISPUTE_WON',2000,'EUR',clock_timestamp(),repeat('4',64),repeat('5',64));
select is((select status from public.subscriptions where organization_id='b1840000-0000-4000-8000-000000000002'),'SUSPENDED','a later administrator decision prevents automatic restoration');
select ok(not has_function_privilege('authenticated','public.process_verified_subscription_adjustment_v1(text,text,text,text,bigint,character,timestamptz,text,text,uuid,uuid)','EXECUTE'),'client cannot forge verified adjustment');
select ok(not has_table_privilege('service_role','public.subscription_payment_adjustments','INSERT'),'service must use narrow transactional adjustment command');
select * from finish();
rollback;
