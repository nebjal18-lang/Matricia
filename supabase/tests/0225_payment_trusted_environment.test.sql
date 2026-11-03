begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0223',configured_at=clock_timestamp()where singleton;
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
('a2230000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-223@example.invalid','',now(),'{}','{}',now(),now()),
('a2230000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-223@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2230000-0000-4000-8000-000000000001','Payment 223 SARL','Payment 223','ACTIVE','a2230000-0000-4000-8000-000000000001'),
('b2230000-0000-4000-8000-000000000002','Other 223 SARL','Other 223','ACTIVE','a2230000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2230000-0000-4000-8000-000000000001','b2230000-0000-4000-8000-000000000001','a2230000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2230000-0000-4000-8000-000000000002','b2230000-0000-4000-8000-000000000002','a2230000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c2230000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2230000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d2230000-0000-4000-8000-000000000001','PREMIUM','ACTIVE','a2230000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2230000-0000-4000-8000-000000000002','d2230000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a2230000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2230000-0000-4000-8000-000000000001','b2230000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2230000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a2230000-0000-4000-8000-000000000002','FINANCE_MANAGER');

-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting223(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2230000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING223_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING223_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0223','funding223-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0223');
end$$;

select pg_temp.seed_approved_box_checkout('b2230000-0000-4000-8000-000000000001','d2230000-0000-4000-8000-000000000002',3);
create temporary table p223(k text primary key,v jsonb);
insert into p223 values('paid-at',to_jsonb(statement_timestamp()));
select set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
update private.admin_execution_environment_v1 set environment=null where singleton;
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2230000-0000-4000-8000-000000000001','d2230000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','p223-null-context')$$,'55000','PAYMENT_DEPLOYMENT_ENVIRONMENT_UNCONFIGURED','no payment work is prepared against an unconfigured database');
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select set_config('matricia.environment','DEVELOPMENT',true);
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2230000-0000-4000-8000-000000000001','d2230000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','p223-spoof-demo')$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','caller development hint cannot enable DEMO on production database');
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2230000-0000-4000-8000-000000000001','d2230000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','p223-sandbox-prod')$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','PayPal sandbox cannot prepare a production payment');
select throws_ok($$select public.register_subscription_payment_intent('b2230000-0000-4000-8000-000000000001','d2230000-0000-4000-8000-000000000002','MONTHLY','DEMO','demo-payment-223',12345,'EUR','p223-legacy-demo')$$,'42501','PAYMENT_PROVIDER_ENVIRONMENT_REQUIRED','legacy user registration cannot attach arbitrary provider identifiers in production');
select pg_temp.approve_posting223('PRODUCTION');
select set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p223 values('prep',public.prepare_subscription_payment_intent_v2('b2230000-0000-4000-8000-000000000001','d2230000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','LIVE','p223-live-prepare'));
select throws_ok($$select public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p223 where k='prep'),'LIVE','ORDER-LIVE-223',12345,'EUR')$$,'42501','PAYMENT_SERVER_REGISTRATION_REQUIRED','forging LIVE preparation metadata never grants client registration authority');
select ok(not has_function_privilege('authenticated','public.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid)','EXECUTE')and has_function_privilege('service_role','public.register_subscription_payment_intent_v2(uuid,text,text,bigint,character,uuid)','EXECUTE'),'external provider result registration is service-only');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p223 where k='prep'),'SANDBOX','ORDER-SANDBOX-223',12345,'EUR')$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','backend provider result must match production preparation environment');
insert into p223 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p223 where k='prep'),'LIVE','ORDER-LIVE-223',12345,'EUR'));
select ok((select provider_environment='LIVE'and deployment_environment='PRODUCTION'from public.subscription_payment_intents where id=(select(v->>'payment_intent_id')::uuid from p223 where k='intent')),'new intent retains actual provider and trusted database environment');
select throws_ok($$select public.process_verified_subscription_payment('DEMO','EVENT-DEMO-223','ORDER-LIVE-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-DEMO-223',repeat('a',64),repeat('b',64))$$,'42501','PAYMENT_PROVIDER_ENVIRONMENT_REQUIRED','legacy service callback cannot mark DEMO paid on production database');
select throws_ok($$select public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','EVENT-SANDBOX-223','ORDER-LIVE-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-SANDBOX-223',repeat('a',64),repeat('b',64))$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','verified sandbox event is still not a production payment');
select is((select count(*)from public.subscription_payment_events where organization_id='b2230000-0000-4000-8000-000000000001'),0::bigint,'forbidden callbacks create no paid event');
-- Normalized verifier-owned metadata fixture only: no real PayPal call/payment is made.
insert into p223 values('paid',public.process_verified_subscription_payment_v2('PAYPAL','LIVE','EVENT-LIVE-223','ORDER-LIVE-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-LIVE-223',repeat('a',64),repeat('b',64)));
select is((select v->>'outcome'from p223 where k='paid'),'SUBSCRIPTION_ACTIVATED','only matching verified LIVE context can run the existing activation core');
select ok((select provider_environment='LIVE'and deployment_environment='PRODUCTION'from public.subscription_payment_events where provider_event_id='EVENT-LIVE-223'),'paid event keeps the immutable verified provider context');
select is(public.process_verified_subscription_payment_v2('PAYPAL','LIVE','EVENT-LIVE-223','ORDER-LIVE-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-LIVE-223',repeat('a',64),repeat('b',64))->>'replayed','true','matching native event replay remains idempotent');
select is((select count(*)from public.subscription_cycles where organization_id='b2230000-0000-4000-8000-000000000001'),1::bigint,'replay never grants a second paid cycle');
select set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p223 where k='intent'),'LIVE')->>'provider_intent_id','ORDER-LIVE-223','capture reads only the server-registered matching order');
select throws_ok($$select public.prepare_subscription_payment_capture_v2((select(v->>'payment_intent_id')::uuid from p223 where k='intent'),'SANDBOX')$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','sandbox capture is refused before external API access');
insert into p223 select'refund',jsonb_build_object('id',public.request_subscription_refund_v1(id,4000,'Environment binding refund fixture','f2230000-0000-4000-8000-000000000001'))from public.subscription_payment_events where provider_event_id='EVENT-LIVE-223';
select set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_subscription_refund_v1((select(v->>'id')::uuid from p223 where k='refund'),true);
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.prepare_subscription_refund_send_v2((select(v->>'id')::uuid from p223 where k='refund'),'SANDBOX')$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','wrong provider environment cannot move refund into SENDING');
select is((select status from public.subscription_refund_requests where id=(select(v->>'id')::uuid from p223 where k='refund')),'AUTHORIZED','mismatched refund environment changes no durable send state');
select throws_ok($$select public.prepare_subscription_refund_send_v1((select(v->>'id')::uuid from p223 where k='refund'))$$,'42501','PAYMENT_PROVIDER_ENVIRONMENT_REQUIRED','old refund preparation cannot bypass production environment checks');
select throws_ok($$select public.process_verified_subscription_adjustment_v1('ADJUST-LEGACY-223','CAPTURE-LIVE-223','REFUND-223','REFUND_SUCCEEDED',4000,'EUR',clock_timestamp(),repeat('c',64),repeat('d',64))$$,'42501','PAYMENT_PROVIDER_ENVIRONMENT_REQUIRED','old adjustment callback cannot bypass environment checks');
select throws_ok($$select public.process_verified_subscription_adjustment_v2('SANDBOX','ADJUST-SANDBOX-223','CAPTURE-LIVE-223','REFUND-223','REFUND_SUCCEEDED',4000,'EUR',clock_timestamp(),repeat('c',64),repeat('d',64))$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','sandbox adjustment cannot affect a live payment');
update private.admin_execution_environment_v1 set environment=null where singleton;
select is(public.process_verified_subscription_payment_v2('PAYPAL','LIVE','EVENT-LIVE-223','ORDER-LIVE-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-LIVE-223',repeat('a',64),repeat('b',64))->>'replayed','true','unknown deployment preserves a previously applied immutable LIVE fact without a new financial effect');
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
select is(public.process_verified_subscription_payment_v2('PAYPAL','LIVE','EVENT-LIVE-223','ORDER-LIVE-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-LIVE-223',repeat('a',64),repeat('b',64))->>'replayed','true','a promotion does not erase an actual applied LIVE receipt or duplicate its cycle');
select ok(not has_function_privilege('service_role','private.process_subscription_payment_context_core_v1(text,text,text,text,text,bigint,character,timestamptz,text,text,text,uuid)','EXECUTE'),'private payment core cannot be called directly to bypass context checks');
select set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select pg_temp.approve_posting223('DEVELOPMENT');
insert into public.subscriptions(id,organization_id,status)values('e2230000-0000-4000-8000-000000000002','b2230000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2230000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2230000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p223 values('sandbox-prep',public.prepare_subscription_payment_intent_v2('b2230000-0000-4000-8000-000000000002','d2230000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','p223-sandbox-prepare'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p223 values('sandbox-intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p223 where k='sandbox-prep'),'SANDBOX','ORDER-SANDBOX-PREEXISTING-223',12345,'EUR'));
update private.admin_execution_environment_v1 set environment='PRODUCTION'where singleton;
select is(public.process_verified_subscription_payment_v2('PAYPAL','LIVE','EVENT-LIVE-FORGED-223','ORDER-SANDBOX-PREEXISTING-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-FORGED-223',repeat('a',64),repeat('b',64))->>'outcome','SUBSCRIPTION_CAPTURE_RECONCILIATION_REQUIRED','unmatched verified LIVE metadata is retained for investigation without turning a SANDBOX source into paid funding');
select is((select count(*)from public.subscription_payment_events where organization_id='b2230000-0000-4000-8000-000000000002'),0::bigint,'cross-environment source never becomes an applied payment');
select throws_ok($$select public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','EVENT-SANDBOX-PREEXISTING-223','ORDER-SANDBOX-PREEXISTING-223','PAYMENT_SUCCEEDED',12345,'EUR',(select(v#>>'{}')::timestamptz from p223 where k='paid-at'),'CAPTURE-SANDBOX-223',repeat('a',64),repeat('b',64))$$,'42501','PAYMENT_NON_LIVE_PRODUCTION_FORBIDDEN','a sandbox order remains unpayable after the deployment changes to production');
select is((select count(*)from public.subscription_cycles where organization_id='b2230000-0000-4000-8000-000000000001'),1::bigint,'environment mismatch leaves the existing paid cycle unchanged');
select*from finish();rollback;
