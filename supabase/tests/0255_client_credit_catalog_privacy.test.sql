begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated;
select no_plan();
-- Historical read-only fixtures: these rows represent already-held versions.
-- This test proves visibility and column privacy, not customer Box attribution
-- or a paid entitlement. Native assignment is exercised separately in 0256.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','privacy255-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,3)n;
insert into public.organizations(id,legal_name,display_name,status,created_by)
select ('b2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Privacy fixture 255-'||n,'Privacy 255-'||n,'ACTIVE',('a2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,2)n;
insert into public.organization_memberships(id,organization_id,user_id,status,activated_at)
select ('c2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('b2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('a2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE',now()from generate_series(1,2)n;
insert into public.organization_member_roles(membership_id,role_code)values('c2550000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c2550000-0000-4000-8000-000000000002','CLIENT_OWNER');
insert into public.platform_user_roles(user_id,role_code)values('a2550000-0000-4000-8000-000000000003','FINANCE_MANAGER');
insert into public.subscriptions(id,organization_id,status)values('d2550000-0000-4000-8000-000000000001','b2550000-0000-4000-8000-000000000001','TRIAL_EXPIRED'),('d2550000-0000-4000-8000-000000000002','b2550000-0000-4000-8000-000000000002','TRIAL_EXPIRED');
insert into public.box_definitions(id,code,status,created_by)select ('e2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'PRIVACY_BOX_255_'||n,'ACTIVE','a2550000-0000-4000-8000-000000000003'from generate_series(1,3)n;
insert into public.box_versions(id,box_id,version,status,box_type,name_fr,name_ar,credit_budget,rollover_months,rules_snapshot,cost_low_minor,cost_expected_minor,cost_full_minor,currency,approval_reference,content_hash,effective_from,created_by)
select ('f2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('e2550000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,1,case when n=1 then'ACTIVE'else'RETIRED'end,'FIXED','Box de recette '||n,'صندوق اختبار '||n,9007199254740993,3,'{"private_policy":"DO_NOT_EXPOSE"}',123456,234567,123456,'MAD','INTERNAL_APPROVAL_255',repeat(n::text,64),now()-interval'1 year','a2550000-0000-4000-8000-000000000003'from generate_series(1,3)n;
insert into public.customer_boxes(organization_id,subscription_id,box_version_id,period_start,period_end,selections_snapshot,content_hash,created_by)values
('b2550000-0000-4000-8000-000000000001','d2550000-0000-4000-8000-000000000001','f2550000-0000-4000-8000-000000000002',now()-interval'2 months',now()-interval'1 month','[]',repeat('a',64),'a2550000-0000-4000-8000-000000000001'),
('b2550000-0000-4000-8000-000000000002','d2550000-0000-4000-8000-000000000002','f2550000-0000-4000-8000-000000000003',now()-interval'2 months',now()-interval'1 month','[]',repeat('b',64),'a2550000-0000-4000-8000-000000000002');
insert into public.benefit_definitions(id,code,status,created_by)values('e2550001-0000-4000-8000-000000000001','PRIVACY_BENEFIT_255','ACTIVE','a2550000-0000-4000-8000-000000000003');
insert into public.benefit_versions(id,benefit_id,version,status,benefit_type,fulfillment_mode,name_fr,name_ar,description_fr,description_ar,credit_cost,reference_value_minor,internal_cost_minor,currency,cancellation_rule_version,effective_from,content_hash,created_by)
values('f2550001-0000-4000-8000-000000000001','e2550001-0000-4000-8000-000000000001',1,'ACTIVE','CREDIT_SERVICE','MATRICIA_INTERNAL','Avantage de recette','ميزة اختبار','Description de recette','وصف الاختبار',9007199254740993,9999,7654321,'MAD','TEST_ONLY',now()-interval'1 day',repeat('c',64),'a2550000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','a2550000-0000-4000-8000-000000000001',true);select set_config('request.jwt.claims','{"sub":"a2550000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select internal_cost_minor from public.benefit_versions$$,'42501',null,'Client cannot SELECT benefit internal costs directly');
select throws_ok($$select cost_expected_minor from public.box_versions$$,'42501',null,'Client cannot SELECT Box internal costs directly');
select throws_ok($$select *from public.box_versions$$,'42501',null,'SELECT star cannot bypass column-level denial');
select throws_ok($$select rules_snapshot from public.box_versions$$,'42501',null,'raw internal Box rules are not Client data');
select throws_ok($$select capacity_rule from public.benefit_versions$$,'42501',null,'raw operational capacity rules remain private');
select is((select count(*)from public.box_versions where id='f2550000-0000-4000-8000-000000000002'),0::bigint,'direct table RLS does not globally expose retired versions');
select is((public.list_client_credit_catalog_v1('b2550000-0000-4000-8000-000000000001')#>>'{benefits,0,credit_cost}'),'9007199254740993','commercial credit cost is serialized as exact text');
select is((public.list_client_credit_catalog_v1('b2550000-0000-4000-8000-000000000001')#>>'{boxes,0,credit_budget}'),'9007199254740993','commercial Box budget is serialized as exact text');
select is((select count(*)from jsonb_array_elements(public.list_client_credit_catalog_v1('b2550000-0000-4000-8000-000000000001')->'boxes')v where v->>'id'='f2550000-0000-4000-8000-000000000002'),1::bigint,'the exact retired version held by this tenant remains readable');
select is((select count(*)from jsonb_array_elements(public.list_client_credit_catalog_v1('b2550000-0000-4000-8000-000000000001')->'boxes')v where v->>'id'='f2550000-0000-4000-8000-000000000003'),0::bigint,'a different tenant holding does not expose its retired version');
select ok(not(public.list_client_credit_catalog_v1('b2550000-0000-4000-8000-000000000001')::text~'internal_cost|cost_expected|cost_low|cost_full|DO_NOT_EXPOSE|INTERNAL_APPROVAL'),'sanitized RPC excludes internal values and column names');
select throws_ok($$select public.list_client_credit_catalog_v1('b2550000-0000-4000-8000-000000000002')$$,'42501','CLIENT_CREDIT_CATALOG_DENIED','an explicit unauthorized organization never falls back to the owner tenant');
select throws_ok($$select public.list_admin_boxes_dashboard(100)$$,'42501',null,'Client cannot use the privileged cost reader');
reset role;
select set_config('request.jwt.claim.sub','a2550000-0000-4000-8000-000000000003',true);select set_config('request.jwt.claims','{"sub":"a2550000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
set local role authenticated;
select throws_ok($$select public.list_admin_boxes_dashboard(100)$$,'42501',null,'Finance at AAL1 cannot read internal costs');
select throws_ok($$select internal_cost_minor from public.benefit_versions$$,'42501',null,'Finance JWT also uses the controlled reader instead of a global cost grant');
reset role;
select set_config('request.jwt.claims','{"sub":"a2550000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select v->>'internal_cost_minor'from jsonb_array_elements(public.list_admin_boxes_dashboard(100)->'benefits')v where v->>'id'='f2550001-0000-4000-8000-000000000001'),'7654321','authorized Finance AAL2 retains the exact internal benefit cost');
select is((select v->>'cost_expected_minor'from jsonb_array_elements(public.list_admin_boxes_dashboard(100)->'boxes')v where v->>'id'='f2550000-0000-4000-8000-000000000001'),'234567','authorized Finance AAL2 retains the exact internal Box cost');
reset role;
select *from finish();
rollback;
