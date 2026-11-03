begin;
select no_plan();
grant usage on schema extensions to authenticated,service_role,anon;
-- pgTAP only: anonymous assertions need the same rollback-scoped framework
-- access that prepareSqlTest grants to authenticated/service_role.
do $framework$declare signatures text;begin
 select string_agg(p.oid::regprocedure::text,', ')into signatures from pg_proc p join pg_depend d on d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e'join pg_extension e on e.oid=d.refobjid where e.extname='pgtap';
 execute format('grant execute on function %s to anon',signatures);
end$framework$;

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
-- Buyer membership is created during legitimate pre-subscription onboarding.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('a3440000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','buyer-344@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values('c3440000-0000-4000-8000-000000000003','b2450000-0000-4000-8000-000000000001','a3440000-0000-4000-8000-000000000003','ACTIVE',clock_timestamp());
insert into public.organization_member_roles(membership_id,role_code)values('c3440000-0000-4000-8000-000000000003','CLIENT_BUYER');
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
-- Only framework/temp-fixture access is granted here, never ledger access.
grant select,insert on p245 to authenticated,service_role;
select ok(not has_table_privilege('service_role','public.financial_entries','SELECT')and not has_table_privilege('service_role','public.financial_entries','INSERT')and not has_table_privilege('service_role','public.financial_entries','UPDATE')and not has_table_privilege('service_role','public.financial_entries','DELETE'),'trusted payment role receives no direct financial entry privileges');
select ok(not has_table_privilege('service_role','public.credit_ledger_entries','SELECT')and not has_table_privilege('service_role','public.credit_ledger_entries','INSERT'),'trusted credit worker has no direct credit ledger privileges');
set local role authenticated;
select is(current_user::text,'authenticated','negative payment check uses actual authenticated SQL role');
select throws_ok($$select public.process_verified_subscription_payment_v2('DEMO','DEMO','DENIED-AUTH-EVENT-0344','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'DENIED-AUTH-CAPTURE-0344',repeat('d',64),repeat('e',64))$$,'42501',null,'authenticated caller cannot invoke trusted capture');
select throws_ok($$insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)values('b2450000-0000-4000-8000-000000000001',extensions.gen_random_uuid(),extensions.gen_random_uuid(),'DEBIT',1,'EUR')$$,'42501',null,'Client cannot insert financial facts directly');
reset role;
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
select throws_ok($$select public.process_verified_subscription_payment_v2('DEMO','DEMO','DENIED-ANON-EVENT-0344','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'DENIED-ANON-CAPTURE-0344',repeat('d',64),repeat('e',64))$$,'42501',null,'anonymous caller cannot invoke trusted capture');
select throws_ok($$select*from public.financial_entries$$,'42501',null,'anonymous ledger reads remain denied');
reset role;
-- Remove any prerequisite-only deferred work before the real service callback.
set constraints all immediate;
set constraints all deferred;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select is(current_user::text,'service_role','capture executes under actual service SQL role');
select throws_ok($$select*from public.financial_entries$$,'42501',null,'service role cannot directly read the ledger even with BYPASSRLS');
insert into p245 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p245 where k='prep'),'DEMO','SYNTHETIC-CLONE-DEMO-ORDER-245',12345,'EUR'));
insert into p245 values('time344',jsonb_build_object('paid_at',clock_timestamp()));
insert into p245 values('paid',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-DEMO-EVENT-245','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',(select(v->>'paid_at')::timestamptz from p245 where k='time344'),'SYNTHETIC-DEMO-CAPTURE-245',repeat('d',64),repeat('e',64)));
-- Deliberately top-level, AFTER the SECURITY DEFINER callback has returned and
-- while actual current_user remains service_role. Pre-fix this raises42501.
set constraints all immediate;
select pass('deferred financial constraints succeed after callback returns to real service role');
select is((select v->>'outcome'from p245 where k='paid'),'SUBSCRIPTION_ACTIVATED','actual verified callback activates exactly one paid cycle');
select throws_ok($$select public.process_verified_subscription_payment_v2('DEMO','SANDBOX','BAD-GATEWAY-EVENT-0344','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',(select(v->>'paid_at')::timestamptz from p245 where k='time344'),'BAD-GATEWAY-CAPTURE-0344',repeat('d',64),repeat('e',64))$$,'22023','INVALID_VERIFIED_PAYMENT_EVENT','gateway environment proof validation is unchanged');
select throws_ok($$select public.process_verified_subscription_payment_v2('DEMO','DEMO','BAD-PROOF-EVENT-0344','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',(select(v->>'paid_at')::timestamptz from p245 where k='time344'),'BAD-PROOF-CAPTURE-0344',repeat('d',64),'invalid')$$,'22023','INVALID_VERIFIED_PAYMENT_EVENT','malformed provider proof is still refused');
insert into p245 values('replay344',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-DEMO-EVENT-245','SYNTHETIC-CLONE-DEMO-ORDER-245','PAYMENT_SUCCEEDED',12345,'EUR',(select(v->>'paid_at')::timestamptz from p245 where k='time344'),'SYNTHETIC-DEMO-CAPTURE-245',repeat('d',64),repeat('e',64)));
set constraints all immediate;
select is((select v->>'replayed'from p245 where k='replay344'),'true','service retry retains the exact source event and amount without duplication');
-- Exercise the credit worker under its real SQL role, including its deferred
-- wallet check after the canonical grant command has returned.
select public.discover_subscription_credit_jobs_v1(10);
reset role;
create temporary table jobs344(job jsonb);grant select,insert on jobs344 to service_role;
set local role service_role;
insert into jobs344 select*from public.claim_subscription_credit_jobs_v1('f3440000-0000-4000-8000-000000000001',5,120);
set constraints credit_wallet_nonnegative deferred;
select public.execute_subscription_credit_job_v1((job->>'job_id')::uuid,(job->>'worker_id')::uuid,(job->>'lease_token')::uuid,(job->>'row_version')::bigint)from jobs344;
set constraints all immediate;
select pass('native paid credit worker returns to service role without losing deferred invariant context');
reset role;
select is((select count(*)::integer from public.subscription_cycles where organization_id='b2450000-0000-4000-8000-000000000001'),1,'callback replay creates no extra cycle');
select is((select count(*)::integer from public.financial_journals where organization_id='b2450000-0000-4000-8000-000000000001'and journal_type='SUBSCRIPTION_PAYMENT'),1,'callback replay creates no extra cash journal');
select is((select count(*)::integer from public.financial_entries where organization_id='b2450000-0000-4000-8000-000000000001'),2,'real captured payment has one balanced debit/credit pair');
select is((select sum(quantity)::text from public.credit_lots where organization_id='b2450000-0000-4000-8000-000000000001'),'10','native worker grants only the actually paid ten credits');
select is((select count(*)::integer from public.audit_events where organization_id='b2450000-0000-4000-8000-000000000001'and action='subscription.activated_from_verified_payment'),1,'activation audit remains unique and real');
select is((select count(*)::integer from public.event_outbox where organization_id='b2450000-0000-4000-8000-000000000001'and event_type='SubscriptionPaidV1'),1,'paid source outbox remains unique');
-- Append-only invalid fixtures prove invariant failures survive a constrained
-- invoker. They are completed with balancing facts, then entirely rolled back.
set constraints financial_journal_not_empty,financial_journal_balanced deferred;
insert into public.financial_journals(id,organization_id,journal_type,currency,idempotency_scope,idempotency_key,correlation_id,effective_at,description,created_by)values('f3440000-0000-4000-8000-000000000002','b2450000-0000-4000-8000-000000000001','TEST_INVARIANT_ONLY','EUR','TEST344','TEST344-JOURNAL','f3440000-0000-4000-8000-000000000003',clock_timestamp(),'TEST ONLY deferred invariant invalid fixture','a2450000-0000-4000-8000-000000000001');
set local role service_role;
select throws_ok($$set constraints financial_journal_not_empty immediate$$,'23514','EMPTY_FINANCIAL_JOURNAL','service invoker still cannot finalize an empty journal');
reset role;
insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)select'b2450000-0000-4000-8000-000000000001','f3440000-0000-4000-8000-000000000002',id,'DEBIT',1,'EUR'from public.financial_accounts where organization_id='b2450000-0000-4000-8000-000000000001'and code='FUNDING245_CASH_EUR';
set local role service_role;
set constraints financial_journal_not_empty immediate;
select throws_ok($$set constraints financial_journal_balanced immediate$$,'23514','UNBALANCED_FINANCIAL_JOURNAL','service invoker still cannot finalize an unbalanced journal');
reset role;
insert into public.financial_entries(organization_id,journal_id,account_id,direction,amount_minor,currency)select'b2450000-0000-4000-8000-000000000001','f3440000-0000-4000-8000-000000000002',id,'CREDIT',1,'EUR'from public.financial_accounts where organization_id='b2450000-0000-4000-8000-000000000001'and code='FUNDING245_PENDING_EUR';
set local role service_role;
set constraints financial_journal_balanced immediate;
select pass('only a genuinely balanced appended journal passes the invariant');
reset role;
-- Buyer can read neither own ledger facts nor this test wallet under RLS. A
-- security-invoker SUM would incorrectly see zero and accept the negative row.
set constraints credit_wallet_nonnegative deferred;
insert into public.credit_wallets(id,organization_id,wallet_type)values('f3440000-0000-4000-8000-000000000004','b2450000-0000-4000-8000-000000000002','CLIENT');
insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)values('b2450000-0000-4000-8000-000000000002','f3440000-0000-4000-8000-000000000004','ADJUSTMENT',-1,'TEST344','TEST344-NEGATIVE','f3440000-0000-4000-8000-000000000005','TEST_INVARIANT_ONLY','TEST344-NEGATIVE','a2450000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','a3440000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a3440000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(current_user::text,'authenticated','wallet negative check uses actual Buyer SQL role');
select is((select count(*)::integer from public.credit_ledger_entries),0,'Buyer RLS hides ledger rows rather than authorizing invariant reads');
select throws_ok($$set constraints credit_wallet_nonnegative immediate$$,'23514','NEGATIVE_CREDIT_BALANCE','deferred guard detects true negative balance despite Buyer-hidden ledger rows');
select throws_ok($$insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)values('b2450000-0000-4000-8000-000000000002','f3440000-0000-4000-8000-000000000004','ADJUSTMENT',1,'FORGED','FORGED','f3440000-0000-4000-8000-000000000005','FORGED','FORGED','a3440000-0000-4000-8000-000000000003')$$,'42501',null,'Buyer cannot repair or write ledger balances directly');
reset role;
insert into public.credit_ledger_entries(organization_id,wallet_id,entry_type,quantity,idempotency_scope,idempotency_key,correlation_id,reference_type,reference_id,created_by)values('b2450000-0000-4000-8000-000000000002','f3440000-0000-4000-8000-000000000004','ADJUSTMENT',1,'TEST344','TEST344-BALANCED','f3440000-0000-4000-8000-000000000006','TEST_INVARIANT_ONLY','TEST344-BALANCED','a2450000-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
set constraints credit_wallet_nonnegative immediate;
select pass('nonnegative append-only test wallet passes under real service role');
reset role;
select ok(not has_table_privilege('service_role','public.financial_entries','SELECT')and not has_table_privilege('service_role','public.credit_ledger_entries','SELECT'),'successful deferred checks do not confer direct ledger reading rights');
select ok(not has_function_privilege('authenticated','private.assert_financial_journal_has_entries()','EXECUTE')and not has_function_privilege('service_role','private.assert_financial_journal_balanced()','EXECUTE')and not has_function_privilege('anon','private.assert_credit_wallet_nonnegative()','EXECUTE'),'runtime actors cannot call or attach the private invariant helpers');
select*from finish();
rollback;
