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
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)select('a2560000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','member330-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(3,4)i;
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)select('c2560000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'b2560000-0000-4000-8000-000000000001',('a2560000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'ACTIVE',now()from generate_series(3,4)i;
insert into public.organization_member_roles(membership_id,role_code)select('c2560000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'CLIENT_BUYER'from generate_series(3,4)i;
insert into public.subscriptions(id,organization_id,status)values('e2560000-0000-4000-8000-000000000001','b2560000-0000-4000-8000-000000000001','TRIAL_EXPIRED');


insert into public.platform_user_roles(user_id,role_code)values('a2560000-0000-4000-8000-000000000001','FINANCE_MANAGER'),('a2560000-0000-4000-8000-000000000002','FINANCE_MANAGER');

create temporary table p256(k text primary key,v jsonb);grant select,insert on p256 to authenticated;

insert into public.plan_entitlements(plan_id,plan_version_id,entitlement_code,enabled)values('d2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002','FUNDING_PROBE',false),('d2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002','FUNDING_SECOND',false);
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
insert into p256 values('benefit3',public.create_benefit_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256_A','PLATFORM_FEATURE','AUTOMATED_PLATFORM','Premier avantage256','الميزة الأولى256','Configuration synthétique256','إعداد اختباري256',3,0,0,'EUR',null,null,null,'{}','{}','CANCEL_TEST_256',clock_timestamp()-interval'1 minute','box256-benefit3'));
insert into p256 values('benefit7',public.create_benefit_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256_B','CREDIT_SERVICE','MATRICIA_INTERNAL','Second avantage256','الميزة الثانية256','Configuration synthétique256','إعداد اختباري256',7,0,0,'EUR',null,null,null,'{}','{}','CANCEL_TEST_256',clock_timestamp()-interval'1 minute','box256-benefit7'));
select public.activate_benefit_version('b2560000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),'box256-activate3');
select public.activate_benefit_version('b2560000-0000-4000-8000-000000000001',(select(v->>'benefit_version_id')::uuid from p256 where k='benefit7'),'box256-activate7');
insert into p256 values('box',public.create_box_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256','MULTI_USER','Ma Box de recette256','صندوق الاختبار256',10,3,'{}',0,0,0,'EUR',clock_timestamp()-interval'1 minute',jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array((select v->>'benefit_version_id'from p256 where k='benefit3'))),jsonb_build_object('slot_code','EXTRA','slot_kind','OPTIONAL','minimum_selections',0,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array((select v->>'benefit_version_id'from p256 where k='benefit7')))),'box256-create'));
select public.activate_box_version('b2560000-0000-4000-8000-000000000001',(select(v->>'box_version_id')::uuid from p256 where k='box'),null,'box256-activate');
insert into p256 values('rule',public.link_plan_box_rule('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002',(select(v->>'box_version_id')::uuid from p256 where k='box'),'{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"EXACT"}',clock_timestamp()-interval'1 minute','box256-link'));
select set_config('test.rule256',(select v->>'plan_box_rule_id'from p256 where k='rule'),true);
-- Admission and implementation are approved before the complete Box source is reviewed.
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('binding-a',public.propose_benefit_native_binding_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),'PLATFORM_ENTITLEMENT','{"entitlement_code":"FUNDING_PROBE","duration_seconds":3600}','TEST_NATIVE_BINDING_A_331'));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_benefit_native_binding_v1((select(v->>'binding_id')::uuid from p256 where k='binding-a'),(select v->>'content_hash'from p256 where k='binding-a'),true,'TEST independent binding A review');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('benefit-admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3')));
insert into p256 values('benefit-admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),(select v->>'source_hash'from p256 where k='benefit-admission-context'),(select(v->>'head_id')::uuid from p256 where k='benefit-admission-context'),'NONE',null,null,'{}',array[(select(v->>'box_version_id')::uuid from p256 where k='box')],clock_timestamp()-interval'1 minute',null,'Condition explicite de Box pour recette native256','TEST_ONLY_BOX_256','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid()));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p256 where k='benefit-admission-policy'),(select v->>'content_hash'from p256 where k='benefit-admission-policy'),true,'TEST_ONLY_256','Approbation indépendante condition Box256');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('benefit7-admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit7')));
insert into p256 values('benefit7-admission-policy',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit7'),(select v->>'source_hash'from p256 where k='benefit7-admission-context'),(select(v->>'head_id')::uuid from p256 where k='benefit7-admission-context'),'NONE',null,null,'{}',array[(select(v->>'box_version_id')::uuid from p256 where k='box')],clock_timestamp()-interval'1 minute',null,'Condition explicite de Box pour recette native256','TEST_ONLY_BOX_256','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid()));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p256 where k='benefit7-admission-policy'),(select v->>'content_hash'from p256 where k='benefit7-admission-policy'),true,'TEST_ONLY_256','Approbation indépendante condition Box256');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('approval-context',public.get_box_configuration_approval_context_v1(current_setting('test.rule256')::uuid));
select throws_ok($$select public.approve_box_configuration_v1(current_setting('test.rule256')::uuid,(select v->>'source_hash'from p256 where k='approval-context'),'Approbaton de son propre contenu interdite','box256-self-approve')$$,'42501','BOX_CONFIGURATION_SELF_APPROVAL_DENIED','the Box and rule author cannot self-approve');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.approve_box_configuration_v1(current_setting('test.rule256')::uuid,repeat('f',64),'Refus du contexte qui a changé','box256-stale-approval')$$,'40001','STALE_BOX_CONFIGURATION_SOURCE','the reviewer must approve the source hash actually read');
insert into p256 values('approved',public.approve_box_configuration_v1(current_setting('test.rule256')::uuid,(select v->>'source_hash'from p256 where k='approval-context'),'Approbation indépendante synthétique de recette256','box256-independent-approval'));
select is((select v->>'outcome'from p256 where k='approved'),'BOX_CONFIGURATION_APPROVED','independent Finance approves the real rule, Box and allowed benefits');


select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.get_customer_box_configuration_v1('b2560000-0000-4000-8000-000000000001')->>'status','PAID_BOX_FUNDING_REQUIRED','an approved catalogue and expired trial do not create a paid Box right');

insert into p256 values('prep',public.prepare_subscription_payment_intent_v2('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','member330-prepare'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p256 values('intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p256 where k='prep'),'DEMO','SYNTHETIC-MEMBER-ORDER-330',12345,'EUR'));
insert into p256 values('paid',public.process_verified_subscription_payment_v2('DEMO','DEMO','SYNTHETIC-MEMBER-EVENT-330','SYNTHETIC-MEMBER-ORDER-330','PAYMENT_SUCCEEDED',12345,'EUR',clock_timestamp(),'SYNTHETIC-MEMBER-CAPTURE-330',repeat('d',64),repeat('e',64)));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('context',public.get_customer_box_configuration_v1('b2560000-0000-4000-8000-000000000001'));
insert into p256 values('selection',jsonb_build_array(jsonb_build_object('slot_code','CORE','benefit_version_id',(select v->>'benefit_version_id'from p256 where k='benefit3'),'units','1'),jsonb_build_object('slot_code','EXTRA','benefit_version_id',(select v->>'benefit_version_id'from p256 where k='benefit7'),'units','1')));
insert into p256 values('configured',public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',current_setting('test.rule256')::uuid,(select v->>'context_hash'from p256 where k='context'),(select v from p256 where k='selection'),'member330-configure'));
select public.ensure_client_credit_wallet('b2560000-0000-4000-8000-000000000001','member330-wallet');
insert into p256 values('grant-context',public.get_subscription_credit_grant_context_v1('b2560000-0000-4000-8000-000000000001',(select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-MEMBER-EVENT-330'),1));
select public.issue_subscription_credit_grant_v1('b2560000-0000-4000-8000-000000000001',(select id from public.subscription_payment_events where provider_event_id='SYNTHETIC-MEMBER-EVENT-330'),1,(select v#>>'{terms,terms_hash}'from p256 where k='grant-context'),'member330-grant');
select set_config('test.member_box330',(select id::text from public.customer_boxes where organization_id='b2560000-0000-4000-8000-000000000001'),true);


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



insert into public.subscription_plans(id,code,status,created_by)values('d3360000-0000-4000-8000-000000000001','PLATINUM','ACTIVE','a2560000-0000-4000-8000-000000000001');
insert into public.subscription_plan_versions(id,plan_id,version,status,currency,monthly_price_minor,annual_price_minor,monthly_credit_grant,core_allocation_basis_points,benefit_pool_allocation_basis_points,limits_snapshot,valid_from,content_hash,created_by)values('d3360000-0000-4000-8000-000000000002','d3360000-0000-4000-8000-000000000001',1,'ACTIVE','EUR',24690,246900,20,5000,5000,'{}',current_date-1,repeat('b',64),'a2560000-0000-4000-8000-000000000001');
insert into p256 values('binding-b',public.propose_benefit_native_binding_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),'PLATFORM_ENTITLEMENT','{"entitlement_code":"FUNDING_SECOND","duration_seconds":7200}','TEST_NATIVE_BINDING_B_338'));
insert into p256 values('new-box',public.create_box_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_TARGET_338','MULTI_USER','Nouvelle Box de recette338','الصندوق الجديد للاختبار338',20,3,'{}',0,0,0,'EUR',clock_timestamp()-interval'1 minute',jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array((select v->>'benefit_version_id'from p256 where k='benefit3')))),'overlap338-new-box'));
select public.activate_box_version('b2560000-0000-4000-8000-000000000001',(select(v->>'box_version_id')::uuid from p256 where k='new-box'),null,'overlap338-new-box-active');
insert into p256 values('new-rule',public.link_plan_box_rule('b2560000-0000-4000-8000-000000000001','d3360000-0000-4000-8000-000000000002',(select(v->>'box_version_id')::uuid from p256 where k='new-box'),'{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"AT_MOST"}',clock_timestamp()-interval'1 minute','overlap338-new-rule'));
insert into p256 values('new-admission-context',public.get_admin_benefit_admission_context_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3')));
insert into p256 values('new-admission',public.propose_benefit_admission_policy_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),(select v->>'source_hash'from p256 where k='new-admission-context'),(select(v->>'head_id')::uuid from p256 where k='new-admission-context'),'NONE',null,null,'{}',array[(select(v->>'box_version_id')::uuid from p256 where k='new-box')],clock_timestamp()-interval'1 minute',null,'TEST new paid Box has independently reviewed current conditions','TEST_ONLY_BOX_338','HUMAN_OPERATOR_REPORT_AND_INDEPENDENT_CLIENT_RECEIPT_V1',extensions.gen_random_uuid()));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_benefit_native_binding_v1((select(v->>'binding_id')::uuid from p256 where k='binding-b'),(select v->>'content_hash'from p256 where k='binding-b'),true,'TEST independently approve new implementation B');
select public.decide_benefit_admission_policy_v1((select(v->>'policy_id')::uuid from p256 where k='new-admission'),(select v->>'content_hash'from p256 where k='new-admission'),true,'TEST_ONLY_338','TEST independently approve new Box conditions');
insert into p256 values('new-box-source',public.get_box_configuration_approval_context_v1((select(v->>'plan_box_rule_id')::uuid from p256 where k='new-rule')));
select public.approve_box_configuration_v1((select(v->>'plan_box_rule_id')::uuid from p256 where k='new-rule'),(select v->>'source_hash'from p256 where k='new-box-source'),'TEST independently approve complete new paid Box promise','overlap338-new-approval');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('target-posting',public.create_credit_revenue_policy_v1('POSTING','SUBSCRIPTION','d3360000-0000-4000-8000-000000000002',null,'EUR','DEVELOPMENT',1,current_date-1,null,'{"cash_account_code":"FUNDING256_CASH_EUR","cash_name_fr":"Trésorerie synthétique de recette","cash_name_ar":"خزينة الاختبار","suspense_account_code":"FUNDING256_PENDING_EUR","suspense_name_fr":"Encaissement synthétique en attente","suspense_name_ar":"تحصيل قيد المراجعة"}','Configuration uniquement pour la recette SQL0336','lineage336-posting-target'));
insert into p256 values('upgrade-policy',public.propose_subscription_upgrade_policy_v1('d2560000-0000-4000-8000-000000000002','d3360000-0000-4000-8000-000000000002','MONTHLY','TEST ONLY full new-cycle price; preserve separately acquired older Box and grants within their original validity.','شروط اختبار فقط: السعر الكامل لدورة جديدة مع الحفاظ على الصندوق السابق والأرصدة ضمن صلاحيتها الأصلية.',clock_timestamp()-interval'1 minute',null,900,'TEST-0338-FULL-PAID-OVERLAP'));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_credit_revenue_policy_v1((select(v->>'request_id')::uuid from p256 where k='target-posting'),true,(select v->>'request_hash'from p256 where k='target-posting'),'TEST independent target posting review');
select public.decide_subscription_upgrade_policy_v1((select(v->>'policy_id')::uuid from p256 where k='upgrade-policy'),(select v->>'content_hash'from p256 where k='upgrade-policy'),true,'TEST independent preserved Box rights policy review');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('upgrade-quote',public.create_client_subscription_upgrade_quote_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'policy_id')::uuid from p256 where k='upgrade-policy'),'lineage336-quote'));
insert into p256 values('upgrade-prepare',public.prepare_client_subscription_upgrade_payment_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'quote_id')::uuid from p256 where k='upgrade-quote'),(select v->>'content_hash'from p256 where k='upgrade-quote'),true,'PAYPAL','SANDBOX','lineage336-checkout'));
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into p256 values('upgrade-intent',public.register_subscription_payment_intent_v2((select(v->>'preparation_id')::uuid from p256 where k='upgrade-prepare'),'SANDBOX','SYNTHETIC-LINEAGE-ORDER-0336',(select(v->>'amount_minor')::bigint from p256 where k='upgrade-quote'),'EUR'));
insert into p256 values('upgrade-paid',public.process_verified_subscription_payment_v2('PAYPAL','SANDBOX','SYNTHETIC-LINEAGE-EVENT-0336','SYNTHETIC-LINEAGE-ORDER-0336','PAYMENT_SUCCEEDED',(select(v->>'amount_minor')::bigint from p256 where k='upgrade-quote'),'EUR',clock_timestamp(),'SYNTHETIC-LINEAGE-CAPTURE-0336',repeat('3',64),repeat('4',64)));
select is((select v->>'outcome'from p256 where k='upgrade-paid'),'SUBSCRIPTION_ACTIVATED','real full new-cycle payment activates the upgraded plan');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('target-context',public.get_customer_box_configuration_v1('b2560000-0000-4000-8000-000000000001'));
select is((select v->>'status'from p256 where k='target-context'),'CONFIGURABLE','a genuinely fully paid new cycle may configure its new Box');
insert into p256 values('new-configured',public.configure_customer_box_v1('b2560000-0000-4000-8000-000000000001',(select(v->>'plan_box_rule_id')::uuid from p256 where k='new-rule'),(select v->>'context_hash'from p256 where k='target-context'),jsonb_build_array(jsonb_build_object('slot_code','CORE','benefit_version_id',(select v->>'benefit_version_id'from p256 where k='benefit3'),'units','1')),'overlap338-new-configure'));
select set_config('test.new_box338',(select v->>'customer_box_id'from p256 where k='new-configured'),true);
select public.set_customer_box_envelope_v1(current_setting('test.new_box338')::uuid,'MEMBER','a2560000-0000-4000-8000-000000000003',0,20,'TEST exact new Box member envelope','overlap338-new-envelope');
select throws_ok($$select public.reserve_benefit_credits('b2560000-0000-4000-8000-000000000001',(select(v->>'wallet_id')::uuid from p256 where k='grant-context'),(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),1,now()+interval'1 day','overlap338-ambiguous')$$,'55000','BOX_RESERVATION_CONTEXT_REQUIRED','unscoped reservation cannot silently pick an overlapping paid Box');
select public.set_customer_box_envelope_v1(current_setting('test.member_box330')::uuid,'MEMBER','a2560000-0000-4000-8000-000000000003',0,10,'TEST Buyer acquired budget survives upgrade','lineage336-envelope');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
insert into p256 values('lineage-reserved',public.reserve_my_box_benefit_v1(current_setting('test.member_box330')::uuid,(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),1,now()+interval'1 day','lineage336-reserve'));
reset role;
select is((select v->>'outcome'from p256 where k='lineage-reserved'),'MEMBER_BOX_BENEFIT_RESERVED','Buyer can explicitly select the older paid Box after full-cycle upgrade');
set local role authenticated;
insert into p256 values('lineage-executed',public.execute_benefit_native_v1((select(v->>'redemption_id')::uuid from p256 where k='lineage-reserved'),1,'{}','lineage336-execute'));
reset role;
select is((select v->>'entitlement_code'from p256 where k='lineage-executed'),'FUNDING_PROBE','native execution still uses original frozen binding A');
reset role;
select is((select count(*)from public.customer_boxes where organization_id='b2560000-0000-4000-8000-000000000001'),2::bigint,'two fully paid cycles produce two actually overlapping acquired Boxes');
select is((select sum(quantity)::text from public.credit_lots where organization_id='b2560000-0000-4000-8000-000000000001'),'10','only original granted credits exist');
select is((select binding_id::text from public.benefit_native_execution_sources_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='lineage-reserved')),(select v->>'binding_id'from p256 where k='binding-a'),'immutable acquired implementation A remains pinned');
select is((select customer_box_id::text from public.customer_box_redemption_allocations_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='lineage-reserved')),current_setting('test.member_box330'),'old explicit member command allocates exactly the selected old Box');
select is((select policy_id::text from public.benefit_redemption_admissions_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='lineage-reserved')),(select v->>'policy_id'from p256 where k='benefit-admission-policy'),'old Box keeps its old acquired admission policy');
set local role authenticated;
insert into p256 values('new-reserved',public.reserve_my_box_benefit_v1(current_setting('test.new_box338')::uuid,(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),1,now()+interval'1 day','overlap338-new-reserve'));
insert into p256 values('new-executed',public.execute_benefit_native_v1((select(v->>'redemption_id')::uuid from p256 where k='new-reserved'),1,'{}','overlap338-new-execute'));
reset role;
select is((select v->>'entitlement_code'from p256 where k='new-executed'),'FUNDING_SECOND','new Box executes its newly approved binding B');
select is((select customer_box_id::text from public.customer_box_redemption_allocations_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='new-reserved')),current_setting('test.new_box338'),'new explicit member command allocates exactly the selected new Box');
select is((select policy_id::text from public.benefit_redemption_admissions_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='new-reserved')),(select v->>'policy_id'from p256 where k='new-admission'),'new Box keeps its own new acquired policy');
select is((select binding_id::text from public.benefit_native_execution_sources_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='new-reserved')),(select v->>'binding_id'from p256 where k='binding-b'),'new allocation freezes its own exact acquired binding');
select*from finish();rollback;
