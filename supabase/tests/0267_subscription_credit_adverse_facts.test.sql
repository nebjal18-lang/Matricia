begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0267',configured_at=clock_timestamp()where singleton;
set local search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2670000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-267@example.invalid','',now(),'{}','{}',now(),now()),
('a2670000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-267@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2670000-0000-4000-8000-000000000001','Payment 267 SARL','Payment 267','ACTIVE','a2670000-0000-4000-8000-000000000001'),
('b2670000-0000-4000-8000-000000000002','Other 267 SARL','Other 267','ACTIVE','a2670000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2670000-0000-4000-8000-000000000001','b2670000-0000-4000-8000-000000000001','a2670000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2670000-0000-4000-8000-000000000002','b2670000-0000-4000-8000-000000000002','a2670000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c2670000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2670000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d2670000-0000-4000-8000-000000000001','GOLD','ACTIVE','a2670000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2670000-0000-4000-8000-000000000002','d2670000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a2670000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2670000-0000-4000-8000-000000000001','b2670000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2670000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a2670000-0000-4000-8000-000000000002','FINANCE_MANAGER');

create temporary table p267(k text primary key,v jsonb);

insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2670000-0000-4000-8000-000000000001','d2670000-0000-4000-8000-000000000002','FUNDING_PROBE',true);
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting267(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2670000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING267_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING267_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0267','funding267-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0267');
end$$;
select pg_temp.approve_posting267('DEVELOPMENT');

-- Transaction-local synthetic fixture helper. Every offer/version/approval is
-- created by its real public command. Callers choose explicit test-only terms.
create function pg_temp.approve_checkout_box_fixture(
 p_audit_org uuid,p_plan_version uuid,p_maker uuid,p_reviewer uuid,p_code text,
 p_currency text,p_credit_budget bigint,p_rollover_months integer
)returns jsonb language plpgsql as $$
declare benefit jsonb;box jsonb;rule jsonb;context jsonb;approval jsonb;begin
 if p_maker=p_reviewer then raise exception'TEST_REQUIRES_INDEPENDENT_FINANCE';end if;
 perform set_config('request.jwt.claim.sub',p_maker::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_maker,'role','authenticated','aal','aal2')::text,true);
 benefit:=public.create_benefit_version(p_audit_org,p_code||'_BENEFIT','CREDIT_SERVICE','MATRICIA_INTERNAL','Avantage synthétique de recette','ميزة اصطناعية للاختبار','Données exclusivement synthétiques de recette','بيانات اختبار اصطناعية فقط',p_credit_budget,0,0,p_currency,null,null,null,'{}','{}','TEST_CANCELLATION_V1',clock_timestamp()-interval'1 minute',p_code||'-benefit');
 perform public.activate_benefit_version(p_audit_org,(benefit->>'benefit_version_id')::uuid,p_code||'-activate-benefit');
 box:=public.create_box_version(p_audit_org,p_code,'FIXED','Box synthétique de recette','صندوق اصطناعي للاختبار',p_credit_budget,p_rollover_months,'{}',0,0,0,p_currency,clock_timestamp()-interval'1 minute',jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array(benefit->>'benefit_version_id'))),p_code||'-create');
 perform public.activate_box_version(p_audit_org,(box->>'box_version_id')::uuid,null,p_code||'-activate');
 rule:=public.link_plan_box_rule(p_audit_org,p_plan_version,(box->>'box_version_id')::uuid,'{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"EXACT"}',clock_timestamp()-interval'1 minute',p_code||'-link');
 context:=public.get_box_configuration_approval_context_v1((rule->>'plan_box_rule_id')::uuid);
 perform set_config('request.jwt.claim.sub',p_reviewer::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_reviewer,'role','authenticated','aal','aal2')::text,true);
 approval:=public.approve_box_configuration_v1((rule->>'plan_box_rule_id')::uuid,context->>'source_hash','Approbation indépendante exclusivement synthétique de recette',p_code||'-approve');
 perform set_config('request.jwt.claim.sub',p_maker::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_maker,'role','authenticated','aal','aal2')::text,true);
 return jsonb_build_object('box',box,'rule',rule,'approval',approval);
end$$;

-- Real public domain commands with synthetic SANDBOX provider attestations.
-- No external payment, cryptographic verification or real refund is claimed.
insert into p267 values('offer',pg_temp.approve_checkout_box_fixture('b2670000-0000-4000-8000-000000000001','d2670000-0000-4000-8000-000000000002','a2670000-0000-4000-8000-000000000001','a2670000-0000-4000-8000-000000000002','TEST_CREDIT_ADVERSE267','EUR',10,3));
insert into p267 values('benefit-context',public.get_admin_benefit_admission_context_v1((select source_snapshot#>>'{slots,0,benefits,0,id}'from public.box_configuration_approvals_v1 where id=(select(v#>>'{approval,approval_id}')::uuid from p267 where k='offer'))::uuid));
select set_config('test.benefit267',(select v->>'benefit_version_id'from p267 where k='benefit-context'),true);
insert into p267 values('benefit-policy',public.propose_benefit_admission_policy_v1(current_setting('test.benefit267')::uuid,(select v->>'source_hash'from p267 where k='benefit-context'),(select(v->>'head_id')::uuid from p267 where k='benefit-context'),'NONE',null,null,'{}','{}',clock_timestamp()-interval'1 minute',null,'TEST ONLY politique native de réservation pour contrôle SC','TEST_ONLY_ADVERSE267','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid()));
select set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p267 where k='benefit-policy'),(select v->>'content_hash'from p267 where k='benefit-policy'),true,'TEST_ONLY_267','TEST ONLY revue indépendante de la politique de réservation');
select set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p267 values('wallet1',public.ensure_client_credit_wallet('b2670000-0000-4000-8000-000000000001','adverse267-wallet1')),('wallet2',public.ensure_client_credit_wallet('b2670000-0000-4000-8000-000000000002','adverse267-wallet2'));
insert into p267 values('prep1',public.prepare_subscription_payment_intent_v2('b2670000-0000-4000-8000-000000000001','d2670000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','adverse267-prepare1'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p267 values('intent1',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p267 where k='prep1'),'SANDBOX','SYNTHETIC-SANDBOX-ORDER-267-1',12345,'EUR'));
insert into p267 values('paid1',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-SANDBOX-EVENT-267-1','SYNTHETIC-SANDBOX-ORDER-267-1','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-SANDBOX-CAPTURE-267-1',repeat('1',64),repeat('2',64)));
select set_config('test.payment267',(select id::text from public.subscription_payment_events where provider_event_id='SYNTHETIC-SANDBOX-EVENT-267-1'),true);
select set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p267 values('terms1',public.get_subscription_credit_grant_context_v1('b2670000-0000-4000-8000-000000000001',current_setting('test.payment267')::bigint,1));
insert into p267 values('lot1',public.issue_subscription_credit_grant_v1('b2670000-0000-4000-8000-000000000001',current_setting('test.payment267')::bigint,1,(select v#>>'{terms,terms_hash}'from p267 where k='terms1'),'adverse267-issue1'));
select set_config('test.lot267',(select v->>'credit_lot_id'from p267 where k='lot1'),true);
select is(private.credit_lot_funding_status_v1(current_setting('test.lot267')::uuid),'ELIGIBLE','real funded subscription lot is initially admissible');
insert into p267 values('reserved1',public.reserve_benefit_credits('b2670000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p267 where k='wallet1'),current_setting('test.benefit267')::uuid,1,clock_timestamp()+interval'1 day','adverse267-reserve1'));
select set_config('test.balance267',(select balance::text from public.credit_wallet_balances where wallet_id=(select(v->>'wallet_id')::uuid from p267 where k='wallet1')),true);
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-OPEN-267','DISPUTE_OPENED','SYNTHETIC-SANDBOX-CAPTURE-267-1',jsonb_build_object('provider_payment_id','SYNTHETIC-SANDBOX-CAPTURE-267-1','provider_adjustment_id','SYNTHETIC-DISPUTE-267','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',clock_timestamp()),repeat('3',64),repeat('4',64),extensions.gen_random_uuid());
select is(private.credit_lot_funding_status_v1(current_setting('test.lot267')::uuid),'PAYMENT_HELD','durable OPEN suspends the exact lot before adjustment routing');
select is((select count(*)from public.subscription_payment_adjustments where payment_event_id=current_setting('test.payment267')::bigint),0::bigint,'OPEN proof has not been routed into a native adjustment');
select is((select count(*)from public.subscription_financial_holds where payment_event_id=current_setting('test.payment267')::bigint and active),0::bigint,'the source guard does not wait for a materialized hold');
select is((select balance::text from public.credit_wallet_balances where wallet_id=(select(v->>'wallet_id')::uuid from p267 where k='wallet1')),current_setting('test.balance267'),'adverse evidence never rewrites the credit balance');
select set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$insert into public.credit_lot_movements(organization_id,credit_lot_id,redemption_id,movement_type,quantity,idempotency_scope,idempotency_key,correlation_id,created_by)values('b2670000-0000-4000-8000-000000000001',current_setting('test.lot267')::uuid,(select(v->>'redemption_id')::uuid from p267 where k='reserved1'),'CONSUME',10,'credits.test','adverse267-denied-consume',extensions.gen_random_uuid(),'a2670000-0000-4000-8000-000000000001')$$,'55000','CREDIT_LOT_FUNDING_NOT_ADMISSIBLE','the low-level movement guard refuses consumption financed by known adverse evidence');
select lives_ok($$select public.release_benefit_credits((select(v->>'redemption_id')::uuid from p267 where k='reserved1'),'TEST_RELEASE_ADVERSE','adverse267-release1')$$,'a real old reservation can still be released while the source is held');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-WON-267','DISPUTE_WON','SYNTHETIC-SANDBOX-CAPTURE-267-1',jsonb_build_object('provider_payment_id','SYNTHETIC-SANDBOX-CAPTURE-267-1','provider_adjustment_id','SYNTHETIC-DISPUTE-267','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',clock_timestamp()+interval'1 second'),repeat('5',64),repeat('6',64),extensions.gen_random_uuid());
select is(private.credit_lot_funding_status_v1(current_setting('test.lot267')::uuid),'ELIGIBLE','a later WON resolves the same dispute without erasing history');
select set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select public.reserve_benefit_credits('b2670000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p267 where k='wallet1'),current_setting('test.benefit267')::uuid,1,clock_timestamp()+interval'1 day','adverse267-reserve-after-won')$$,'the native reservation command becomes usable after genuine dispute resolution');
-- A distinct native payment has no grant yet. A partial refund arrives through
-- the native domain callback without an inbox entry or full-refund hold.
insert into public.subscriptions(id,organization_id,status)values('e2670000-0000-4000-8000-000000000002','b2670000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p267 values('prep2',public.prepare_subscription_payment_intent_v2('b2670000-0000-4000-8000-000000000002','d2670000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','adverse267-prepare2'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p267 values('intent2',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p267 where k='prep2'),'SANDBOX','SYNTHETIC-SANDBOX-ORDER-267-2',12345,'EUR'));
insert into p267 values('paid2',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-SANDBOX-EVENT-267-2','SYNTHETIC-SANDBOX-ORDER-267-2','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-SANDBOX-CAPTURE-267-2',repeat('7',64),repeat('8',64)));
select set_config('test.payment2_267',(select id::text from public.subscription_payment_events where provider_event_id='SYNTHETIC-SANDBOX-EVENT-267-2'),true);
select public.process_verified_subscription_adjustment_v2('SANDBOX','SYNTHETIC-PARTIAL-REFUND-267','SYNTHETIC-SANDBOX-CAPTURE-267-2','SYNTHETIC-REFUND-267','REFUND_SUCCEEDED',1,'EUR',clock_timestamp(),repeat('9',64),repeat('a',64));
select is((select count(*)from public.subscription_payment_adjustments where payment_event_id=current_setting('test.payment2_267')::bigint and event_type='REFUND_SUCCEEDED'),1::bigint,'native partial refund is durable without fabricating an inbox event');
select is((select count(*)from public.subscription_financial_holds where payment_event_id=current_setting('test.payment2_267')::bigint and active),0::bigint,'partial refund does not need to reach the old full-refund threshold');
select set_config('request.jwt.claim.sub','a2670000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2670000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p267 values('terms2',public.get_subscription_credit_grant_context_v1('b2670000-0000-4000-8000-000000000002',current_setting('test.payment2_267')::bigint,1));
select is((select v->>'can_issue'from p267 where k='terms2'),'false','a partial native refund prevents a new subscription credit grant');
select ok((select(v->'blocked_reasons')?'SUBSCRIPTION_FINANCIAL_HOLD'from p267 where k='terms2'),'the grant projection exposes the precise financial review prerequisite');
select throws_ok($$select public.issue_subscription_credit_grant_v1('b2670000-0000-4000-8000-000000000002',current_setting('test.payment2_267')::bigint,1,(select v#>>'{terms,terms_hash}'from p267 where k='terms2'),'adverse267-partial-refund-denied')$$,'55000','SUBSCRIPTION_FINANCIAL_HOLD','the actual issuer refuses the new grant under a partial native refund');
select is((select count(*)from public.credit_ledger_entries where organization_id='b2670000-0000-4000-8000-000000000002'and entry_type='GRANT'),0::bigint,'refused partial-refund issuance leaves no credit ledger entry');
select *from finish();rollback;
