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

select public.set_customer_box_envelope_v1(current_setting('test.member_box330')::uuid,'MEMBER','a2560000-0000-4000-8000-000000000003',0,10,'TEST Buyer platform envelope','native331-envelope');
select is((select source_snapshot#>>'{options,0,source_snapshot,slots,0,benefits,0,admission_policy,native_binding,id}'from private.subscription_prepared_box_terms_v1 where preparation_id=(select(v->>'preparation_id')::uuid from p256 where k='prep')),(select v->>'binding_id'from p256 where k='binding-a'),'the exact implementation A is frozen before PSP creation');
-- A later approved implementation must not rewrite the already purchased right.
insert into p256 values('binding-b',public.propose_benefit_native_binding_v1((select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),'PLATFORM_ENTITLEMENT','{"entitlement_code":"FUNDING_SECOND","duration_seconds":7200}','TEST_NATIVE_BINDING_B_331'));
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select public.decide_benefit_native_binding_v1((select(v->>'binding_id')::uuid from p256 where k='binding-b'),(select v->>'content_hash'from p256 where k='binding-b'),true,'TEST independent binding B review');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
insert into p256 values('reserve-native',public.reserve_my_box_benefit_v1(current_setting('test.member_box330')::uuid,(select(v->>'benefit_version_id')::uuid from p256 where k='benefit3'),1,now()+interval'1 day','native331-reserve'));
reset role;
select is((select binding_id::text from public.benefit_native_execution_sources_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')),(select v->>'binding_id'from p256 where k='binding-a'),'reservation pins acquired A even after B was published');
select is((private.reserved_benefit_native_binding_v1((select(v->>'redemption_id')::uuid from p256 where k='reserve-native'))).id::text,(select v->>'binding_id'from p256 where k='binding-a'),'execution resolver reads acquired A rather than latest B');
select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select throws_ok($$select public.execute_benefit_native_v1((select(v->>'redemption_id')::uuid from p256 where k='reserve-native'),1,'{}','native331-aal1')$$,'42501','BENEFIT_NATIVE_EXECUTION_DENIED','native effects require MFA');
select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
insert into p256 values('executed-native',public.execute_benefit_native_v1((select(v->>'redemption_id')::uuid from p256 where k='reserve-native'),1,'{}','native331-execute'));
select is((select v->>'entitlement_code'from p256 where k='executed-native'),'FUNDING_PROBE','the actual effect activates promised feature A');
select is(public.execute_benefit_native_v1((select(v->>'redemption_id')::uuid from p256 where k='reserve-native'),1,'{}','native331-execute'),(select v from p256 where k='executed-native'),'native replay is idempotent');
reset role;
select is((select count(*)from public.benefit_native_execution_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')),1::bigint,'exactly one immutable effect is recorded');
select is((select binding_id::text from public.benefit_native_execution_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')),(select v->>'binding_id'from p256 where k='binding-a'),'recorded implementation is the exact acquired implementation');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok(public.subscription_has_entitlement('b2560000-0000-4000-8000-000000000001','FUNDING_PROBE'),'the real acquired feature is usable by the authorized organization');
select ok(not public.subscription_has_entitlement('b2560000-0000-4000-8000-000000000001','FUNDING_SECOND'),'later implementation B is not substituted or granted');
select throws_ok($$update public.benefit_native_execution_sources_v1 set binding_id=(select(v->>'binding_id')::uuid from p256 where k='binding-b')where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')$$,'55000',null,'execution source history is immutable');
select ok(not has_table_privilege('authenticated','public.benefit_native_execution_sources_v1','INSERT'),'browser cannot forge a pinned implementation');

insert into public.platform_user_roles(user_id,role_code)values('a2560000-0000-4000-8000-000000000002','MATRICIA_ADMIN');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000002',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is(public.list_benefit_fulfillment_v1(null)#>>'{rows,0,can_operate}','true','staff UI permits the report after verified native activation');
select is(public.list_benefit_fulfillment_v1(null)#>>'{rows,0,execution_requires_native}','false','already activated benefit no longer claims activation is missing');
insert into p256 values('native-report',public.propose_benefit_delivery_v1((select(v->>'redemption_id')::uuid from p256 where k='reserve-native'),2,'La fonction acquise A a été activée et son effet natif vérifié pour cette recette','TEST_NATIVE_EFFECT_A_335',null,'native335-report'));
select is((select v->>'outcome'from p256 where k='native-report'),'BENEFIT_DELIVERY_REVIEW_REQUIRED','real native effect produces a governed operational report');
select throws_ok($$select public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p256 where k='native-report'),(select v->>'source_hash'from p256 where k='native-report'),(select(v->>'row_version')::bigint from p256 where k='native-report'),true,'Report author cannot self-certify client acceptance','native335-self-receipt')$$,'42501','BENEFIT_INDEPENDENT_CLIENT_RECEIPT_REQUIRED','effect/report author cannot supply the independent Client receipt');
select set_config('request.jwt.claim.sub','a2560000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2560000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(public.list_benefit_fulfillment_v1('b2560000-0000-4000-8000-000000000001')#>>'{rows,0,can_receive}','true','independent Owner UI offers acceptance of the real native report');
insert into p256 values('native-receipt',public.decide_my_benefit_delivery_v1((select(v->>'proposal_id')::uuid from p256 where k='native-report'),(select v->>'source_hash'from p256 where k='native-report'),(select(v->>'row_version')::bigint from p256 where k='native-report'),true,'Je confirme la réception indépendante de la fonction acquise effectivement activée','native335-receipt'));
select is((select v->>'outcome'from p256 where k='native-receipt'),'BENEFIT_DELIVERY_ACCEPTED','independent Client receipt is real and immutable');
insert into p256 values('native-consume',public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p256 where k='reserve-native'),(select v->>'receipt_hash'from p256 where k='native-receipt'),'native335-consume'));
select is(public.consume_benefit_credits((select(v->>'redemption_id')::uuid from p256 where k='reserve-native'),(select v->>'receipt_hash'from p256 where k='native-receipt'),'native335-consume'),(select v from p256 where k='native-consume'),'actual credit consumption safely replays');
reset role;
select is((select status from public.benefit_redemptions where id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')),'CONSUMED','native activation through independent receipt reaches actual CONSUMED');
select is((select sum(quantity)from public.credit_lot_movements where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')and movement_type='CONSUME'),3::numeric,'exactly the original three reserved credits are consumed');
select is((select count(*)from public.benefit_client_receipts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')and accepted),1::bigint,'one independent accepted receipt exists');
select is((select count(*)from public.benefit_native_execution_facts_v1 where redemption_id=(select(v->>'redemption_id')::uuid from p256 where k='reserve-native')),1::bigint,'report and receipt never repeat or replace acquired native effect A');
select*from finish();rollback;
