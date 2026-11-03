begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select plan(9);
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','delivery-admin-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,4)i;
insert into public.platform_user_roles(user_id,role_code)select ('a1810000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,case when i=4 then'SUPPORT_AGENT'else'MATRICIA_ADMIN'end from generate_series(1,4)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b1810000-0000-4000-8000-000000000001','Delivery Test','Delivery Test','ACTIVE','a1810000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c1810000-0000-4000-8000-000000000001','CLIENT_OWNER'),('c1810000-0000-4000-8000-000000000001','PROVIDER_OWNER');

insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)
values
('e1810000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','RESTRICT_ENTITY','DEVELOPMENT','ORGANIZATION','b1810000-0000-4000-8000-000000000001',repeat('a',64),'{"intent": "CHANGE_CONFIGURATION", "status": "ARCHIVED", "expectedRowVersion": 1}'::jsonb,'Archiver après contrôles indépendants',2,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'),
('e1810000-0000-4000-8000-000000000002','b1810000-0000-4000-8000-000000000001','MANUAL_EXCEPTION','DEVELOPMENT','ORGANIZATION','b1810000-0000-4000-8000-000000000001',repeat('a',64),'{"intent": "CHANGE_CONFIGURATION", "status": "ACTIVE", "expectedRowVersion": 2}'::jsonb,'Réactiver après contrôles indépendants',2,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'),
('e1810000-0000-4000-8000-000000000003','b1810000-0000-4000-8000-000000000001','CHANGE_CONFIGURATION','DEVELOPMENT','MEMBERSHIP','a1810000-0000-4000-8000-000000000004',repeat('a',64),'{"currentRole": "CLIENT_OWNER", "newRole": "CLIENT_VIEWER", "capabilities": []}'::jsonb,'Retirer les droits de gestion Client',1,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'),
('e1810000-0000-4000-8000-000000000004','b1810000-0000-4000-8000-000000000001','CHANGE_CONFIGURATION','DEVELOPMENT','MEMBERSHIP','a1810000-0000-4000-8000-000000000004',repeat('a',64),'{"currentRole": "CLIENT_VIEWER", "newRole": "CLIENT_OWNER", "capabilities": ["SUPER_ADMIN_BYPASS"]}'::jsonb,'Refuser toute capacité hors du modèle',1,'AUTHORIZED','a1810000-0000-4000-8000-000000000001');
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)
select x.id,'APPROVE','Approbation indépendante de test',x.request_payload_hash,u.id from public.admin_operational_action_requests x cross join auth.users u
where x.id in('e1810000-0000-4000-8000-000000000001','e1810000-0000-4000-8000-000000000002','e1810000-0000-4000-8000-000000000003','e1810000-0000-4000-8000-000000000004')and u.id in('a1810000-0000-4000-8000-000000000002','a1810000-0000-4000-8000-000000000003');
create temporary table observed(k text,v jsonb);grant all on observed to service_role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.sub','',true);
insert into observed values('archive',public.execute_admin_operational_action_v1('e1810000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
reset role;
select is((select status from public.organizations where id='b1810000-0000-4000-8000-000000000001'),'ARCHIVED','approved ARCHIVED status is applied exactly');
select is((select v->>'outcome'from observed where k='archive'),'ADMIN_ACTION_EXECUTED','archive success corresponds to an actual effect');
set local role service_role;
insert into observed values('active',public.execute_admin_operational_action_v1('e1810000-0000-4000-8000-000000000002',extensions.gen_random_uuid()));
reset role;
select is((select status from public.organizations where id='b1810000-0000-4000-8000-000000000001'),'ACTIVE','manual reactivation changes the actual organization status');
set local role service_role;
insert into observed values('role',public.execute_admin_operational_action_v1('e1810000-0000-4000-8000-000000000003',extensions.gen_random_uuid()));
reset role;
select is((select v->>'outcome'from observed where k='role'),'ADMIN_ACTION_EXECUTED','canonical role replacement executes');
select ok(not private.can_manage_client_request('b1810000-0000-4000-8000-000000000001','a1810000-0000-4000-8000-000000000004'),'viewer no longer passes the actual Client request management gate');
select ok(private.has_org_role('b1810000-0000-4000-8000-000000000001',array['PROVIDER_OWNER'],'a1810000-0000-4000-8000-000000000004'),'role replacement preserves the unrelated Provider role');
select ok(not private.has_platform_role(array['SUPER_ADMIN'],'a1810000-0000-4000-8000-000000000004'),'organization role replacement cannot grant a platform role');
set local role service_role;
select throws_ok($$select public.execute_admin_operational_action_v1('e1810000-0000-4000-8000-000000000004',extensions.gen_random_uuid())$$,'22023','ADMIN_CAPABILITY_OUTSIDE_MODEL','raw worker execution rejects capabilities outside the model');
reset role;
select ok(not exists(select 1 from public.admin_membership_capability_reviews_v1 where action_request_id='e1810000-0000-4000-8000-000000000004'),'invalid capability does not create granted rights or a fake review');
select*from finish();rollback;
