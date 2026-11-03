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


insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)values
('e1920000-0000-4000-8000-000000000001','b1810000-0000-4000-8000-000000000001','CHANGE_CONFIGURATION','DEVELOPMENT','ORGANIZATION','b1810000-0000-4000-8000-000000000001',repeat('a',64),'{"draft":true,"intent":"CHANGE_CONFIGURATION","legalName":"Brouillon uniquement"}','Conserver le brouillon sans le déclarer appliqué',1,'AUTHORIZED','a1810000-0000-4000-8000-000000000001'),
('e1920000-0000-4000-8000-000000000002','b1810000-0000-4000-8000-000000000001','CHANGE_CONFIGURATION','DEVELOPMENT','MEMBERSHIP','a1810000-0000-4000-8000-000000000004',repeat('a',64),'{"currentRole":"CLIENT_OWNER","newRole":"CLIENT_OWNER","capabilities":["support"]}','Demander une capacité hors du rôle canonique courant',1,'AUTHORIZED','a1810000-0000-4000-8000-000000000001');
insert into public.admin_operational_action_decisions(action_request_id,decision,reason,request_payload_hash,decided_by)select id,'APPROVE','Contrôle indépendant de test',request_payload_hash,'a1810000-0000-4000-8000-000000000002'from public.admin_operational_action_requests where id in('e1920000-0000-4000-8000-000000000001','e1920000-0000-4000-8000-000000000002');
create temporary table observed(k text,v jsonb);grant all on observed to service_role;
set local role service_role;select set_config('request.jwt.claims','{"role":"service_role"}',true);select set_config('request.jwt.claim.sub','',true);
insert into observed values('draft',public.execute_admin_operational_action_v1('e1920000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
insert into observed values('retry',public.execute_admin_operational_action_v1('e1920000-0000-4000-8000-000000000001',extensions.gen_random_uuid()));
insert into observed values('review',public.execute_admin_operational_action_v1('e1920000-0000-4000-8000-000000000002',extensions.gen_random_uuid()));
reset role;
select is((select v->>'outcome'from observed where k='draft'),'ADMIN_ACTION_REQUEST_TRACKED','a durable draft is tracked without claiming execution');
select is((select status from public.admin_operational_action_requests where id='e1920000-0000-4000-8000-000000000001'),'REQUEST_TRACKED','draft has an explicit non-executed action status');
select ok((select executed_at is null from public.admin_operational_action_requests where id='e1920000-0000-4000-8000-000000000001'),'a tracked draft has no execution timestamp');
select is((select legal_name from public.organizations where id='b1810000-0000-4000-8000-000000000001'),'Delivery Test','saving a draft does not modify the organization');
select is((select count(*)from public.admin_configuration_drafts_v1 where action_request_id='e1920000-0000-4000-8000-000000000001'),1::bigint,'replay creates exactly one draft');
select is((select v->>'outcome'from observed where k='retry'),'ADMIN_ACTION_REQUEST_TRACKED','replay preserves the tracked outcome');
select is((select v->>'outcome'from observed where k='review'),'ADMIN_ACTION_REQUEST_TRACKED','capability review without role change is tracked');
select ok(not private.has_platform_role(array['SUPER_ADMIN'],'a1810000-0000-4000-8000-000000000004'),'requesting support cannot escalate the existing platform role');
select ok(not exists(select 1 from public.event_outbox where aggregate_id='e1920000-0000-4000-8000-000000000001'and event_type='AdminActionExecutedV1'),'tracking does not emit an execution event');
select*from finish();rollback;
