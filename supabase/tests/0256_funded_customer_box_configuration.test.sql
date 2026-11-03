begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='transactional-payment-fixture-0256',configured_at=clock_timestamp()where singleton;
set local search_path=public,extensions;

insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('a2560000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','owner-256@example.invalid','',now(),'{}','{}',now(),now()),
('a2560000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','intruder-256@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('b2560000-0000-4000-8000-000000000001','Payment 256 SARL','Payment 256','ACTIVE','a2560000-0000-4000-8000-000000000001'),
('b2560000-0000-4000-8000-000000000002','Other 256 SARL','Other 256','ACTIVE','a2560000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)values
('c2560000-0000-4000-8000-000000000001','b2560000-0000-4000-8000-000000000001','a2560000-0000-4000-8000-000000000001','ACTIVE',now()),
('c2560000-0000-4000-8000-000000000002','b2560000-0000-4000-8000-000000000002','a2560000-0000-4000-8000-000000000002','ACTIVE',now());
insert into public.organization_member_roles(membership_id,role_code)values
('c2560000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2560000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.subscription_plans(id,code,status,created_by)values('d2560000-0000-4000-8000-000000000001','GOLD','ACTIVE','a2560000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)
values('d2560000-0000-4000-8000-000000000002','d2560000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',12345,123450,10,5000,5000,'{}',current_date-1,repeat('a',64),'a2560000-0000-4000-8000-000000000001');
insert into public.subscriptions(id,organization_id,status)values('e2560000-0000-4000-8000-000000000001','b2560000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2560000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a2560000-0000-4000-8000-000000000002','FINANCE_MANAGER');

create temporary table p256(k text primary key,v jsonb);grant select on p256 to authenticated;

insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002','FUNDING_PROBE',true);
-- Governance prerequisites are real public commands: two independent financial reviewers,
-- an explicit synthetic POSTING policy, and a frozen cash/suspense context before PSP creation.
create function pg_temp.approve_posting256(target_environment text)returns void language plpgsql as $$declare proposal jsonb;begin
 perform set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);perform set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
 proposal:=public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d2560000-0000-4000-8000-000000000002',null,'EUR',target_environment,1,current_date-1,null,jsonb_build_object('cash_account_code','FUNDING256_CASH_EUR','cash_name_fr','Trésorerie synthétique de recette','cash_name_ar','خزينة الاختبار','suspense_account_code','FUNDING256_PENDING_EUR','suspense_name_fr','Encaissement synthétique en attente','suspense_name_ar','تحصيل قيد المراجعة'),'Configuration uniquement pour la recette SQL 0256','funding256-posting-'||lower(target_environment));
 perform set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);perform set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
 perform public.decide_credit_revenue_policy_v1((proposal->>'request_id')::uuid,true,proposal->>'request_hash','Approbation indépendante uniquement pour recette SQL 0256');
end$$;
select pg_temp.approve_posting256('DEVELOPMENT');
-- Both content and approval are created through the real public commands.
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('benefit3',public.create_benefit_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256_A','CREDIT_SERVICE','MATRICIA_INTERNAL','Premier avantage256','الميزة الأولى256','Configuration synthétique256','إعداد اختباري256',3,0,0,'EUR',null,null,null,'{}','{}','CANCEL_TEST_256',clock_timestamp()-interval'1 minute','box256-benefit3'));
insert into p256 values('benefit7',public.create_benefit_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256_B','CREDIT_SERVICE','MATRICIA_INTERNAL','Second avantage256','الميزة الثانية256','Configuration synthétique256','إعداد اختباري256',7,0,0,'EUR',null,null,null,'{}','{}','CANCEL_TEST_256',clock_timestamp()-interval'1 minute','box256-benefit7'));
select public.activate_benefit_version('b2560000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),'box256-activate3');
select public.activate_benefit_version('b2560000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p256 where k='benefit7'),'box256-activate7');
insert into p256 values('box',public.create_box_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256','SEMI_CUSTOM','Ma Box de recette256','صندوق الاختبار256',10,3,'{}',0,0,0,'EUR',clock_timestamp()-interval'1 minute',jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array((select v->>'benefit_version_id'from p256 where k='benefit3'))),jsonb_build_object('slot_code','EXTRA','slot_kind','OPTIONAL','minimum_selections',0,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array((select v->>'benefit_version_id'from p256 where k='benefit7')))),'box256-create'));
select public.activate_box_version('b2560000-0000-4000-8000-000000000001',(select(v->>'box_version_id')::uuid from p256 where k='box'),null,'box256-activate');
insert into p256 values('rule',public.link_plan_box_rule('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002',(select(v->>'box_version_id')::uuid from p256 where k='box'),'{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"EXACT"}',clock_timestamp()-interval'1 minute','box256-link'));
select set_config('test.rule256',(select v->>'plan_box_rule_id'from p256 where k='rule'),true);
insert into p256 values('approval-context',public.get_box_configuration_approval_context_v1(current_setting('test.rule256')::uuid));
select throws_ok($$select public.approve_box_configuration_v1(current_setting('test.rule256')::uuid,(select v->>'source_hash'from p256 where k='approval-context'),'Approbaton de son propre contenu interdite','box256-self-approve')$$,'42501','BOX_CONFIGURATION_SELF_APPROVAL_DENIED','the Box and rule author cannot self-approve');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.approve_box_configuration_v1(current_setting('test.rule256')::uuid,repeat('f',64),'Refus du contexte qui a changé','box256-stale-approval')$$,'40001','STALE_BOX_CONFIGURATION_SOURCE','the reviewer must approve the source hash actually read');
insert into p256 values('approved',public.approve_box_configuration_v1(current_setting('test.rule256')::uuid,(select v->>'source_hash'from p256 where k='approval-context'),'Approbation indépendante synthétique de recette256','box256-independent-approval'));
select is((select v->>'outcome'from p256 where k='approved'),'BOX_CONFIGURATION_APPROVED','independent Finance approves the real rule, Box and allowed benefits');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('benefit-admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3')));
insert into p256 values('benefit-admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),(select v->>'source_hash'from p256 where k='benefit-admission-context'),(select(v->>'head_id')::uuid from p256 where k='benefit-admission-context'),'NONE',null,null,'{}',array[(select(v->>'box_version_id')::uuid from p256 where k='box')],clock_timestamp()-interval'1 minute',null,'Condition explicite de Box pour recette native256','TEST_ONLY_BOX_256','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid()));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p256 where k='benefit-admission-policy'),(select v->>'content_hash'from p256 where k='benefit-admission-policy'),true,'TEST_ONLY_256','Approbation indépendante condition Box256');

select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.get_customer_box_configuration_v1('b2560000-0000-4000-8000-000000000001')->>'status','PAID_BOX_FUNDING_REQUIRED','an approved catalogue and expired trial do not create a paid Box right');
insert into p256 values('prep',public.prepare_subscription_payment_intent_v2('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','box256-demo-prepare'));
select is((select source_snapshot#>>'{options,0,source_snapshot,box_version_id}'from private.subscription_prepared_box_terms_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p256 where k='prep')),(select v->>'box_version_id'from p256 where k='box'),'the original Box promise is durably frozen before any PSP registration');
-- A real subsequent catalogue activation retires v1 during checkout. The paid
-- promise keeps its pre-PSP v1 source; there is no manual status update.
insert into p256 values('box-v2',public.create_box_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256','CUSTOM','Nouvelle Box256','صندوق جديد256',20,9,'{}',0,0,0,'EUR',clock_timestamp()-interval'1 minute',(select jsonb_agg(jsonb_build_object('slot_code',slot_code,'slot_kind',slot_kind,'minimum_selections',minimum_selections,'maximum_selections',maximum_selections,'allowed_benefit_version_ids',to_jsonb(allowed_benefit_version_ids))order by slot_code)from public.box_slots where box_version_id=(select(v->>'box_version_id')::uuid from p256 where k='box')),'box256-create-v2'));
select public.activate_box_version('b2560000-0000-4000-8000-000000000001',(select(v->>'box_version_id')::uuid from p256 where k='box-v2'),null,'box256-activate-v2');
select is((select status from public.box_versions where id=(select(v->>'box_version_id')::uuid from p256 where k='box')),'RETIRED','native version activation retires the original catalogue Box');
select is(public.get_box_configuration_approval_context_v1(current_setting('test.rule256')::uuid)->>'approval_current','false','Admin does not label the changed lifecycle source hash as newly approved');

-- Even an independently approved replacement before capture must not replace
-- the Box or rollover that was promised by the earlier checkout.
insert into p256 values('rule-v2',public.link_plan_box_rule('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002',(select(v->>'box_version_id')::uuid from p256 where k='box-v2'),'{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"EXACT"}',clock_timestamp()-interval'1 minute','box256-link-v2'));
insert into p256 values('approval-context-v2',public.get_box_configuration_approval_context_v1((select(v->>'plan_box_rule_id')::uuid from p256 where k='rule-v2')));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.approve_box_configuration_v1((select(v->>'plan_box_rule_id')::uuid from p256 where k='rule-v2'),(select v->>'source_hash'from p256 where k='approval-context-v2'),'Approbation indépendante nouvelle offre pendant checkout256','box256-approve-v2');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.prepare_subscription_payment_intent_v2('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','box256-demo-prepare')->>'create_authorized','false','a checkout replay never authorizes a second PSP creation after offer replacement');
select is((select source_snapshot->>'rollover_months'from private.subscription_prepared_box_terms_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p256 where k='prep')),'3','replacement with nine-month rollover cannot alter the three-month pre-PSP promise');

select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p256 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p256 where k='prep'),'DEMO','SYNTHETIC-DEMO-ORDER-256',12345,'EUR'));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.get_client_subscription_payment_status_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'payment_intent_id')::uuid from p256 where k='intent'))->>'status','REQUIRES_CONFIRMATION','a registered order is not a confirmed payment');
select is(private.subscription_prepared_box_terms_for_preparation_v1((select(v->>'preparation_id')::uuid from p256 where k='prep'))->>'plan_status_at_checkout','ACTIVE','the pre-payment getter proves the actual plan was active when checkout was authorized');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);

insert into p256 values('paid',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-DEMO-EVENT-256','SYNTHETIC-DEMO-ORDER-256','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-DEMO-CAPTURE-256',repeat('d',64),repeat('e',64)));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('context',public.get_customer_box_configuration_v1('b2560000-0000-4000-8000-000000000001'));
select is((select v->>'status'from p256 where k='context'),'CONFIGURABLE','a real compatible payment makes the pre-approved Box configurable');
select is(public.get_client_subscription_payment_status_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'payment_intent_id')::uuid from p256 where k='intent'))->>'status','CONFIRMED','the status reader confirms only an actual native payment with cycle and journal');
select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.get_client_subscription_payment_status_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'payment_intent_id')::uuid from p256 where k='intent'))$$,'42501','SUBSCRIPTION_PAYMENT_STATUS_DENIED','AAL1 cannot read the private payment receipt');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.get_client_subscription_payment_status_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'payment_intent_id')::uuid from p256 where k='intent'))$$,'42501','SUBSCRIPTION_PAYMENT_STATUS_DENIED','another organization does not inherit Client payment access from a Finance role');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(private.box_checkout_promise_matches_v1((select v->'context'from p256 where k='context')-'preparation_id'-'checkout_terms_hash',(select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-256'),(select(v->>'approval_id')::uuid from p256 where k='approved')),false,'missing pre-PSP context fields fail as a boolean false, never a nullable admission');

select is((select v#>>'{configuration,credit_budget}'from p256 where k='context'),'10','the exact approved credit budget is exposed as text');
select is((select v#>>'{configuration,box_version_id}'from p256 where k='context'),(select v->>'box_version_id'from p256 where k='box'),'the acquired right remains bound to v1 instead of the new current Box');
select is((public.get_subscription_credit_grant_context_v1('b2560000-0000-4000-8000-000000000001',(select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-DEMO-EVENT-256'),1)#>>'{terms,rollover_policy,rollover_months}'),'3','subscription grant terms use the same pre-PSP frozen rollover rather than the new rule');
select set_config('test.context256',(select v->>'context_hash'from p256 where k='context'),true);
select is(public.get_benefit_admission_availability_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'))->>'blocked_reason','BENEFIT_ELIGIBILITY_NOT_MET','payment alone does not satisfy an actual governed required-Box condition');
insert into p256 values('selection',jsonb_build_array(jsonb_build_object('slot_code','CORE','benefit_version_id',(select v->>'benefit_version_id'from p256 where k='benefit3'),'units','1'),jsonb_build_object('slot_code','EXTRA','benefit_version_id',(select v->>'benefit_version_id'from p256 where k='benefit7'),'units','1')));
select throws_ok($$select public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,repeat('f',64),(select v from p256 where k='selection'),'box256-stale-context')$$,'40001','STALE_CUSTOMER_BOX_CONTEXT','browser cannot confirm a different financing or policy context');
select throws_ok($$select public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),'[]','box256-empty')$$,'23514','CUSTOMER_BOX_SLOT_LIMIT','mandatory slots cannot be omitted');
select throws_ok($$select public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),jsonb_set((select v from p256 where k='selection'),'{0,units}','"2"'),'box256-budget-overflow')$$,'23514','CUSTOMER_BOX_BUDGET_EXCEEDED','exact arithmetic refuses spending beyond the approved Box budget');
select throws_ok($$select public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),jsonb_set((select v from p256 where k='selection'),'{0,benefit_version_id}',to_jsonb((select v->>'benefit_version_id'from p256 where k='benefit7'))),'box256-wrong-benefit')$$,'22023','INVALID_CUSTOMER_BOX_SELECTION','a benefit from another slot cannot be substituted');
select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),(select v from p256 where k='selection'),'box256-no-mfa')$$,'42501','CUSTOMER_BOX_CONFIGURE_DENIED','configuration requires a real AAL2 authorization context');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),(select v from p256 where k='selection'),'box256-other-client')$$,'42501','CUSTOMER_BOX_CONFIGURE_DENIED','Finance does not imply Client organization write access');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('test.ledger256',(select count(*)::text from public.credit_ledger_entries where organization_id='b2560000-0000-4000-8000-000000000001'),true);
insert into p256 values('configured',public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),(select v from p256 where k='selection'),'box256-configure'));
select is((select v->>'outcome'from p256 where k='configured'),'CUSTOMER_BOX_CONFIGURED','the real command creates the customer Box');
select is((select v->>'allocated_credits'from p256 where k='configured'),'10','selected costs exactly use the approved credit budget');
select is(public.get_benefit_admission_availability_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'))->>'admissible','true','the real funded assignment satisfies the approved Box condition even after catalogue retirement');
select is((select count(*)::text from public.credit_ledger_entries where organization_id='b2560000-0000-4000-8000-000000000001'),current_setting('test.ledger256'),'configuration neither mints nor consumes wallet credits');
select is((select count(*)from public.customer_box_funding_sources_v1 where organization_id='b2560000-0000-4000-8000-000000000001'),1::bigint,'one immutable source binds the paid cycle and approved configuration');
select is(public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),(select v from p256 where k='selection'),'box256-configure'),(select v from p256 where k='configured'),'same command replays its exact result');
select throws_ok($$select public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,current_setting('test.context256'),(select v from p256 where k='selection'),'box256-another-key')$$,'55000','CUSTOMER_BOX_CONFIGURATION_NOT_ADMISSIBLE','a different command cannot assign another Box for the same cycle');
select is((select count(*)from public.event_outbox where organization_id='b2560000-0000-4000-8000-000000000001'and event_type='CustomerBoxConfiguredV1'),1::bigint,'one source fact is emitted despite replay');
select throws_ok($$update public.customer_box_funding_sources_v1 set context_hash=repeat('a',64)$$,'55000',null,'funding context cannot be rewritten after configuration');
set local role authenticated;
select ok(exists(select 1 from jsonb_array_elements(public.list_client_credit_catalog_v1('b2560000-0000-4000-8000-000000000001')->'boxes')x where x->>'id'=(select v->>'box_version_id'from p256 where k='box')),'the native assignment makes its exact retired Box readable in the sanitized Client catalogue');
reset role;

select ok(not has_function_privilege('authenticated','private.subscription_prepared_box_terms_for_preparation_v1(uuid)','EXECUTE')and not has_function_privilege('service_role','private.subscription_prepared_box_terms_for_payment_v1(bigint)','EXECUTE'),'private original-offer readers do not become a browser or generic-service bypass');
-- Negative historical lifecycle input only: an imported RETIRED rule still
-- carries a historical approval. It must not be sold in a NEW checkout. This
-- does not simulate a native retirement or approve any new customer right.
insert into public.plan_box_rules(id,plan_version_id,box_version_id,status,effective_from,effective_to,rule_snapshot)
select 'f2569999-0000-4000-8000-000000000001',plan_version_id,box_version_id,'RETIRED',effective_from-interval'1 microsecond',effective_to,rule_snapshot from public.plan_box_rules where id=(select(v->>'plan_box_rule_id')::uuid from p256 where k='rule-v2');
insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
values('b2560000-0000-4000-8000-000000000001','a2560000-0000-4000-8000-000000000001','USER','admin.plan_box.linked','plan_box_rule','f2569999-0000-4000-8000-000000000001',extensions.gen_random_uuid(),'{"fixture":"historical-retired-rule-negative-only"}',repeat('0',64));
insert into public.box_configuration_approvals_v1(plan_box_rule_id,source_snapshot,source_hash,approved_by,approved_at,reason)
select 'f2569999-0000-4000-8000-000000000001',snapshot,private.canonical_request_hash(snapshot),'a2560000-0000-4000-8000-000000000002',approved_at,'Précondition historique synthétique négative, jamais nouvelle approbation'
from(select private.box_configuration_source_v1('f2569999-0000-4000-8000-000000000001')snapshot,approved_at from public.box_configuration_approvals_v1 where plan_box_rule_id=(select(v->>'plan_box_rule_id')::uuid from p256 where k='rule-v2'))old;
insert into public.subscriptions(id,organization_id,status)values('e2560000-0000-4000-8000-000000000002','b2560000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('new-checkout',public.prepare_subscription_payment_intent_v2('b2560000-0000-4000-8000-000000000002','d2560000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','box256-new-checkout'));
select is((select count(*)from private.subscription_prepared_box_terms_v1 terms,jsonb_array_elements(terms.source_snapshot->'options')option where terms.preparation_id=(select(v->>'preparation_id')::uuid from p256 where k='new-checkout')and option#>>'{source_snapshot,rule_id}'='f2569999-0000-4000-8000-000000000001'),0::bigint,'a retired historical rule is excluded before a NEW PSP creation even with an old matching approval');
select *from finish();
rollback;
