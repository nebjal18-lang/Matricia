begin;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0183',configured_at=clock_timestamp()where singleton;
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
select plan(27);
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a1830000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-183@example.invalid','',now(),'{}','{}',now(),now()),
('a1830000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-183@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b1830000-0000-4000-8000-000000000001','Payment 183 SARL','Payment 183','ACTIVE','a1830000-0000-4000-8000-000000000001'),
('b1830000-0000-4000-8000-000000000002','Other 183 SARL','Other 183','ACTIVE','a1830000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c1830000-0000-4000-8000-000000000001','b1830000-0000-4000-8000-000000000001','a1830000-0000-4000-8000-000000000001','ACTIVE',now()),
('c1830000-0000-4000-8000-000000000002','b1830000-0000-4000-8000-000000000002','a1830000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c1830000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1830000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d1830000-0000-4000-8000-000000000001','PREMIUM','ACTIVE','a1830000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d1830000-0000-4000-8000-000000000002','d1830000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a1830000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e1830000-0000-4000-8000-000000000001','b1830000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a1830000-0000-4000-8000-000000000001','MATRICIA_ADMIN'),('a1830000-0000-4000-8000-000000000002','MATRICIA_ADMIN');
insert into public.platform_user_roles(user_id,role_code)values('a1830000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a1830000-0000-4000-8000-000000000002','FINANCE_MANAGER');
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting183(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a1830000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a1830000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d1830000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING183_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING183_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0183','funding183-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a1830000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a1830000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0183');
end$$;
select pg_temp.approve_posting183('DEVELOPMENT');

select pg_temp.seed_approved_box_checkout('b1830000-0000-4000-8000-000000000001','d1830000-0000-4000-8000-000000000002',3);
create temporary table p183_results(kind text primary key,value jsonb);
select set_config('request.jwt.claim.sub','a1830000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a1830000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p183_results values('prep',public.prepare_subscription_payment_intent_v2('b1830000-0000-4000-8000-000000000001','d1830000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','preparation-183-key'));
select is((select value->>'amount_minor'from p183_results where kind='prep'),'12345','prepared amount is server plan amount');
select is(public.prepare_subscription_payment_intent_v2('b1830000-0000-4000-8000-000000000001','d1830000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','preparation-183-key')->>'preparation_id',(select value->>'preparation_id'from p183_results where kind='prep'),'same key retains the exact preparation without another provider creation authorization');
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b1830000-0000-4000-8000-000000000001','d1830000-0000-4000-8000-000000000002','ANNUAL','PAYPAL','SANDBOX','preparation-183-key')$$,'22000','IDEMPOTENCY_PAYLOAD_MISMATCH','changed amount cannot reuse provider key');
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b1830000-0000-4000-8000-000000000002','d1830000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','preparation-183-other')$$,'42501','PAYMENT_INTENT_CREATE_DENIED','non-member refused before provider effect');
select is((select count(*)from public.audit_events where action='subscription.payment_intent_prepared'and organization_id='b1830000-0000-4000-8000-000000000001'),1::bigint,'preparation is audited once');
select is((select count(*)from public.event_outbox where event_type='SubscriptionPaymentIntentPreparedV1'and organization_id='b1830000-0000-4000-8000-000000000001'),1::bigint,'preparation emits one durable event');
select ok(not has_table_privilege('authenticated','public.subscription_payment_preparations','INSERT')and not has_table_privilege('service_role','public.subscription_payment_preparations','UPDATE'),'payment preparation has no direct write grants');
select throws_ok($$select public.record_operational_heartbeat_v1('P183_WORKER',true,60)$$,'42501','FORBIDDEN','only service can attest heartbeat');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select is(public.operational_health_v1(array['P183_WORKER'])->>'dependencies_ok','false','missing required heartbeat is unhealthy');
select public.record_operational_heartbeat_v1('P183_WORKER',true,60);
select is(public.operational_health_v1(array['P183_WORKER'])->>'dependencies_ok','true','fresh healthy heartbeat is healthy');
update public.operational_heartbeats set observed_at=clock_timestamp()-interval'2 minutes'where service_code='P183_WORKER';
select is(public.operational_health_v1(array['P183_WORKER'])->>'dependencies_ok','false','stopped worker expires after its bound');
select public.record_operational_heartbeat_v1('P183_WORKER',false,60);
select is(public.operational_health_v1(array['P183_WORKER'])->>'dependencies_ok','false','unhealthy dependency fails readiness');
insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,dead_lettered_at,last_error_code)values('test','p183','AdminActionAuthorizedV1','f1830000-0000-4000-8000-000000000001','{}','p183-dlq',clock_timestamp(),'OUTBOX_DISPATCH_FAILED'),('test','p183-ambiguous','OrganizationEmailInvitationRequestedV1','f1830000-0000-4000-8000-000000000002','{}','p183-ambiguous',clock_timestamp(),'OUTBOX_DISPATCH_FAILED');
select is((select outbox_ok from public.readiness_status()),false,'DLQ fails readiness');
select ok(not(public.operational_health_v1('{}')->'dead_letters'@> '[{"payload":{}}]'),'safe health never exposes payloads');
select set_config('request.jwt.claims','{"sub":"a1830000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p183_results values('replay',jsonb_build_object('id',public.request_operational_replay_v1((select id from public.event_outbox where idempotency_key='p183-dlq'),'Incident fixed; idempotent consumer','f1830000-0000-4000-8000-000000000003')));
select throws_ok($$select public.approve_operational_replay_v1((select(value->>'id')::uuid from p183_results where kind='replay'))$$,'42501','FOUR_EYES_REQUIRED','requester cannot approve own replay');
select throws_ok($$select public.request_operational_replay_v1((select id from public.event_outbox where idempotency_key='p183-ambiguous'),'Ambiguous external effect must reconcile','f1830000-0000-4000-8000-000000000004')$$,'23514','REPLAY_DEAD_LETTER_REQUIRED','ambiguous email delivery cannot be blindly replayed');
select set_config('request.jwt.claim.sub','a1830000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"a1830000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(public.approve_operational_replay_v1((select(value->>'id')::uuid from p183_results where kind='replay'))->>'outcome','REPLAY_SCHEDULED','distinct administrator can schedule idempotent replay');
select is(public.approve_operational_replay_v1((select(value->>'id')::uuid from p183_results where kind='replay'))->>'outcome','REPLAY_SCHEDULED','approval replay remains idempotent');
select is((select count(*)from public.audit_events where action='outbox.replay.approved'and resource_id=(select value->>'id'from p183_results where kind='replay')),1::bigint,'approval is audited once');
select ok((select dead_lettered_at is null and attempt_count=0 and published_at is null from public.event_outbox where idempotency_key='p183-dlq'),'replay schedules work without pretending effect occurred');
select ok(not has_function_privilege('authenticated','public.record_resend_receipt_v1(text,text,text,text,timestamptz)','EXECUTE'),'receipt ingester is not client callable');
select ok(not has_table_privilege('service_role','public.notification_provider_receipts','INSERT'),'service cannot forge receipts outside verification RPC');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select throws_ok($$select public.record_resend_receipt_v1('evt-183','email-183',null,repeat('a',64),now())$$,'22023','INVALID_EMAIL_RECEIPT','null receipt status rejected');
select throws_ok($$select public.record_resend_receipt_v1('evt-183','email-183','DELIVERED',repeat('a',64),null)$$,'22023','INVALID_EMAIL_RECEIPT','null receipt date rejected');
select throws_ok($$select public.record_resend_receipt_v1('evt-183','email-183','DELIVERED',repeat('a',64),now())$$,'P0002','EMAIL_DELIVERY_NOT_FOUND','unknown provider message cannot mark delivery');
select ok((select relrowsecurity from pg_class where oid='public.notification_email_suppressions'::regclass),'email suppression is RLS protected');
select ok(private.operational_event_replay_is_safe('ProviderCreditNoteIssuedV1',null),'immutable bilingual credit-note consumer can resume after configuration repair');
select * from finish();
rollback;
