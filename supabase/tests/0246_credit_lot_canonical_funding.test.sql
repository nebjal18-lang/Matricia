begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0246',configured_at=clock_timestamp()where singleton;
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
grant usage on schema extensions to authenticated;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2460000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-246@example.invalid','',now(),'{}','{}',now(),now()),
('a2460000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-246@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2460000-0000-4000-8000-000000000001','Payment 246 SARL','Payment 246','ACTIVE','a2460000-0000-4000-8000-000000000001'),
('b2460000-0000-4000-8000-000000000002','Other 246 SARL','Other 246','ACTIVE','a2460000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2460000-0000-4000-8000-000000000001','b2460000-0000-4000-8000-000000000001','a2460000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2460000-0000-4000-8000-000000000002','b2460000-0000-4000-8000-000000000002','a2460000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c2460000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2460000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d2460000-0000-4000-8000-000000000001','PREMIUM','ACTIVE','a2460000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2460000-0000-4000-8000-000000000002','d2460000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-365,repeat('a',64),'a2460000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2460000-0000-4000-8000-000000000001','b2460000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2460000-0000-4000-8000-000000000001','FINANCE_MANAGER');

-- Historical published plan/Box configuration is explicit test input, not a
-- default policy or an approval for any real client. Report is three months.
insert into public.box_definitions(id,code,status,created_by)values('f2460000-0000-4000-8000-000000000001','FUNDING_246','ACTIVE','a2460000-0000-4000-8000-000000000001');
insert into public.box_versions(id,box_id,version,status,box_type,name_fr,name_ar,credit_budget,rollover_months,rules_snapshot,cost_low_minor,cost_expected_minor,cost_full_minor,currency,content_hash,effective_from,created_by,created_at)
values('f2460000-0000-4000-8000-000000000002','f2460000-0000-4000-8000-000000000001',1,'ACTIVE','FIXED','Test rollover 246','ترحيل اختباري',10,3,'{"fixture":"versioned-three-month-rollover"}',0,0,0,'EUR',repeat('b',64),now()-interval'1 year','a2460000-0000-4000-8000-000000000001',now()-interval'1 year');
insert into public.plan_box_rules(id,plan_version_id,box_version_id,status,effective_from,rule_snapshot,created_at)
values('f2460000-0000-4000-8000-000000000003','d2460000-0000-4000-8000-000000000002','f2460000-0000-4000-8000-000000000002','ACTIVE',now()-interval'1 year','{"fixture":"approved-plan-link"}',now()-interval'1 year');
insert into public.benefit_definitions(id,code,status,created_by)values('f2460000-0000-4000-8000-000000000004','FUNDING_BENEFIT_246','ACTIVE','a2460000-0000-4000-8000-000000000001');
insert into public.benefit_versions(id,benefit_id,version,status,benefit_type,fulfillment_mode,name_fr,name_ar,description_fr,description_ar,credit_cost,reference_value_minor,internal_cost_minor,currency,cancellation_rule_version,effective_from,content_hash,created_by)
values('f2460000-0000-4000-8000-000000000005','f2460000-0000-4000-8000-000000000004',1,'ACTIVE','CREDIT_SERVICE','MATRICIA_INTERNAL','Test funding','اختبار التمويل','Credit funding fixture','اختبار مصدر الرصيد',3,0,0,'EUR','CANCEL_TEST_V1',now()-interval'1 day',repeat('c',64),'a2460000-0000-4000-8000-000000000001');
select pg_temp.seed_approved_box_checkout('b2460000-0000-4000-8000-000000000001','d2460000-0000-4000-8000-000000000002',3);
create function pg_temp.actor246(actor uuid)returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
end$$;
create function pg_temp.approve_posting246(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform pg_temp.actor246('a2460000-0000-4000-8000-000000000001');
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2460000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-365,null,
  jsonb_build_object('cash_account_code','FUNDING246_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING246_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),
  'TEST ONLY posting for canonical credit funding246','funding246-posting-'||lower(target_environment));
 perform pg_temp.actor246('ff850000-0000-4000-8000-000000000002');
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','TEST ONLY independent posting approval246');
 perform pg_temp.actor246('a2460000-0000-4000-8000-000000000001');
end$$;
select pg_temp.approve_posting246('DEVELOPMENT');
create temporary table p246(k text primary key,v jsonb);

-- The existing test benefit also needs an independently approved admission
-- policy; a published label alone never permits a reservation.
select pg_temp.actor246('a2460000-0000-4000-8000-000000000001');
insert into p246 values('admission-context',public.get_admin_benefit_admission_context_v1('f2460000-0000-4000-8000-000000000005'));
insert into p246 values('admission-policy',public.propose_benefit_admission_policy_v1('f2460000-0000-4000-8000-000000000005',
 (select v->>'source_hash'from p246 where k='admission-context'),null,'NONE',null,null,'{}','{}',clock_timestamp()-interval'1 minute',null,
 'TEST ONLY explicit service report and independent Client receipt246','TEST_POLICY_246','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid()));
select pg_temp.actor246('ff850000-0000-4000-8000-000000000002');
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p246 where k='admission-policy'),
 (select v->>'content_hash'from p246 where k='admission-policy'),true,'TEST_POLICY_REVIEW_246','TEST ONLY independent admission approval246');
select pg_temp.actor246('a2460000-0000-4000-8000-000000000001');

insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2460000-0000-4000-8000-000000000001','d2460000-0000-4000-8000-000000000002','FUNDING_PROBE',true);
select set_config('request.jwt.claim.sub','a2460000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2460000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p246 values('prep',public.prepare_subscription_payment_intent_v2('b2460000-0000-4000-8000-000000000001','d2460000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','funding246-demo-prepare'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p246 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p246 where k='prep'),'DEMO','SYNTHETIC-CLONE-DEMO-ORDER-246',12345,'EUR'));
insert into p246 values('paid',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-DEMO-EVENT-246','SYNTHETIC-CLONE-DEMO-ORDER-246','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-DEMO-CAPTURE-246',repeat('d',64),repeat('e',64)));
select set_config('request.jwt.claim.sub','a2460000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2460000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.demo_payment',(select id::text from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-246'),true);
insert into p246 values('wallet',public.ensure_client_credit_wallet('b2460000-0000-4000-8000-000000000001','funding246-wallet'));
select set_config('test.wallet',(select v->>'wallet_id'from p246 where k='wallet'),true);
insert into p246 values('terms',public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.demo_payment')::bigint,1));
select is((select v#>>'{terms,quantity}'from p246 where k='terms'),'10','quantity is derived from the paid immutable plan');
select is((select v#>>'{terms,revenue_value_minor}'from p246 where k='terms'),'0','the subscription credit grant recognizes no additional revenue');
select is((select v#>>'{terms,revenue_recognition}'from p246 where k='terms'),'ALREADY_RECOGNIZED_IN_SUBSCRIPTION_LEDGER','funding and revenue recognition remain distinct');
select is((select v#>>'{terms,rollover_policy,rollover_months}'from p246 where k='terms'),'3','expiry comes from the actual versioned Box policy');
select set_config('test.journal_count',(select count(*)::text from public.financial_journals where organization_id='b2460000-0000-4000-8000-000000000001'),true);
insert into p246 values('subscription_lot',public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.demo_payment')::bigint,1,(select v#>>'{terms,terms_hash}'from p246 where k='terms'),'funding246-subscription-grant'));
select set_config('test.demo_lot',(select v->>'credit_lot_id'from p246 where k='subscription_lot'),true);
select is((select currency::text from public.credit_lots where id=current_setting('test.demo_lot')::uuid),'EUR','the lot keeps the source currency instead of the legacy MAD default');
select is((select source_snapshot#>>'{benefit_pool_allocation_basis_points}'from public.credit_lot_payment_sources_v1 where credit_lot_id=current_setting('test.demo_lot')::uuid),'5000','the actual source pool configuration is preserved without a new allocation formula');
select is((select count(*)::text from public.financial_journals where organization_id='b2460000-0000-4000-8000-000000000001'),current_setting('test.journal_count'),'issuing subscription credits creates no additional financial revenue journal');
select is((public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.demo_payment')::bigint,1,(select v#>>'{terms,terms_hash}'from p246 where k='terms'),'funding246-subscription-grant')->>'credit_lot_id'),current_setting('test.demo_lot'),'the same command replays its exact lot');
select throws_ok($$select public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.demo_payment')::bigint,1,(select v#>>'{terms,terms_hash}'from p246 where k='terms'),'funding246-subscription-second-key')$$,'55000','CREDIT_SUBSCRIPTION_GRANT_ALREADY_ISSUED','another idempotency key cannot grant the same paid monthly slot twice');
select throws_ok($$select public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.demo_payment')::bigint,1,repeat('f',64),'funding246-stale-terms')$$,'40001','STALE_SUBSCRIPTION_CREDIT_GRANT_TERMS','an unseen grant policy cannot be confirmed silently');
select throws_ok($$select public.issue_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'SUBSCRIPTION_GRANT',11,(select(v#>>'{terms,expires_at}')::timestamptz from p246 where k='terms'),null,(select v#>>'{terms,source_reference}'from p246 where k='terms'),0,(select v#>>'{terms,rule_version}'from p246 where k='terms'),null,'funding246-excess-quantity')$$,'23514','CREDIT_SUBSCRIPTION_GRANT_TERMS_MISMATCH','the generic command cannot exceed the paid snapshot quantity');
select throws_ok($$select public.issue_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'SUBSCRIPTION_GRANT',10,(select(v#>>'{terms,expires_at}')::timestamptz from p246 where k='terms'),null,(select v#>>'{terms,source_reference}'from p246 where k='terms'),1,(select v#>>'{terms,rule_version}'from p246 where k='terms'),null,'funding246-fake-revenue')$$,'23514','CREDIT_SUBSCRIPTION_GRANT_TERMS_MISMATCH','a valid payment cannot invent additional revenue recognition');
select throws_ok($$select public.issue_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'SUBSCRIPTION_GRANT',10,(select(v#>>'{terms,expires_at}')::timestamptz from p246 where k='terms'),null,(select v#>>'{terms,source_reference}'from p246 where k='terms'),0,'CALLER_INVENTED_RULE',null,'funding246-fake-rule')$$,'23514','CREDIT_SUBSCRIPTION_GRANT_TERMS_MISMATCH','a caller cannot replace the canonical paid grant rule');
select throws_ok($$select public.issue_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'SUBSCRIPTION_GRANT',10,now()+interval'10 years',null,(select v#>>'{terms,source_reference}'from p246 where k='terms'),0,(select v#>>'{terms,rule_version}'from p246 where k='terms'),null,'funding246-fake-expiry')$$,'23514','CREDIT_SUBSCRIPTION_GRANT_TERMS_MISMATCH','a caller cannot extend expiry beyond the versioned report');
select throws_ok($$select public.issue_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'SUBSCRIPTION_GRANT',10,now()+interval'5 years',null,'unlinked-claim-246',0,'ARBITRARY',null,'funding246-unlinked-new')$$,'55000','CREDIT_SUBSCRIPTION_PAYMENT_SOURCE_REQUIRED','new subscription grants require an exact native payment source');
select is((select count(*)::integer from public.credit_lots where organization_id='b2460000-0000-4000-8000-000000000001'),1,'failed duplicate, stale, inflated and unlinked commands leave no lot');
select is((select count(*)::integer from public.credit_ledger_entries where organization_id='b2460000-0000-4000-8000-000000000001'and entry_type='GRANT'),1,'failed grants leave no credit ledger entry');
select is((select count(*)::integer from public.event_outbox where aggregate_id=current_setting('test.demo_lot')and event_type='CreditLotPaymentBoundV1'),1,'the immutable funding binding emits one outbox fact');
select throws_ok($$update public.credit_lot_payment_sources_v1 set source_hash=repeat('f',64)where credit_lot_id=current_setting('test.demo_lot')::uuid$$,'55000',null,'the funding snapshot cannot be rewritten');
-- Unknown legacy provenance cannot be created by suppressing the new binder.
-- A missing source remains unverified, and the earlier rejected grant left no lot.
select is(private.credit_lot_funding_status_v1('a2460000-0000-4000-8000-000000000199'),'SOURCE_UNVERIFIED','an unknown lot identifier never acquires invented funding provenance');
insert into p246 values('demo_reservation',public.reserve_benefit_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'f2460000-0000-4000-8000-000000000005',1,now()+interval'1 day','funding246-demo-reserve'));
select is((select credit_lot_id::text from public.credit_lot_movements where redemption_id=(select(v->>'redemption_id')::uuid from p246 where k='demo_reservation')),current_setting('test.demo_lot'),'the reservation selects the exact canonically funded paid lot');
insert into p246 values('gift-request',public.request_manual_credit_grant_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,
 'ADMIN_GRANT',7,now()+interval'6 months',null,'APPROVED_MANUAL_246','TEST ONLY zero-revenue gift for native funding exclusion','funding246-approved-gift-request'));
select pg_temp.actor246('ff850000-0000-4000-8000-000000000002');
insert into p246 values('gift-review',public.review_manual_credit_grant_v1((select(v->>'request_id')::uuid from p246 where k='gift-request'),
 (select v->>'content_hash'from p246 where k='gift-request'),true,true,'TEST_GIFT_APPROVAL_246','TEST ONLY independent Finance approval of exact gift246'));
select pg_temp.actor246('a2460000-0000-4000-8000-000000000001');
insert into p246 values('gift_lot',public.execute_manual_credit_grant_v1((select(v->>'request_id')::uuid from p246 where k='gift-request'),
 (select v->>'content_hash'from p246 where k='gift-request'),(select v->>'review_proof_hash'from p246 where k='gift-review'),'funding246-approved-gift-execute'));

select set_config('test.balance_before_retag',(select balance::text from public.credit_wallet_balances where wallet_id=current_setting('test.wallet')::uuid),true);
update private.admin_execution_environment_v1 set environment='PRODUCTION',configuration_reference='transactional-retag-fixture-0246',configured_at=clock_timestamp()where singleton;
select pg_temp.approve_posting246('PRODUCTION');
select is(private.credit_lot_funding_status_v1(current_setting('test.demo_lot')::uuid),'ENVIRONMENT_INCOMPATIBLE','a DEV DEMO lot cannot finance a new effect after trusted deployment retag');
select is((select balance::text from public.credit_wallet_balances where wallet_id=current_setting('test.wallet')::uuid),current_setting('test.balance_before_retag'),'retag never rewrites the historical credit balance');
select throws_ok($$insert into public.credit_lot_movements(organization_id,credit_lot_id,redemption_id,movement_type,quantity,idempotency_scope,idempotency_key,correlation_id,created_by)values('b2460000-0000-4000-8000-000000000001',current_setting('test.demo_lot')::uuid,(select(v->>'redemption_id')::uuid from p246 where k='demo_reservation'),'CONSUME',3,'credits.test','funding246-denied-consume',extensions.gen_random_uuid(),'a2460000-0000-4000-8000-000000000001')$$,'55000','CREDIT_LOT_FUNDING_NOT_ADMISSIBLE','the movement guard also refuses consumption of an already reserved DEMO lot');
select lives_ok($$select public.release_benefit_credits((select(v->>'redemption_id')::uuid from p246 where k='demo_reservation'),'CANCEL_INCOMPATIBLE_FUNDING','funding246-release-after-retag')$$,'an incompatible source does not prevent releasing its old reservation');
insert into p246 values('gift_reservation',public.reserve_benefit_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'f2460000-0000-4000-8000-000000000005',1,now()+interval'1 day','funding246-gift-reserve'));
select is((select credit_lot_id::text from public.credit_lot_movements where redemption_id=(select(v->>'redemption_id')::uuid from p246 where k='gift_reservation')),(select v->>'credit_lot_id'from p246 where k='gift_lot'),'an eligible manual gift remains usable even with an older incompatible paid lot');
select throws_ok($$select public.reserve_benefit_credits('b2460000-0000-4000-8000-000000000001',current_setting('test.wallet')::uuid,'f2460000-0000-4000-8000-000000000005',2,now()+interval'1 day','funding246-no-eligible-more')$$,'23514','INSUFFICIENT_ELIGIBLE_CREDITS','historical balance cannot bypass the lack of compatible unspent lots');
-- A fully native current LIVE checkout carries actual pre-PSP posting and Box
-- approvals. This does not certify a two-month-old checkout without its proof.
insert into public.subscriptions(id,organization_id,status)values('e2460000-0000-4000-8000-000000000002','b2460000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select pg_temp.actor246('a2460000-0000-4000-8000-000000000002');
insert into p246 values('live-prepared',public.prepare_subscription_payment_intent_v2('b2460000-0000-4000-8000-000000000002','d2460000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','LIVE','funding246-native-live-order'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p246 values('live-intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p246 where k='live-prepared'),'LIVE','SYNTHETIC-NATIVE-LIVE-ORDER-246',12345,'EUR'));
insert into p246 values('live_paid',public.process_verified_subscription_payment_v2('PAYPAL','LIVE','SYNTHETIC-LIVE-EVENT-246','SYNTHETIC-NATIVE-LIVE-ORDER-246','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-LIVE-CAPTURE-246',repeat('4',64),repeat('5',64)));
select set_config('test.live_payment',(select id::text from public.subscription_payment_events where provider_event_id='SYNTHETIC-LIVE-EVENT-246'),true);
select pg_temp.actor246('a2460000-0000-4000-8000-000000000001');
insert into p246 values('live_wallet',public.ensure_client_credit_wallet('b2460000-0000-4000-8000-000000000002','funding246-live-wallet'));
insert into p246 values('live_terms',public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000002',current_setting('test.live_payment')::bigint,1));
select ok((select(v#>>'{terms,period_start}')::timestamptz<=clock_timestamp()and(v#>>'{terms,period_end}')::timestamptz>clock_timestamp()from p246 where k='live_terms'),'the exact native payment supplies the current source period');
select ok((select(v#>>'{terms,expires_at}')::timestamptz=(v#>>'{terms,period_end}')::timestamptz+interval'3 months'from p246 where k='live_terms'),'the frozen approved three-month rollover determines the exact expiry');
insert into p246 values('live_lot',public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000002',current_setting('test.live_payment')::bigint,1,(select v#>>'{terms,terms_hash}'from p246 where k='live_terms'),'funding246-live-reported-grant'));
insert into p246 values('live_reservation',public.reserve_benefit_credits('b2460000-0000-4000-8000-000000000002',(select(v->>'wallet_id')::uuid from p246 where k='live_wallet'),'f2460000-0000-4000-8000-000000000005',1,now()+interval'1 day','funding246-live-reported-reserve'));
select is(private.credit_lot_funding_status_v1((select(v->>'credit_lot_id')::uuid from p246 where k='live_lot')),'ELIGIBLE','a fully proved LIVE lot is eligible for the real reservation command');
select is((select credit_lot_id::text from public.credit_lot_movements where redemption_id=(select(v->>'redemption_id')::uuid from p246 where k='live_reservation')),(select v->>'credit_lot_id'from p246 where k='live_lot'),'the reservation is bound to the actual LIVE source lot');

-- Late native cash with an old external order and no original preparation is
-- retained for reconciliation; today's approvals cannot invent its past terms.
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2460000-0000-4000-8000-000000000004','Unproved historical fixture246','Historical246','ACTIVE','a2460000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2460000-0000-4000-8000-000000000004','b2460000-0000-4000-8000-000000000004','TRIAL_EXPIRED');
insert into public.subscription_payment_intents(id,organization_id,plan_version_id,billing_interval,gateway,provider_environment,deployment_environment,provider_intent_id,amount_minor,currency,idempotency_key,request_hash,correlation_id,created_by,created_at)
values('a2460000-0000-4000-8000-000000000104','b2460000-0000-4000-8000-000000000004','d2460000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','LIVE','PRODUCTION','SYNTHETIC-HISTORICAL-LIVE-ORDER-246',12345,'EUR','funding246-historical-live-order',repeat('3',64),extensions.gen_random_uuid(),'a2460000-0000-4000-8000-000000000001',now()-interval'2 months'-interval'1 minute');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p246 values('historical-receipt',public.process_verified_subscription_payment_v2('PAYPAL','LIVE','SYNTHETIC-HISTORICAL-EVENT-246','SYNTHETIC-HISTORICAL-LIVE-ORDER-246','PAYMENT_SUCCEEDED',12345,'EUR',now()-interval'2 months','SYNTHETIC-HISTORICAL-CAPTURE-246',repeat('9',64),repeat('a',64)));
select is((select v->>'receipt_state'from p246 where k='historical-receipt'),'PENDING_LEDGER_CONFIGURATION','unproved historical cash remains a durable reconciliation receipt');
select is((select count(*)from public.subscription_cycles where organization_id='b2460000-0000-4000-8000-000000000004'),0::bigint,'an old order without its exact posting source creates no funded period');
select is((select count(*)from public.financial_journals where organization_id='b2460000-0000-4000-8000-000000000004'),0::bigint,'late historical cash never fabricates ledger accounts or entries');
select is((select count(*)from public.credit_lots where organization_id='b2460000-0000-4000-8000-000000000004'),0::bigint,'unproved old checkout terms create no subscription credit lot');
select pg_temp.actor246('a2460000-0000-4000-8000-000000000001');
-- Annual billing still grants monthly credits, not an arbitrary yearly amount.
-- Month two is genuinely future for this native checkout. An elapsed-cycle
-- rollover recipe requires original historical evidence and a controlled clock;
-- this test deliberately does not claim that temporal coverage.
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2460000-0000-4000-8000-000000000003','Annual fixture 246','Annual 246','ACTIVE','a2460000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values('c2460000-0000-4000-8000-000000000003','b2460000-0000-4000-8000-000000000003','a2460000-0000-4000-8000-000000000001','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c2460000-0000-4000-8000-000000000003','CLIENT_OWNER');
insert into public.subscriptions(id,organization_id,status)values('e2460000-0000-4000-8000-000000000003','b2460000-0000-4000-8000-000000000003','TRIAL_EXPIRED');
insert into p246 values('annual-prepared',public.prepare_subscription_payment_intent_v2('b2460000-0000-4000-8000-000000000003','d2460000-0000-4000-8000-000000000002','ANNUAL','PAYPAL','LIVE','funding246-native-annual-order'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p246 values('annual-intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p246 where k='annual-prepared'),'LIVE','SYNTHETIC-ANNUAL-LIVE-ORDER-246',123450,'EUR'));
insert into p246 values('annual_paid',public.process_verified_subscription_payment_v2('PAYPAL','LIVE','SYNTHETIC-ANNUAL-EVENT-246','SYNTHETIC-ANNUAL-LIVE-ORDER-246','PAYMENT_SUCCEEDED',123450,'EUR',clock_timestamp(),'SYNTHETIC-ANNUAL-CAPTURE-246',repeat('7',64),repeat('8',64)));
select set_config('test.annual_payment',(select id::text from public.subscription_payment_events where provider_event_id='SYNTHETIC-ANNUAL-EVENT-246'),true);
select set_config('request.jwt.claim.sub','a2460000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2460000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p246 values('annual_wallet',public.ensure_client_credit_wallet('b2460000-0000-4000-8000-000000000003','funding246-annual-wallet'));
insert into p246 values('annual_terms1',public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000003',current_setting('test.annual_payment')::bigint,1)),('annual_terms2',public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000003',current_setting('test.annual_payment')::bigint,2)),('annual_future',public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000003',current_setting('test.annual_payment')::bigint,4));
select is((select v#>>'{terms,quantity}'from p246 where k='annual_terms1'),'10','annual billing preserves the monthly credit quantity');
select lives_ok($$select public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000003',current_setting('test.annual_payment')::bigint,1,(select v#>>'{terms,terms_hash}'from p246 where k='annual_terms1'),'funding246-annual-month1')$$,'the first monthly slot of an annual payment can issue');
select throws_ok($$select public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000003',current_setting('test.annual_payment')::bigint,2,(select v#>>'{terms,terms_hash}'from p246 where k='annual_terms2'),'funding246-annual-month2')$$,'55000','CREDIT_SUBSCRIPTION_GRANT_NOT_DUE','the next monthly annual slot cannot be released before its actual due date');
select throws_ok($$select public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000003',current_setting('test.annual_payment')::bigint,4,(select v#>>'{terms,terms_hash}'from p246 where k='annual_future'),'funding246-annual-future')$$,'55000','CREDIT_SUBSCRIPTION_GRANT_NOT_DUE','an annual payment cannot release future monthly credits early');
select throws_ok($$select public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000003',current_setting('test.annual_payment')::bigint,13)$$,'22023','CREDIT_SUBSCRIPTION_GRANT_MONTH_INVALID','annual grants are bounded to the twelve funded months');
select is((select count(*)::integer from public.credit_lot_payment_sources_v1 where payment_event_id=current_setting('test.annual_payment')::bigint),1,'future or invalid monthly grants leave no funding binding');
select throws_ok($$select public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.live_payment')::bigint,1)$$,'55000','CREDIT_SUBSCRIPTION_PAYMENT_SOURCE_REQUIRED','a payment from a different organization cannot be attached to the selected wallet');
select set_config('request.jwt.claims','{"sub":"a2460000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.issue_subscription_credit_grant_v1('b2460000-0000-4000-8000-000000000001',current_setting('test.demo_payment')::bigint,1,(select v#>>'{terms,terms_hash}'from p246 where k='terms'),'funding246-subscription-grant')$$,'42501','CREDIT_SUBSCRIPTION_GRANT_DENIED','AAL1 cannot even replay a sensitive grant');
set local role authenticated;
select set_config('request.jwt.claim.sub','a2460000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2460000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.credit_lot_payment_sources_v1 where organization_id='b2460000-0000-4000-8000-000000000001'),0,'another tenant cannot read funding provenance rows');
select throws_ok($$select public.list_credit_lot_funding_statuses_v1(array['b2460000-0000-4000-8000-000000000001'::uuid])$$,'42501','CREDIT_FUNDING_READ_DENIED','the status RPC rejects a foreign organization before returning any inventory');
select lives_ok($$select public.list_credit_lot_funding_statuses_v1(array['b2460000-0000-4000-8000-000000000002'::uuid])$$,'a member may read the status of their own historical lots');
select throws_ok($$select public.get_subscription_credit_grant_context_v1('b2460000-0000-4000-8000-000000000002',current_setting('test.live_payment')::bigint,1)$$,'42501','CREDIT_SUBSCRIPTION_GRANT_DENIED','a Client owner does not become a platform credit issuer');
select ok(not has_table_privilege('authenticated','public.credit_lot_payment_sources_v1','INSERT')and not has_table_privilege('service_role','public.credit_lot_payment_sources_v1','INSERT'),'neither authenticated users nor generic service role can fabricate funding bindings');
reset role;
select ok(not has_function_privilege('authenticated','private.subscription_credit_grant_terms_v1(uuid,bigint,integer)','EXECUTE'),'the privileged canonical terms helper is not an API bypass');
reset role;
select *from finish();
rollback;
