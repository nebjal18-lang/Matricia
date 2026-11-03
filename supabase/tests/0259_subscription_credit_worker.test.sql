begin;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0259',configured_at=clock_timestamp()where singleton;
set local search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2590000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-259@example.invalid','',now(),'{}','{}',now(),now()),
('a2590000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-259@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2590000-0000-4000-8000-000000000001','Payment 259 SARL','Payment 259','ACTIVE','a2590000-0000-4000-8000-000000000001'),
('b2590000-0000-4000-8000-000000000002','Other 259 SARL','Other 259','ACTIVE','a2590000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2590000-0000-4000-8000-000000000001','b2590000-0000-4000-8000-000000000001','a2590000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2590000-0000-4000-8000-000000000002','b2590000-0000-4000-8000-000000000002','a2590000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c2590000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2590000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d2590000-0000-4000-8000-000000000001','PLATINUM','ACTIVE','a2590000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2590000-0000-4000-8000-000000000002','d2590000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a2590000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2590000-0000-4000-8000-000000000001','b2590000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2590000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a2590000-0000-4000-8000-000000000002','FINANCE_MANAGER');

create temporary table p259(k text primary key,v jsonb);

insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2590000-0000-4000-8000-000000000001','d2590000-0000-4000-8000-000000000002','FUNDING_PROBE',true);
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting259(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2590000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING259_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING259_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0259','funding259-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0259');
end$$;
select pg_temp.approve_posting259('DEVELOPMENT');
select set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);


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

select pg_temp.approve_checkout_box_fixture('b2590000-0000-4000-8000-000000000001','d2590000-0000-4000-8000-000000000002','a2590000-0000-4000-8000-000000000001','a2590000-0000-4000-8000-000000000002','AUTOMATIC_SC_259','EUR',10,3);
-- Synthetic service proofs exercise the SQL contract, never a real PSP signature.
insert into p259 values('prep',public.prepare_subscription_payment_intent_v2('b2590000-0000-4000-8000-000000000001','d2590000-0000-4000-8000-000000000002','ANNUAL','PAYPAL','SANDBOX','auto-credit259-preparation'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p259 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p259 where k='prep'),'SANDBOX','SYNTHETIC-SC-ORDER-259',123450,'EUR'));
insert into p259 values('paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-SC-EVENT-259','SYNTHETIC-SC-ORDER-259','PAYMENT_SUCCEEDED',123450,'EUR',statement_timestamp(),'SYNTHETIC-SC-CAPTURE-259',repeat('b',64),repeat('c',64),'e2590000-0000-4000-8000-000000000005'));
select is((select v->>'outcome'from p259 where k='paid'),'SUBSCRIPTION_ACTIVATED','actual paid plan creates the native cycle and balanced journal');
insert into p259 values('tracked',public.track_subscription_paid_credit_jobs_v1((select id from public.event_outbox where event_type='SubscriptionPaidV1'and organization_id='b2590000-0000-4000-8000-000000000001'), 'e2590000-0000-4000-8000-000000000001'));
select is((select v->>'outcome'from p259 where k='tracked'),'SUBSCRIPTION_CREDIT_JOBS_TRACKED','payment event tracks jobs without claiming credits issued');
select is((select count(*)from private.subscription_credit_jobs_v1 where organization_id='b2590000-0000-4000-8000-000000000001'),12::bigint,'annual funded plan has twelve monthly installments');
select is((select count(*)from public.credit_lots where organization_id='b2590000-0000-4000-8000-000000000001'),0::bigint,'tracking does not issue credits before leased execution');
select public.track_subscription_paid_credit_jobs_v1((select id from public.event_outbox where event_type='SubscriptionPaidV1'and organization_id='b2590000-0000-4000-8000-000000000001'), 'e2590000-0000-4000-8000-000000000001');
select is((select count(*)from private.subscription_credit_jobs_v1 where organization_id='b2590000-0000-4000-8000-000000000001'),12::bigint,'event retry cannot create extra installments');
insert into p259 values('lease',(select v from public.claim_subscription_credit_jobs_v1('f2590000-0000-4000-8000-000000000001',1,120)v));
select ok((select v->>'job_id'is not null from p259 where k='lease'),'due installment is leased to a native worker');
select is((select count(*)from public.claim_subscription_credit_jobs_v1('f2590000-0000-4000-8000-000000000002',1,120)),0::bigint,'future monthly installments and already leased slot cannot be claimed');
select throws_ok($$select public.execute_subscription_credit_job_v1((select(v->>'job_id')::uuid from p259 where k='lease'),'f2590000-0000-4000-8000-000000000002',(select(v->>'lease_token')::uuid from p259 where k='lease'),(select(v->>'row_version')::bigint from p259 where k='lease'))$$,'55000','SC_LEASE_INVALID','foreign worker cannot use an exact lease token');
insert into p259 values('issued',public.execute_subscription_credit_job_v1((select(v->>'job_id')::uuid from p259 where k='lease'),'f2590000-0000-4000-8000-000000000001',(select(v->>'lease_token')::uuid from p259 where k='lease'),(select(v->>'row_version')::bigint from p259 where k='lease')));
select is((select v->>'outcome'from p259 where k='issued'),'SUBSCRIPTION_CREDIT_ISSUED','native service issues the exact due funded installment');
select is((select quantity from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p259 where k='issued')),10::bigint,'monthly quantity comes from the immutable paid plan');
select ok((select created_by is null and execution_actor_type='SERVICE'and service_job_id=(select(v->>'job_id')::uuid from p259 where k='lease')from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p259 where k='issued')),'service actor is explicit and never impersonates a Finance user');
select is((select revenue_value_minor from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p259 where k='issued')),0::bigint,'automatic subscription credits do not recognize cash revenue twice');
select is((select count(*)from public.credit_lot_payment_sources_v1 where credit_lot_id=(select(v->>'credit_lot_id')::uuid from p259 where k='issued')),1::bigint,'mature binder records exact payment, cycle and month provenance');
select is(public.execute_subscription_credit_job_v1((select(v->>'job_id')::uuid from p259 where k='lease'),'f2590000-0000-4000-8000-000000000001',(select(v->>'lease_token')::uuid from p259 where k='lease'),(select(v->>'row_version')::bigint from p259 where k='lease'))->>'replayed','true','response loss replays the actual execution receipt');
select is((select count(*)from public.credit_lots where organization_id='b2590000-0000-4000-8000-000000000001'),1::bigint,'replay never duplicates the lot');
select ok(not exists(select 1 from private.subscription_credit_job_context_v1 where backend_pid=pg_backend_pid()),'service context is removed after the real issuance');
select is((select count(*)from public.financial_journals where organization_id='b2590000-0000-4000-8000-000000000001'and journal_type='SUBSCRIPTION_PAYMENT'),1::bigint,'fulfillment creates no second cash journal');
select ok(not has_function_privilege('authenticated','public.execute_subscription_credit_job_v1(uuid,uuid,uuid,bigint,uuid)','EXECUTE')and not has_table_privilege('service_role','private.subscription_credit_job_context_v1','INSERT'),'neither Client nor service API can forge privileged issue context');
select set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.discover_subscription_credit_jobs_v1(1)$$,'42501','SC_SERVICE_REQUIRED','even a Finance actor cannot impersonate the automatic worker');
select throws_ok($$select public.track_subscription_paid_credit_jobs_v1(1,'e2590000-0000-4000-8000-000000000001')$$,'42501','SC_SERVICE_REQUIRED','Client event dispatch is not a mint authority');
-- A second real payment exercises failure handling. No source/payout status is seeded.
insert into public.subscriptions(id,organization_id,status)values('e2590000-0000-4000-8000-000000000002','b2590000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p259 values('prep2',public.prepare_subscription_payment_intent_v2('b2590000-0000-4000-8000-000000000002','d2590000-0000-4000-8000-000000000002','MONTHLY','PAYPAL','SANDBOX','auto-credit259-preparation2'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p259 values('intent2',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p259 where k='prep2'),'SANDBOX','SYNTHETIC-SC-ORDER-259-2',12345,'EUR'));
insert into p259 values('paid2',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-SC-EVENT-259-2','SYNTHETIC-SC-ORDER-259-2','PAYMENT_SUCCEEDED',12345,'EUR',statement_timestamp(),'SYNTHETIC-SC-CAPTURE-259-2',repeat('d',64),repeat('e',64),'e2590000-0000-4000-8000-000000000006'));
select public.track_subscription_paid_credit_jobs_v1((select id from public.event_outbox where event_type='SubscriptionPaidV1'and organization_id='b2590000-0000-4000-8000-000000000002'),'e2590000-0000-4000-8000-000000000002');
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-SC-DISPUTE-259','DISPUTE_OPENED','SYNTHETIC-SC-CAPTURE-259-2',jsonb_build_object('provider_payment_id','SYNTHETIC-SC-CAPTURE-259-2','provider_adjustment_id','SYNTHETIC-SC-CASE-259','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',statement_timestamp()),repeat('f',64),repeat('a',64),extensions.gen_random_uuid());
insert into p259 values('lease2',(select v from public.claim_subscription_credit_jobs_v1('f2590000-0000-4000-8000-000000000001',1,120)v));
insert into p259 values('blocked',public.execute_subscription_credit_job_v1((select(v->>'job_id')::uuid from p259 where k='lease2'),'f2590000-0000-4000-8000-000000000001',(select(v->>'lease_token')::uuid from p259 where k='lease2'),(select(v->>'row_version')::bigint from p259 where k='lease2')));
select is((select v->>'outcome'from p259 where k='blocked'),'SUBSCRIPTION_CREDIT_RETRY_SCHEDULED','durable adverse fact blocks minting even before domain routing materializes holds');
select is((select v->>'reason_code'from p259 where k='blocked'),'SUBSCRIPTION_FINANCIAL_HOLD','failure is actionable without logging provider payload');
select is((select count(*)from public.credit_lots where organization_id='b2590000-0000-4000-8000-000000000002'),0::bigint,'a failed job creates no partial grant');
select is((select count(*)from private.subscription_credit_job_context_v1),0::bigint,'failure leaves no privilege context behind');
select throws_ok($$select public.execute_subscription_credit_job_v1((select(v->>'job_id')::uuid from p259 where k='lease2'),'f2590000-0000-4000-8000-000000000001',(select(v->>'lease_token')::uuid from p259 where k='lease2'),(select(v->>'row_version')::bigint from p259 where k='lease2'))$$,'55000','SC_LEASE_INVALID','failed lease cannot be reused after its fenced transition');
-- Only advance the synthetic scheduler clock between actual failed executions.
-- Payment, source, attempt budget, leases and results remain the real implementation.
do $$declare claim jsonb;i integer;begin for i in 1..4 loop
 update private.subscription_credit_jobs_v1 set next_attempt_at=clock_timestamp()-interval'1 second'where organization_id='b2590000-0000-4000-8000-000000000002';
 select v into claim from public.claim_subscription_credit_jobs_v1('f2590000-0000-4000-8000-000000000001',1,120)v;
 perform public.execute_subscription_credit_job_v1((claim->>'job_id')::uuid,'f2590000-0000-4000-8000-000000000001',(claim->>'lease_token')::uuid,(claim->>'row_version')::bigint);
 end loop;end$$;
select is((select state from private.subscription_credit_jobs_v1 where organization_id='b2590000-0000-4000-8000-000000000002'),'DEAD_LETTER','five actual failed executions exhaust the bounded retry budget');
select is((select attempt_count from private.subscription_credit_jobs_v1 where organization_id='b2590000-0000-4000-8000-000000000002'),5,'retry budget is recorded durably');
select is(public.operational_metrics_v1()#>>'{subscription_credit_grants,0,status}','DEAD_LETTER','operator metrics report an active failed grant queue');
select set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p259 values('retry',public.request_subscription_credit_retry_v1((select(v->>'job_id')::uuid from p259 where k='lease2'),(select source_hash from private.subscription_credit_schedules_v1 where organization_id='b2590000-0000-4000-8000-000000000002'),'Reprise synthétique après investigation indépendante','auto-credit259-retry'));
select throws_ok($$select public.review_subscription_credit_retry_v1((select(v->>'request_id')::uuid from p259 where k='retry'),(select v->>'source_hash'from p259 where k='retry'),true)$$,'42501','SC_RETRY_INDEPENDENT_REVIEW_REQUIRED','requester cannot authorize their own financial retry');
select set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(public.review_subscription_credit_retry_v1((select(v->>'request_id')::uuid from p259 where k='retry'),(select v->>'source_hash'from p259 where k='retry'),true)->>'status','AUTHORIZED','independent Finance can authorize only the observed failed job source');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p259 values('lease3',(select v from public.claim_subscription_credit_jobs_v1('f2590000-0000-4000-8000-000000000001',1,120)v));
select is(public.execute_subscription_credit_job_v1((select(v->>'job_id')::uuid from p259 where k='lease3'),'f2590000-0000-4000-8000-000000000001',(select(v->>'lease_token')::uuid from p259 where k='lease3'),(select(v->>'row_version')::bigint from p259 where k='lease3'))->>'reason_code','SUBSCRIPTION_FINANCIAL_HOLD','approved retry never overrides the actual payment hold');
select ok(not exists(select 1 from public.credit_lots where organization_id='b2590000-0000-4000-8000-000000000002'),'governed retry cannot manufacture credits while its source is blocked');
-- A Finance installment issued during recovery is reconciled as an existing fact.
-- A subsequent independent dispute must prevent new minting, not erase that fact.
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-SC-WON-259','DISPUTE_WON','SYNTHETIC-SC-CAPTURE-259-2',jsonb_build_object('provider_payment_id','SYNTHETIC-SC-CAPTURE-259-2','provider_adjustment_id','SYNTHETIC-SC-CASE-259','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',statement_timestamp()+interval'1 second'),repeat('1',64),repeat('2',64),extensions.gen_random_uuid());
select set_config('request.jwt.claim.sub','a2590000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2590000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.ensure_client_credit_wallet('b2590000-0000-4000-8000-000000000002','auto-credit259-wallet2');
insert into p259 values('manual',public.issue_subscription_credit_grant_v1('b2590000-0000-4000-8000-000000000002',(select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-SC-EVENT-259-2'),1,private.subscription_credit_grant_terms_v1('b2590000-0000-4000-8000-000000000002',(select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-SC-EVENT-259-2'),1)->>'terms_hash','auto-credit259-finance-recovery'));
select is((select v->>'outcome'from p259 where k='manual'),'CREDITS_ISSUED','authorized Finance may issue the same canonical due installment through the existing engine');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.record_verified_payment_inbox_v1('PAYPAL','SANDBOX','SYNTHETIC-SC-DISPUTE-SECOND-259','DISPUTE_OPENED','SYNTHETIC-SC-CAPTURE-259-2',jsonb_build_object('provider_payment_id','SYNTHETIC-SC-CAPTURE-259-2','provider_adjustment_id','SYNTHETIC-SC-CASE-SECOND-259','merchant_reference',null,'amount_minor','12345','currency','EUR','occurred_at',statement_timestamp()+interval'2 seconds'),repeat('3',64),repeat('4',64),extensions.gen_random_uuid());
update private.subscription_credit_jobs_v1 set next_attempt_at=clock_timestamp()-interval'1 second'where organization_id='b2590000-0000-4000-8000-000000000002';
insert into p259 values('lease4',(select v from public.claim_subscription_credit_jobs_v1('f2590000-0000-4000-8000-000000000001',1,120)v));
select is(public.execute_subscription_credit_job_v1((select(v->>'job_id')::uuid from p259 where k='lease4'),'f2590000-0000-4000-8000-000000000001',(select(v->>'lease_token')::uuid from p259 where k='lease4'),(select(v->>'row_version')::bigint from p259 where k='lease4'))->>'outcome','SUBSCRIPTION_CREDIT_ALREADY_ISSUED','worker records an actual existing slot even when later facts block further value');
select is((select count(*)from public.credit_lots where organization_id='b2590000-0000-4000-8000-000000000002'),1::bigint,'recovery with Finance cannot double-issue a monthly slot');
select ok((select created_by is not null and execution_actor_type='USER'from public.credit_lots where id=(select(v->>'credit_lot_id')::uuid from p259 where k='manual')),'the original human principal of the existing Finance grant is preserved');
select *from finish();
rollback;
