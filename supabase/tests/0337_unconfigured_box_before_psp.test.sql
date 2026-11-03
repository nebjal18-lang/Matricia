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
insert into p256 values('box',public.create_box_version('b2560000-0000-4000-8000-000000000001','CONFIG_BOX_256','MULTI_USER','Ma Box de recette256','صندوق الاختبار256',10,3,'{}',0,0,0,'EUR',clock_timestamp()-interval'1 minute',jsonb_build_array(jsonb_build_object('slot_code','CORE','slot_kind','MANDATORY','minimum_selections',1,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array((select v->>'benefit_version_id'from p256 where k='benefit3'))),jsonb_build_object('slot_code','EXTRA','slot_kind','OPTIONAL','minimum_selections',0,'maximum_selections',1,'allowed_benefit_version_ids',jsonb_build_array((select v->>'benefit_version_id'from p256 where k='benefit7')))),'box256-create'));
select public.activate_box_version('b2560000-0000-4000-8000-000000000001',(select(v->>'box_version_id')::uuid from p256 where k='box'),null,'box256-activate');
insert into p256 values('rule',public.link_plan_box_rule('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002',(select(v->>'box_version_id')::uuid from p256 where k='box'),'{"schema_version":1,"period_unit":"SUBSCRIPTION_CYCLE","budget_rule":"EXACT"}',clock_timestamp()-interval'1 minute','box256-link'));
select set_config('test.rule256',(select v->>'plan_box_rule_id'from p256 where k='rule'),true);

-- The approval API historically allowed a Box source with missing admission.
-- Checkout must still fail before authorizing a PSP order, including an optional slot.
insert into p256 values('unconfigured-context',public.get_box_configuration_approval_context_v1(current_setting('test.rule256')::uuid));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.approve_box_configuration_v1(current_setting('test.rule256')::uuid,(select v->>'source_hash'from p256 where k='unconfigured-context'),'TEST intentionally incomplete source must not reach PSP','checkout337-review');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select public.prepare_subscription_payment_intent_v2('b2560000-0000-4000-8000-000000000001','d2560000-0000-4000-8000-000000000002','MONTHLY','DEMO','DEMO','checkout337-unconfigured')$$,'55000','BOX_BENEFIT_EXECUTION_POLICY_REQUIRED','missing acquired admission blocks payment preparation before first PSP authorization');
select is((select count(*)from public.subscription_payment_intents where organization_id='b2560000-0000-4000-8000-000000000001'),0::bigint,'no provider intent is registered for an unconfigured offer');
select is((select count(*)from private.subscription_prepared_box_terms_v1 where organization_id='b2560000-0000-4000-8000-000000000001'),0::bigint,'failed preparation freezes no misleading ready-to-buy promise');
select*from finish();rollback;
