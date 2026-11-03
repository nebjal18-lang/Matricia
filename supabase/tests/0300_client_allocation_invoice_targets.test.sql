begin;
set local search_path=public,extensions;
-- pgTAP lives in extensions; role-switch assertions need only this framework
-- schema access inside the transaction that is rolled back below.
grant usage on schema extensions to authenticated;
select plan(23);

select has_function('public','list_client_allocation_invoice_targets',array['uuid','integer'],'invoice target read command exists');
select function_privs_are('public','list_client_allocation_invoice_targets',array['uuid','integer'],'authenticated',array['EXECUTE'],'authenticated callers may reach the guarded command');
select function_privs_are('public','list_client_allocation_invoice_targets',array['uuid','integer'],'anon',array[]::text[],'anonymous callers have no command ACL');
select function_privs_are('public','list_client_allocation_invoice_targets',array['uuid','integer'],'service_role',array[]::text[],'a service client cannot bypass the Client actor guard');
select volatility_is('public','list_client_allocation_invoice_targets',array['uuid','integer'],'s','invoice targets are a stable read');
select is_definer('public','list_client_allocation_invoice_targets',array['uuid','integer'],'the bounded projection can read private sources without granting their columns');
select ok((select proconfig=array['search_path=pg_catalog'] from pg_proc where oid='public.list_client_allocation_invoice_targets(uuid,integer)'::regprocedure),'the definer fixes its search path');
select is(pg_get_function_result('public.list_client_allocation_invoice_targets(uuid,integer)'::regprocedure),'TABLE(id uuid, organization_id uuid, label_fr text, label_ar text)','the projection contains only the authorized identifier, scope and actual invoice labels');
select is((select pg_get_expr(proargdefaults,0) from pg_proc where oid='public.list_client_allocation_invoice_targets(uuid,integer)'::regprocedure),'101','the default allows one look-ahead row for the bounded selector');
select is((select array_agg(attname::text order by attname)from pg_attribute where attrelid='public.client_invoice_calendar_items'::regclass and attnum>0 and not attisdropped and has_column_privilege('authenticated','public.client_invoice_calendar_items',attname,'SELECT')),array['due_on','id','organization_id','project_id','status']::text[],'the original calendar column allowlist stays exact');

-- Synthetic SQL authorization fixtures only. These transaction-local request
-- claims test SQL guards; they do not certify a GoTrue or browser session.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values
('fa300000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','allocation300-owner@example.invalid','',now(),'{}','{}',now(),now()),
('fa300000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','allocation300-accounting@example.invalid','',now(),'{}','{}',now(),now()),
('fa300000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','allocation300-viewer@example.invalid','',now(),'{}','{}',now(),now());
insert into public.organizations(id,legal_name,display_name,status,created_by)values
('fb300000-0000-4000-8000-000000000001','Allocation 300 selected Client','Allocation 300 selected Client','ACTIVE','fa300000-0000-4000-8000-000000000001'),
('fb300000-0000-4000-8000-000000000002','Allocation 300 foreign Client','Allocation 300 foreign Client','ACTIVE','fa300000-0000-4000-8000-000000000002');
insert into public.organization_memberships(id,organization_id,user_id,status)values
('fc300000-0000-4000-8000-000000000001','fb300000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000001','ACTIVE'),
('fc300000-0000-4000-8000-000000000002','fb300000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000002','ACTIVE'),
('fc300000-0000-4000-8000-000000000003','fb300000-0000-4000-8000-000000000001','fa300000-0000-4000-8000-000000000003','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values
('fc300000-0000-4000-8000-000000000001','CLIENT_OWNER'),
('fc300000-0000-4000-8000-000000000002','CLIENT_ACCOUNTING'),
('fc300000-0000-4000-8000-000000000003','CLIENT_VIEWER');

select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
set local role authenticated;
select throws_ok($$select*from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001')$$,'42501','CLIENT_ALLOCATION_INVOICE_TARGETS_DENIED','an absent actor never receives invoice references');
reset role;

select set_config('request.jwt.claim.sub','fa300000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"fa300000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select*from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001')$$,'42501','CLIENT_ALLOCATION_INVOICE_TARGETS_DENIED','membership and AAL2 alone do not grant budget management');
reset role;

select set_config('request.jwt.claim.sub','fa300000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"fa300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select*from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000002')$$,'42501','CLIENT_ALLOCATION_INVOICE_TARGETS_DENIED','an owner of the selected Client cannot query a foreign Client');
select is((select count(*)from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001')),0::bigint,'an authorized owner receives a successful empty result when no invoice exists');
select throws_ok($$select*from public.list_client_allocation_invoice_targets(null)$$,'42501','CLIENT_ALLOCATION_INVOICE_TARGETS_DENIED','a missing organization never becomes a global invoice search');
select throws_ok($$select*from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001',null)$$,'22023','INVALID_CLIENT_ALLOCATION_TARGET_LIMIT','a null bound is rejected');
select throws_ok($$select*from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001',0)$$,'22023','INVALID_CLIENT_ALLOCATION_TARGET_LIMIT','a zero bound is rejected');
select throws_ok($$select*from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001',102)$$,'22023','INVALID_CLIENT_ALLOCATION_TARGET_LIMIT','the caller cannot expand the selector past 101');
select is((select count(*)from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001',101)),0::bigint,'the maximum allowed bound remains a successful scoped read');
select throws_ok($$select source_invoice_id from public.client_invoice_calendar_items limit 1$$,'42501',null,'calling the projection never grants its private calendar source column');
reset role;

select set_config('request.jwt.claim.sub','fa300000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"sub":"fa300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select is((select count(*)from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001',1)),0::bigint,'the existing Client accounting role can read its authorized empty scope');
reset role;

update public.organization_member_roles set revoked_at=clock_timestamp()where membership_id='fc300000-0000-4000-8000-000000000001'and role_code='CLIENT_OWNER';
select set_config('request.jwt.claim.sub','fa300000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"fa300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
set local role authenticated;
select throws_ok($$select*from public.list_client_allocation_invoice_targets('fb300000-0000-4000-8000-000000000001')$$,'42501','CLIENT_ALLOCATION_INVOICE_TARGETS_DENIED','revocation removes access even when a former owner retains a session');
reset role;
select ok(not has_table_privilege('authenticated','public.client_invoice_calendar_items','SELECT')and not has_column_privilege('authenticated','public.client_invoice_calendar_items','source_invoice_id','SELECT'),'the projection preserves table and private source-column ACLs');

select*from finish();
rollback;
