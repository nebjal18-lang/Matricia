begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0187',configured_at=clock_timestamp()where singleton;
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
('a1870000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-187@example.invalid','',now(),'{}','{}',now(),now()),
('a1870000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-187@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b1870000-0000-4000-8000-000000000001','Payment 187 SARL','Payment 187','ACTIVE','a1870000-0000-4000-8000-000000000001'),
('b1870000-0000-4000-8000-000000000002','Other 187 SARL','Other 187','ACTIVE','a1870000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c1870000-0000-4000-8000-000000000001','b1870000-0000-4000-8000-000000000001','a1870000-0000-4000-8000-000000000001','ACTIVE',now()),
('c1870000-0000-4000-8000-000000000002','b1870000-0000-4000-8000-000000000002','a1870000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c1870000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1870000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d1870000-0000-4000-8000-000000000001','PREMIUM','ACTIVE','a1870000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d1870000-0000-4000-8000-000000000002','d1870000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a1870000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e1870000-0000-4000-8000-000000000001','b1870000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a1870000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a1870000-0000-4000-8000-000000000002','FINANCE_MANAGER');
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting187(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a1870000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a1870000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d1870000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING187_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING187_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0187','funding187-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a1870000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a1870000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0187');
end$$;
select pg_temp.approve_posting187('DEVELOPMENT');
select pg_temp.seed_approved_box_checkout('b1870000-0000-4000-8000-000000000001','d1870000-0000-4000-8000-000000000002',3);
create temporary table p187(kind text primary key,value jsonb);
select set_config('request.jwt.claim.sub','a1870000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1870000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p187 values('preparation',public.prepare_subscription_payment_intent_v2('b1870000-0000-4000-8000-000000000001','d1870000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','f1870000-0000-4000-8000-000000000001'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.register_subscription_payment_intent_v2((select(value->>'preparation_id')::uuid from p187 where kind='preparation'),'SANDBOX','ORDER-18700001',12345,'EUR');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','EVENT-18700001','ORDER-18700001','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'CAPTURE-18700001',repeat('b',64),repeat('c',64));
insert into p187 select'payment_id',jsonb_build_object('id',id)from public.subscription_payment_events where provider_event_id='EVENT-18700001';
select set_config('request.jwt.claims','{"sub":"a1870000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p187 values('refund',jsonb_build_object('id',public.request_subscription_refund_v1((select(value->>'id')::bigint from p187 where kind='payment_id'),1200,'Partial refund with transport uncertainty','f1870000-0000-4000-8000-000000000002')));
select set_config('request.jwt.claim.sub','a1870000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1870000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_subscription_refund_v1((select(value->>'id')::uuid from p187 where kind='refund'),true);
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.prepare_subscription_refund_send_v1((select(value->>'id')::uuid from p187 where kind='refund'));
select is((select status from public.subscription_refund_requests where id=(select(value->>'id')::uuid from p187 where kind='refund')),'SENDING','crash before recording provider response remains explicitly uncertain');
select throws_ok($$select public.prepare_subscription_refund_send_v1((select(value->>'id')::uuid from p187 where kind='refund'))$$,'55000','REFUND_RECONCILIATION_REQUIRED','crashed send cannot issue another POST');
select set_config('request.jwt.claim.sub','a1870000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1870000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p187 values('reconcile',jsonb_build_object('id',public.request_refund_reconciliation_v1((select(value->>'id')::uuid from p187 where kind='refund'),'REFUND-18700001','Observed refund identifier in authorized PayPal account','f1870000-0000-4000-8000-000000000003')));
select throws_ok($$select public.decide_refund_reconciliation_v1((select(value->>'id')::uuid from p187 where kind='reconcile'),true)$$,'42501','FOUR_EYES_REQUIRED','operator cannot approve own native proof lookup');
select set_config('request.jwt.claim.sub','a1870000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1870000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_refund_reconciliation_v1((select(value->>'id')::uuid from p187 where kind='reconcile'),true);
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.load_refund_reconciliation_work_v1((select(value->>'id')::uuid from p187 where kind='reconcile'))->>'capture_id','CAPTURE-18700001','native proof must bind stored capture and invoice');
select throws_ok($$select public.complete_refund_native_reconciliation_v1((select(value->>'id')::uuid from p187 where kind='reconcile'),'REFUND-18700001','CAPTURE-18700001',(select(value->>'id')::uuid from p187 where kind='refund'),1300,'EUR','COMPLETED',repeat('a',64),clock_timestamp())$$,'23514','REFUND_NATIVE_PROOF_MISMATCH','native amount mismatch cannot correct money');
select is(public.complete_refund_native_reconciliation_v1((select(value->>'id')::uuid from p187 where kind='reconcile'),'REFUND-18700001','CAPTURE-18700001',(select(value->>'id')::uuid from p187 where kind='refund'),1200,'EUR','PENDING',repeat('a',64),clock_timestamp())->>'outcome','REFUND_STILL_PENDING','pending provider status never confirms repayment');
select is((select count(*)from public.subscription_payment_adjustments where payment_event_id=(select(value->>'id')::bigint from p187 where kind='payment_id')),0::bigint,'pending proof posts no adjustment');
select is(public.complete_refund_native_reconciliation_v1((select(value->>'id')::uuid from p187 where kind='reconcile'),'REFUND-18700001','CAPTURE-18700001',(select(value->>'id')::uuid from p187 where kind='refund'),1200,'EUR','COMPLETED',repeat('b',64),clock_timestamp())->>'outcome','REFUND_RECONCILIATION_CONFIRMED','actual completed API proof reconciles crashed send');
select is((select status from public.subscription_refund_requests where id=(select(value->>'id')::uuid from p187 where kind='refund')),'CONFIRMED','operator workflow resolves SENDING without another refund request');
select ok((select verification_method='API_OAUTH2_TLS'and signature_fingerprint is null from public.subscription_payment_adjustments where provider_adjustment_id='REFUND-18700001'),'authenticated API proof is not misrepresented as a signed webhook');
select throws_ok($$select public.complete_refund_native_reconciliation_v1((select(value->>'id')::uuid from p187 where kind='reconcile'),'REFUND-18700001','CAPTURE-18700001',(select(value->>'id')::uuid from p187 where kind='refund'),1200,'EUR','COMPLETED',repeat('f',64),clock_timestamp())$$,'22000','REFUND_NATIVE_REPLAY_MISMATCH','modified native proof replay is rejected');
select is(public.load_refund_reconciliation_work_v1((select(value->>'id')::uuid from p187 where kind='reconcile'))->>'outcome','REFUND_ALREADY_RECONCILED','repeated delivery of reconciliation event does not query or send again');
select is(public.process_verified_subscription_adjustment_v1('REFUND-WEBHOOK-187','CAPTURE-18700001','REFUND-18700001','REFUND_SUCCEEDED',1200,'EUR',clock_timestamp(),repeat('c',64),repeat('d',64),(select(value->>'id')::uuid from p187 where kind='refund'))->>'outcome','PAYMENT_RESOURCE_ALREADY_RECORDED','later webhook for same refund does not book twice');
select is((select count(*)from public.subscription_payment_adjustments where provider_adjustment_id='REFUND-18700001'),1::bigint,'only one immutable monetary correction exists');
select ok((select sum(e.amount_minor)filter(where e.direction='DEBIT')=sum(e.amount_minor)filter(where e.direction='CREDIT')from public.financial_entries e join public.subscription_payment_adjustments a on a.financial_journal_id=e.journal_id where a.provider_adjustment_id='REFUND-18700001'),'native reconciliation corrective journal is balanced');
select is((select amount_minor from public.subscription_payment_events where provider_event_id='EVENT-18700001'),12345::bigint,'native reconciliation preserves original payment');
select throws_ok($$select public.process_verified_subscription_adjustment_v1('FORGED-WEBHOOK-187','CAPTURE-18700001','REFUND-18700002','REFUND_SUCCEEDED',100,'EUR',clock_timestamp(),repeat('e',64),null)$$,'22023','INVALID_PAYMENT_ADJUSTMENT','public webhook RPC cannot claim unsigned API verification');
select ok(not has_function_privilege('service_role','private.apply_subscription_adjustment_v1(text,text,text,text,bigint,character,timestamptz,text,text,uuid,uuid,text)','EXECUTE'),'service cannot bypass the narrow verification entrypoints');
select * from finish();
rollback;
