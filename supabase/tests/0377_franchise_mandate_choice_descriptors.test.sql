-- Actual independent approvals and noncontractual native activations provide
-- two authorized territories in the same organization and library.
begin;set local search_path=public,extensions;select no_plan();
grant usage on schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a3770000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','catalog377-'||n||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,5)n;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b3770000-0000-4000-8000-000000000001','TEST377 operator','TEST377 operator','ACTIVE','a3770000-0000-4000-8000-000000000001');
insert into public.catalog_libraries(id,code,slug,steward_organization_id,created_by)values('c3770000-0000-4000-8000-000000000001','TEST377','test377','b3770000-0000-4000-8000-000000000001','a3770000-0000-4000-8000-000000000001');
insert into public.platform_user_roles(user_id,role_code)values('a3770000-0000-4000-8000-000000000001','MATRICIA_ADMIN'),('a3770000-0000-4000-8000-000000000002','MATRICIA_ADMIN');
insert into public.organization_memberships(id,organization_id,user_id,status)
select ('d3770000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'b3770000-0000-4000-8000-000000000001',('a3770000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'ACTIVE'from generate_series(3,5)n;
update private.admin_execution_environment_v1 set environment='DEVELOPMENT',configuration_reference='TEST0377_ROLLBACK_ONLY'where singleton;
create temporary table catalog377(k text primary key,v jsonb);
grant select,insert on catalog377 to authenticated,service_role;
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into catalog377 values('proposal1',public.propose_franchise_governance('c3770000-0000-4000-8000-000000000001','b3770000-0000-4000-8000-000000000001','FRANCHISEE','TEST377_A','Territoire TEST A','النطاق أ','{}',now()-interval'1 day',now()+interval'1 year',100000,'UPFRONT',0,'{}','{}','{"TEST_ONLY":true}','catalog377-3@example.invalid',repeat('a',64),'fr-MA','{}','TEST377 native catalogue mandate A','TEST377-propose-A'));
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from catalog377 where k='proposal1'),'APPROVE','TEST377 independent approval A',1,'TEST377-approve-A');
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into catalog377 values('activation1',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from catalog377 where k='proposal1'),repeat('a',64),1,(select(v->>'mandate_version_id')::uuid from catalog377 where k='proposal1'),(public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from catalog377 where k='proposal1'))->>'mandateHash'),true,'TEST377-activate-A'));
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000001',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into catalog377 values('proposal2',public.propose_franchise_governance('c3770000-0000-4000-8000-000000000001','b3770000-0000-4000-8000-000000000001','FRANCHISEE','TEST377_B','Territoire TEST B','النطاق ب','{}',now()-interval'1 day',now()+interval'2 years',100000,'UPFRONT',0,'{}','{}','{"TEST_ONLY":true}','catalog377-3@example.invalid',repeat('b',64),'ar-MA','{}','TEST377 native catalogue mandate B','TEST377-propose-B'));
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000002',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select public.decide_franchise_governance((select(v->>'approval_request_id')::uuid from catalog377 where k='proposal2'),'APPROVE','TEST377 independent approval B',1,'TEST377-approve-B');
reset role;
select set_config('request.jwt.claim.role','authenticated',true),set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
insert into catalog377 values('activation2',public.simulate_franchise_invitation_acceptance((select(v->>'invitation_id')::uuid from catalog377 where k='proposal2'),repeat('b',64),1,(select(v->>'mandate_version_id')::uuid from catalog377 where k='proposal2'),(public.franchise_invitation_activation_preview((select(v->>'invitation_id')::uuid from catalog377 where k='proposal2'))->>'mandateHash'),true,'TEST377-activate-B'));

reset role;create temporary table choices377(value jsonb);grant select,insert on choices377 to authenticated;set local role authenticated;
insert into choices377 select public.franchise_mandate_choices_v1('b3770000-0000-4000-8000-000000000001');
select is((select jsonb_array_length(value->'items')from choices377),2,'one native owner sees both authorized mandates in the same library and organization');
select ok((select bool_and(item->>'territory_fr'in('Territoire TEST A','Territoire TEST B')and item->>'territory_ar'in('النطاق أ','النطاق ب'))from choices377 cross join lateral jsonb_array_elements(value->'items')item),'each choice contains the approved French and Arabic territory names');
select is((select count(distinct item->>'territory_code')from choices377 cross join lateral jsonb_array_elements(value->'items')item),2::bigint,'the business territory code distinguishes equal library and operator identities');
select ok((select bool_and(item->>'library_code'='TEST377'and item->>'library_fr'='TEST377'and item->>'library_ar'='TEST377')from choices377 cross join lateral jsonb_array_elements(value->'items')item),'an unpublished library uses its real catalogue code instead of an invented name');
select ok((select bool_and(item#>>'{roles,0,label_fr}'='Propriétaire franchisé'and item#>>'{roles,0,label_ar}'='مالك الامتياز')from choices377 cross join lateral jsonb_array_elements(value->'items')item),'role descriptors come from existing approved reference labels');
select is(jsonb_array_length(public.franchise_mandate_choices_v1('b3770000-0000-4000-8000-000000000099')->'items'),0,'an unrelated organization filter does not reveal another mandate');
reset role;
-- A future, unselected territory version is not the active mandate's source.
insert into public.franchise_territory_versions(franchise_id,version,territory_code,name_fr,name_ar,scope_snapshot,effective_from,content_hash,created_by)
select(v->>'franchise_id')::uuid,2,'TEST377_FUTURE','Nom futur non approuvé','اسم مستقبلي غير معتمد','{}',now()+interval'2 years',repeat('f',64),'a3770000-0000-4000-8000-000000000001'from catalog377 where k='proposal1';
select set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000003',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select ok(public.franchise_mandate_choices_v1()::text not like'%Nom futur non approuvé%','a future territory version cannot replace the active approved territory label');
reset role;
select set_config('request.jwt.claim.sub','a3770000-0000-4000-8000-000000000004',true),set_config('request.jwt.claims','{"sub":"a3770000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);set local role authenticated;
select is(jsonb_array_length(public.franchise_mandate_choices_v1()->'items'),0,'a sibling organization member without assignment receives no choice descriptors');
reset role;
select ok(not has_function_privilege('anon','public.franchise_mandate_choices_v1(uuid)','execute')and not has_function_privilege('service_role','public.franchise_mandate_choices_v1(uuid)','execute'),'selector descriptors add no anonymous or service capability');
select *from finish();rollback;
