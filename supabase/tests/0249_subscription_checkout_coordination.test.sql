begin;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0249',configured_at=clock_timestamp()where singleton;
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
  benefit jsonb; box jsonb; rule jsonb; approval_context jsonb; admission_context jsonb; admission jsonb;
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
  -- Freeze a genuinely approved human-execution/independent-receipt policy in
  -- the offered Box source before its independent review and before any PSP.
  admission_context:=public.get_admin_benefit_admission_context_v1((benefit->>'benefit_version_id')::uuid);
  admission:=public.propose_benefit_admission_policy_v1((benefit->>'benefit_version_id')::uuid,
    admission_context->>'source_hash',(admission_context->>'head_id')::uuid,
    'NONE',null,null,'{}','{}',clock_timestamp()-interval'1 minute',null,
    'TEST ONLY explicit human execution and independent Client receipt for checkout coordination',
    'TEST-0249-CHECKOUT-ADMISSION','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid());
  perform set_config('request.jwt.claim.sub',reviewer_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer_id,'role','authenticated','aal','aal2')::text,true);
  perform public.decide_benefit_admission_policy_v1((admission->>'policy_id')::uuid,admission->>'content_hash',true,
    'TEST-0249-INDEPENDENT-REVIEW','TEST ONLY independent approval of the exact offered execution policy');
  perform set_config('request.jwt.claim.sub',author_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',author_id,'role','authenticated','aal','aal2')::text,true);
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
('a2490000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-249@example.invalid','',now(),'{}','{}',now(),now()),
('a2490000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-249@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2490000-0000-4000-8000-000000000001','Payment 249 SARL','Payment 249','ACTIVE','a2490000-0000-4000-8000-000000000001'),
('b2490000-0000-4000-8000-000000000002','Other 249 SARL','Other 249','ACTIVE','a2490000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2490000-0000-4000-8000-000000000001','b2490000-0000-4000-8000-000000000001','a2490000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2490000-0000-4000-8000-000000000002','b2490000-0000-4000-8000-000000000002','a2490000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c2490000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2490000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d2490000-0000-4000-8000-000000000001','PLATINUM','ACTIVE','a2490000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2490000-0000-4000-8000-000000000002','d2490000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a2490000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2490000-0000-4000-8000-000000000001','b2490000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2490000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a2490000-0000-4000-8000-000000000002','FINANCE_MANAGER');

select pg_temp.seed_approved_box_checkout('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002',3);
create temporary table p249(k text primary key,v jsonb);

insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','FUNDING_PROBE',true);
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting249(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2490000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING249_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING249_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0249','funding249-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0249');
end$$;
select pg_temp.approve_posting249('DEVELOPMENT');
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);

-- Native order verification itself is exercised in the infrastructure HTTP adapter tests.
-- This fixture verifies trusted-service SQL receipt/fencing contracts, not a real PSP signature.
select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','funding249-aal1-create')$$,'42501','PAYMENT_CUSTOMER_MFA_REQUIRED','direct AAL1 checkout is refused before any provider-creation authority');
select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p249 values('prep',public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','funding249-first-order'));
select is((select v->>'create_authorized'from p249 where k='prep'),'true','only first reservation authorizes creating the external order');
select ok((select source_snapshot#>>'{options,0,source_snapshot,slots,0,benefits,0,admission_policy,policy_id}'is not null from private.subscription_prepared_box_terms_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p249 where k='prep')),'the first PSP authority includes a frozen approved execution policy');
select ok(exists(select 1 from public.benefit_admission_policy_versions_v1 policy join public.benefit_admission_policy_decisions_v1 decision on decision.policy_id=policy.id and decision.decision='APPROVE'and decision.content_hash=policy.content_hash and decision.decided_by<>policy.created_by where policy.id=(select(source_snapshot#>>'{options,0,source_snapshot,slots,0,benefits,0,admission_policy,policy_id}')::uuid from private.subscription_prepared_box_terms_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p249 where k='prep'))),'the frozen offered policy was independently approved through native governance');
select ok((select provider_create_authorized_at is not null from private.subscription_checkout_attempts_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p249 where k='prep')),'commercial anchoring has an explicit pre-PSP authority marker, not a timestamp inference');
select is(public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','funding249-first-order')->>'create_authorized','false','same-key uncertainty cannot authorize a second PSP POST');
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','funding249-second-order')$$,'55000','SUBSCRIPTION_CHECKOUT_ALREADY_PENDING','different key cannot open another payable subscription attempt');
update private.subscription_checkout_attempts_v1 set created_at=clock_timestamp()-interval'90 days'where organization_id='b2490000-0000-4000-8000-000000000001';
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','funding249-timeout-order')$$,'55000','SUBSCRIPTION_CHECKOUT_ALREADY_PENDING','elapsed time never proves the absence of a payable order');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p249 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p249 where k='prep'),'SANDBOX','SYNTHETIC-FIRST-ORDER-249',12345,'EUR'));
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p249 where k='intent'),'SANDBOX')$$,'42501','PAYMENT_CAPTURE_DENIED','direct AAL1 capture cannot bypass the financial layout');
select ok((select state='REGISTERED'from private.subscription_checkout_attempts_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p249 where k='prep'))and not exists(select 1 from private.subscription_capture_receipts_v1 where payment_intent_id=(select(v->>'payment_intent_id')::uuid from p249 where k='intent'))and not exists(select 1 from public.financial_journals where organization_id='b2490000-0000-4000-8000-000000000001'and journal_type='SUBSCRIPTION_PAYMENT'),'AAL1 refusal authorizes no capture call and records no receipt or monetary effect');
select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p249 values('capture-prep',public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p249 where k='intent'),'SANDBOX'));
select is((select v->>'capture_authorized'from p249 where k='capture-prep'),'true','first capture transition alone authorizes the PSP call');
select is(public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p249 where k='intent'),'SANDBOX')->>'capture_authorized','false','ambiguous capture retry reads native state instead of sending another capture');
select is(public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p249 where k='intent'),'SANDBOX')->>'capture_operation_key',(select v->>'capture_operation_key'from p249 where k='capture-prep'),'same order retains its stable capture operation identity');
select is((select state from private.subscription_checkout_attempts_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p249 where k='prep')),'CAPTURE_REQUESTED','capture is journaled before the external call');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.record_subscription_checkout_native_resolution_v1((select(v->>'preparation_id')::uuid from p249 where k='prep'),'SANDBOX','SYNTHETIC-FIRST-ORDER-249','APPROVED',repeat('a',64),clock_timestamp())$$,'23514','CHECKOUT_NATIVE_RESOLUTION_REQUIRED','approval is not proof of a voided order');
select throws_ok($$select public.record_subscription_checkout_native_resolution_v1((select(v->>'preparation_id')::uuid from p249 where k='prep'),'SANDBOX','SYNTHETIC-FIRST-ORDER-249','VOIDED',repeat('a',64),clock_timestamp()-interval'2 minutes')$$,'23514','CHECKOUT_NATIVE_RESOLUTION_REQUIRED','stale native status cannot release a payable order');
select is(public.record_subscription_checkout_native_resolution_v1((select(v->>'preparation_id')::uuid from p249 where k='prep'),'SANDBOX','SYNTHETIC-FIRST-ORDER-249','VOIDED',repeat('a',64),clock_timestamp())->>'outcome','SUBSCRIPTION_CHECKOUT_VOID_VERIFIED','trusted fresh native VOIDED evidence releases the attempt');
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p249 values('new-prep',public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','funding249-new-after-void'));
select is((select v->>'create_authorized'from p249 where k='new-prep'),'true','fresh key is permitted only after the verified native disposition');
-- Late discovery of an older uncoordinated provider order; this is a fixture-only
-- predecessor invocation, never a public permission to prepare a second payable order.
insert into p249 values('legacy-prep',private.prepare_subscription_payment_admission_v1('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','funding249-legacy-order','SANDBOX',false));
select private.prepare_payment_posting_context_v1((select(v->>'preparation_id')::uuid from p249 where k='legacy-prep'),'b2490000-0000-4000-8000-000000000001','SUBSCRIPTION','d2490000-0000-4000-8000-000000000002','EUR','PAYPAL','SANDBOX');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p249 values('legacy-intent',private.register_subscription_intent_before_coordination_v2((select(v->>'preparation_id')::uuid from p249 where k='legacy-prep'),'SANDBOX','SYNTHETIC-LEGACY-ORDER-249',12345,'EUR'));
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000001','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','funding249-first-order')$$,'55000','SUBSCRIPTION_CHECKOUT_RECONCILIATION_REQUIRED','a voided original key cannot start another PSP creation');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p249 values('new-intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p249 where k='new-prep'),'SANDBOX','SYNTHETIC-SECOND-ORDER-249',12345,'EUR'));
insert into p249 values('paid-at',to_jsonb(statement_timestamp()));
insert into p249 values('paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-PAID-EVENT-249','SYNTHETIC-SECOND-ORDER-249','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p249 where k='paid-at'),'SYNTHETIC-PAID-CAPTURE-249',repeat('b',64),repeat('c',64),'e2490000-0000-4000-8000-000000000005'));
select is((select v->>'outcome'from p249 where k='paid'),'SUBSCRIPTION_ACTIVATED','canonical capture applies against the exact frozen suspense journal');
select is((select count(*)from public.subscription_cycles where organization_id='b2490000-0000-4000-8000-000000000001'),1::bigint,'one native capture creates exactly one funded cycle');
select is((select count(*)from public.financial_journals where organization_id='b2490000-0000-4000-8000-000000000001'and journal_type='SUBSCRIPTION_PAYMENT'),1::bigint,'cash is posted once rather than by both receipt and activation');
insert into p249 values('legacy-paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-LEGACY-EVENT-249','SYNTHETIC-LEGACY-ORDER-249','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p249 where k='paid-at'),'SYNTHETIC-LEGACY-CAPTURE-249',repeat('d',64),repeat('e',64),'e2490000-0000-4000-8000-000000000006'));
select is((select v->>'outcome'from p249 where k='legacy-paid'),'SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED','a genuinely paid legacy second order is retained instead of rolling back its cash fact');
select is((select count(*)from public.subscription_cycles where organization_id='b2490000-0000-4000-8000-000000000001'),1::bigint,'retained second payment does not invent another subscription activation');
select is((select count(*)from public.financial_journals where organization_id='b2490000-0000-4000-8000-000000000001'and journal_type='SUBSCRIPTION_PAYMENT'),2::bigint,'second native cash has its own balanced suspense journal');
select is(public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-LEGACY-EVENT-249','SYNTHETIC-LEGACY-ORDER-249','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p249 where k='paid-at'),'SYNTHETIC-LEGACY-CAPTURE-249',repeat('d',64),repeat('f',64))->>'replayed','true','signature rotation on the same exact event does not duplicate its receipt');
select is((select count(*)from public.financial_journals where organization_id='b2490000-0000-4000-8000-000000000001'and journal_type='SUBSCRIPTION_PAYMENT'),2::bigint,'replay creates no additional cash journal');
select throws_ok($$select public.record_subscription_checkout_native_resolution_v1((select(v->>'preparation_id')::uuid from p249 where k='new-prep'),'SANDBOX','SYNTHETIC-SECOND-ORDER-249','VOIDED',repeat('a',64),clock_timestamp())$$,'55000','CAPTURED_CHECKOUT_CANNOT_BE_RELEASED','native release cannot erase an actual retained capture');
-- Generic callback receipt survives before its purpose can be resolved by registration.
insert into p249 values('inbox',public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-INBOX-EVENT-249','PAYMENT_SUCCEEDED','SYNTHETIC-UNREGISTERED-ORDER-249',jsonb_build_object('provider_intent_id','SYNTHETIC-UNREGISTERED-ORDER-249','payment_reference','SYNTHETIC-UNREGISTERED-CAPTURE-249','amount_minor','12345','currency','EUR','occurred_at',statement_timestamp()),repeat('1',64),repeat('2',64),'e2490000-0000-4000-8000-000000000007'));
select is((select v->>'outcome'from p249 where k='inbox'),'VERIFIED_PAYMENT_RECEIPT_RECORDED','verified notification persists before knowing its purchase kind');
select throws_ok($$select public.complete_verified_payment_dispatch_v1((select(v->>'receipt_id')::uuid from p249 where k='inbox'),'SUBSCRIPTION','DISPATCHED',null,extensions.gen_random_uuid())$$,'55000','PAYMENT_DOMAIN_RECEIPT_REQUIRED','service cannot acknowledge a guessed domain without an actual domain receipt');
select is(public.load_verified_payment_inbox_dispatch_v1((select(v->>'receipt_id')::uuid from p249 where k='inbox'))->>'correlation_id','e2490000-0000-4000-8000-000000000007','replay uses the first immutable receipt correlation');
select is((select count(*)from public.event_outbox where event_type='VerifiedPaymentDispatchRequestedV1'and aggregate_id=(select v->>'receipt_id'from p249 where k='inbox')),1::bigint,'receipt and retryable dispatch command are committed atomically');
select ok(not has_table_privilege('service_role','private.subscription_capture_receipts_v1','INSERT')and not has_function_privilege('authenticated','public.record_subscription_checkout_native_resolution_v1(uuid,text,text,text,text,timestamptz,uuid)','EXECUTE'),'untrusted callers cannot forge native proofs or direct receipt writes');

-- Exact native API evidence remains distinct from a webhook signature. No external PSP is contacted.
insert into public.subscriptions(id,organization_id,status)values('e2490000-0000-4000-8000-000000000002','b2490000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p249 values('native-prep',public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000002','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','e2490000-0000-4000-8000-000000000020'));
select is(public.prepare_subscription_native_order_review_v1((select(v->>'preparation_id')::uuid from p249 where k='native-prep'),'SANDBOX')->>'organization_id','b2490000-0000-4000-8000-000000000002','native recovery context is the exact authenticated frozen source');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p249 values('native-observed',public.record_verified_native_order_observation_v1('SUBSCRIPTION',(select(v->>'preparation_id')::uuid from p249 where k='native-prep'),'SANDBOX','SYNTHETIC-NATIVE-ORDER-249','COMPLETED',12345,'EUR','SYNTHETIC-NATIVE-CAPTURE-249',(select(v#>>'{}')::timestamptz from p249 where k='paid-at'),repeat('a',64),clock_timestamp(),'e2490000-0000-4000-8000-000000000021'));
select is((select v->>'outcome'from p249 where k='native-observed'),'NATIVE_ORDER_OBSERVATION_RECORDED','native GET proof is durable before registration or business import');
insert into p249 values('native-paid',public.record_native_subscription_payment_v1((select(v->>'preparation_id')::uuid from p249 where k='native-prep'),'SANDBOX','SYNTHETIC-NATIVE-ORDER-249','SYNTHETIC-NATIVE-CAPTURE-249',12345,'EUR',(select(v#>>'{}')::timestamptz from p249 where k='paid-at'),repeat('a',64),clock_timestamp(),'e2490000-0000-4000-8000-000000000021'));
select is((select v->>'outcome'from p249 where k='native-paid'),'SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED','orphan native order cash is preserved without claiming a webhook activation');
select ok((select verification_method='API_OAUTH2_TLS'and signature_fingerprint is null from private.subscription_capture_receipts_v1 where provider_intent_id='SYNTHETIC-NATIVE-ORDER-249'),'native response hash is never stored as a fake webhook signature');
select is((select count(*)from public.subscription_cycles where organization_id='b2490000-0000-4000-8000-000000000002'),0::bigint,'native receipt alone does not fabricate a contractual activation');
select is((select count(*)from public.financial_journals where organization_id='b2490000-0000-4000-8000-000000000002'and journal_type='SUBSCRIPTION_PAYMENT'),1::bigint,'native receipt posts the real cash once to its frozen suspense context');
insert into p249 values('native-webhook',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-NATIVE-WEBHOOK-249','SYNTHETIC-NATIVE-ORDER-249','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p249 where k='paid-at'),'SYNTHETIC-NATIVE-CAPTURE-249',repeat('1',64),repeat('2',64),'e2490000-0000-4000-8000-000000000022'));
select is((select v->>'outcome'from p249 where k='native-webhook'),'SUBSCRIPTION_ACTIVATED','later signed callback reconciles the exact native receipt and source journal');
select is((select count(*)from public.subscription_cycles where organization_id='b2490000-0000-4000-8000-000000000002'),1::bigint,'reconciled webhook grants exactly one funded period');
select is((select count(*)from public.financial_journals where organization_id='b2490000-0000-4000-8000-000000000002'and journal_type='SUBSCRIPTION_PAYMENT'),1::bigint,'webhook reuses the first native cash journal instead of posting twice');
select ok((select correlation_id='e2490000-0000-4000-8000-000000000021'::uuid from public.subscription_payment_events where provider_intent_id='SYNTHETIC-NATIVE-ORDER-249'),'activation uses the first native receipt correlation required by the immutable journal');
insert into p249 values('native-inbox',public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-NATIVE-WEBHOOK-249','PAYMENT_SUCCEEDED','SYNTHETIC-NATIVE-ORDER-249',jsonb_build_object('provider_intent_id','SYNTHETIC-NATIVE-ORDER-249','payment_reference','SYNTHETIC-NATIVE-CAPTURE-249','amount_minor','12345','currency','EUR','occurred_at',(select(v#>>'{}')from p249 where k='paid-at')),repeat('1',64),repeat('2',64),'e2490000-0000-4000-8000-000000000022'));
select is(public.complete_verified_payment_dispatch_v1((select(v->>'receipt_id')::uuid from p249 where k='native-inbox'),'SUBSCRIPTION','DISPATCHED',null,extensions.gen_random_uuid())->>'status','DISPATCHED','routing acknowledgement verifies an actual matching domain receipt');
select is(public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-NATIVE-WEBHOOK-249','PAYMENT_SUCCEEDED','SYNTHETIC-NATIVE-ORDER-249',jsonb_build_object('provider_intent_id','SYNTHETIC-NATIVE-ORDER-249','payment_reference','SYNTHETIC-NATIVE-CAPTURE-249','amount_minor','12345','currency','EUR','occurred_at',(select(v#>>'{}')from p249 where k='paid-at')),repeat('1',64),repeat('3',64),'e2490000-0000-4000-8000-000000000023')->>'replayed','true','rotated PayPal transmission proof retains the same immutable provider event');
select is((select count(*)from private.verified_payment_dispatch_proofs_v1 where inbox_id=(select(v->>'receipt_id')::uuid from p249 where k='native-inbox')),2::bigint,'distinct valid signature proofs are append-only evidence, not duplicate money');
select throws_ok($$update private.subscription_capture_receipts_v1 set amount_minor=99999 where provider_intent_id='SYNTHETIC-NATIVE-ORDER-249'$$,'55000','PAYMENT_RECEIPT_IMMUTABLE','cash source facts cannot be edited during reconciliation');
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.prepare_subscription_native_order_review_v1((select(v->>'preparation_id')::uuid from p249 where k='native-prep'),'SANDBOX')$$,'42501','CHECKOUT_NATIVE_REVIEW_DENIED','native recovery requires step-up authentication');
select throws_ok($$select public.load_verified_payment_inbox_dispatch_v1((select(v->>'receipt_id')::uuid from p249 where k='native-inbox'))$$,'42501','PAYMENT_INBOX_SERVICE_REQUIRED','browser callers cannot load provider proofs for forging a retry');

-- A verified adverse notification can precede its capture/adjustment routing.
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-DISPUTE-OPENED-249','DISPUTE_OPENED','SYNTHETIC-PAID-CAPTURE-249',jsonb_build_object('provider_payment_id','SYNTHETIC-PAID-CAPTURE-249','provider_adjustment_id','DISPUTE-249-A','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',(select(v#>>'{}')::timestamptz+interval'1 second'from p249 where k='paid-at')),repeat('5',64),repeat('6',64),extensions.gen_random_uuid());
select ok(private.payment_capture_has_adverse_fact_v1('PAYPAL','SANDBOX','SYNTHETIC-PAID-CAPTURE-249'),'durable OPEN blocks its exact capture before adjustment routing');
select ok(not private.subscription_financially_clear('b2490000-0000-4000-8000-000000000001'),'known adverse evidence prevents new rights before its hold is materialized');
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-DISPUTE-WON-249','DISPUTE_WON','SYNTHETIC-PAID-CAPTURE-249',jsonb_build_object('provider_payment_id','SYNTHETIC-PAID-CAPTURE-249','provider_adjustment_id','DISPUTE-249-A','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',(select(v#>>'{}')::timestamptz+interval'2 seconds'from p249 where k='paid-at')),repeat('7',64),repeat('8',64),extensions.gen_random_uuid());
select ok(not private.payment_capture_has_adverse_fact_v1('PAYPAL','SANDBOX','SYNTHETIC-PAID-CAPTURE-249'),'latest WON resolves only the matching dispute, without a permanent historical OPEN block');
select ok(private.subscription_financially_clear('b2490000-0000-4000-8000-000000000001'),'resolved inbox dispute preserves the genuine paid funding');
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2490000-0000-4000-8000-000000000003','Adverse 249 SARL','Adverse 249','ACTIVE','a2490000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values('c2490000-0000-4000-8000-000000000003','b2490000-0000-4000-8000-000000000003','a2490000-0000-4000-8000-000000000001','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c2490000-0000-4000-8000-000000000003','CLIENT_OWNER');
insert into public.subscriptions(id,organization_id,status)values('e2490000-0000-4000-8000-000000000003','b2490000-0000-4000-8000-000000000003','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p249 values('adverse-prep',public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000003','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','e2490000-0000-4000-8000-000000000030'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p249 values('adverse-intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p249 where k='adverse-prep'),'SANDBOX','SYNTHETIC-ADVERSE-ORDER-249',12345,'EUR'));
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-EARLY-REFUND-249','REFUND_SUCCEEDED','SYNTHETIC-ADVERSE-CAPTURE-249',jsonb_build_object('provider_payment_id','SYNTHETIC-ADVERSE-CAPTURE-249','provider_adjustment_id','REFUND-249-B','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',(select(v#>>'{}')::timestamptz+interval'1 second'from p249 where k='paid-at')),repeat('9',64),repeat('a',64),extensions.gen_random_uuid());
insert into p249 values('adverse-paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-ADVERSE-PAID-249','SYNTHETIC-ADVERSE-ORDER-249','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p249 where k='paid-at'),'SYNTHETIC-ADVERSE-CAPTURE-249',repeat('b',64),repeat('c',64),extensions.gen_random_uuid()));
select is((select v->>'outcome'from p249 where k='adverse-paid'),'SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED','a prior verified refund never disappears behind a later positive capture');
select is((select reason_code from private.subscription_capture_receipts_v1 where provider_intent_id='SYNTHETIC-ADVERSE-ORDER-249'),'VERIFIED_ADVERSE_PAYMENT_REVIEW_REQUIRED','operator sees the exact reason for blocked activation');
select is((select count(*)from public.subscription_cycles where organization_id='b2490000-0000-4000-8000-000000000003'),0::bigint,'known adverse payment creates no new paid cycle');
select is((select count(*)from public.financial_journals where organization_id='b2490000-0000-4000-8000-000000000003'and journal_type='SUBSCRIPTION_PAYMENT'),1::bigint,'the actual capture remains posted to suspense despite its blocked business use');

-- An old preparation's age or missing registration cannot prove PSP non-creation.
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2490000-0000-4000-8000-000000000004','Legacy unknown 249 SARL','Legacy unknown 249','ACTIVE','a2490000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values('c2490000-0000-4000-8000-000000000004','b2490000-0000-4000-8000-000000000004','a2490000-0000-4000-8000-000000000001','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values('c2490000-0000-4000-8000-000000000004','CLIENT_OWNER');
insert into public.subscriptions(id,organization_id,status)values('e2490000-0000-4000-8000-000000000004','b2490000-0000-4000-8000-000000000004','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2490000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2490000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p249 values('old-unknown',private.prepare_subscription_payment_admission_v1('b2490000-0000-4000-8000-000000000004','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','e2490000-0000-4000-8000-000000000040','SANDBOX',false));
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000004','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','e2490000-0000-4000-8000-000000000041')$$,'55000','SUBSCRIPTION_LEGACY_CHECKOUT_RECONCILIATION_REQUIRED','untracked legacy preparation blocks a second potentially payable source');
select is(public.prepare_subscription_payment_intent_v2('b2490000-0000-4000-8000-000000000004','d2490000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','e2490000-0000-4000-8000-000000000040')->>'create_authorized','false','same old key is reviewable but cannot authorize an uncertain second PSP creation');
select ok((select provider_create_authorized_at is null from private.subscription_checkout_attempts_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p249 where k='old-unknown')),'legacy uncertainty never gains a retrospective commercial authority marker');
select is((select count(*)from private.payment_posting_contexts_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p249 where k='old-unknown')),0::bigint,'current posting terms are not silently retrofitted to an unknown past PSP operation');
select*from finish();rollback;
