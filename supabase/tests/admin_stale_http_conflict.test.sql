begin;
set local search_path=public,extensions;
select no_plan();
grant usage on schema extensions to authenticated;
grant execute on all functions in schema extensions to authenticated;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a9231000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-conflict-'||i||'@example.invalid','',now(),'{}','{}',now(),now() from generate_series(1,2)i;
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b9231000-0000-4000-8000-000000000001','Admin conflict test','Admin conflict test','ACTIVE','a9231000-0000-4000-8000-000000000001');
insert into public.platform_user_roles(user_id,role_code)values('a9231000-0000-4000-8000-000000000001','MATRICIA_ADMIN');
-- Pending action is a test precondition; no sensitive effect is executed.
insert into public.admin_operational_action_requests(id,organization_id,action_type,target_environment,resource_type,resource_id,request_payload_hash,redacted_summary,reason,approvals_required,status,requested_by)
values('c9231000-0000-4000-8000-000000000001','b9231000-0000-4000-8000-000000000001','MANUAL_EXCEPTION','DEVELOPMENT','organization','b9231000-0000-4000-8000-000000000001',repeat('a',64),'{}','Local pending decision fixture',1,'PENDING_APPROVAL','a9231000-0000-4000-8000-000000000002');
create temporary table admin_conflict_observed(k text primary key,v jsonb);
grant select,insert on admin_conflict_observed to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub','a9231000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"a9231000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into admin_conflict_observed values('open',public.open_admin_work_item('EXCEPTIONS','b9231000-0000-4000-8000-000000000001','EXCEPTION','organization','b9231000-0000-4000-8000-000000000001','Local conflict test','Local conflict test','HIGH',clock_timestamp()+interval'1 hour','{}','Local conflict regression','admin-conflict-open'));
insert into admin_conflict_observed values('claim',public.claim_admin_work_item((select(v->>'work_item_id')::uuid from admin_conflict_observed where k='open'),1,'Local claim test','admin-conflict-claim'));
select is((select v->>'outcome'from admin_conflict_observed where k='claim'),'ADMIN_WORK_ITEM_CLAIMED','valid claim still succeeds');
select throws_ok($q$select public.claim_admin_work_item((select(v->>'work_item_id')::uuid from admin_conflict_observed where k='open'),1,'Local stale claim','admin-conflict-stale-claim')$q$,'PT409','STALE_ADMIN_WORK_ITEM','stale claim is an HTTP conflict, not retryable serialization');
select throws_ok($q$select public.resolve_admin_work_item((select(v->>'work_item_id')::uuid from admin_conflict_observed where k='open'),'COMPLETED','Local stale resolution','{}',1,'admin-conflict-stale-resolve')$q$,'PT409','STALE_ADMIN_WORK_ITEM','stale resolution is an HTTP conflict');
insert into admin_conflict_observed values('resolve',public.resolve_admin_work_item((select(v->>'work_item_id')::uuid from admin_conflict_observed where k='open'),'COMPLETED','Local correct resolution','{}',2,'admin-conflict-resolve'));
select is((select v->>'outcome'from admin_conflict_observed where k='resolve'),'ADMIN_WORK_ITEM_RESOLVED','correct resolution still succeeds');
select throws_ok($q$select public.decide_admin_operational_action('c9231000-0000-4000-8000-000000000001','REJECT','Local stale decision',99,'admin-conflict-stale-decision')$q$,'PT409','STALE_ADMIN_ACTION_REQUEST','stale sensitive decision is an HTTP conflict');
select is(public.claim_admin_work_item((select(v->>'work_item_id')::uuid from admin_conflict_observed where k='open'),1,'Local claim test','admin-conflict-claim'),(select v from admin_conflict_observed where k='claim'),'claim replay remains stable after resolution');
reset role;
select is((select count(*)from public.admin_work_item_events where work_item_id=(select(v->>'work_item_id')::uuid from admin_conflict_observed where k='open')),3::bigint,'failed commands and replay create no history duplicates');
select is((select count(*)from public.audit_events where resource_id=(select v->>'work_item_id'from admin_conflict_observed where k='open')),3::bigint,'failed commands create no audit duplicates');
select is((select status from public.admin_operational_action_requests where id='c9231000-0000-4000-8000-000000000001'),'PENDING_APPROVAL','stale decision has no sensitive effect');
select ok(not has_function_privilege('anon','public.claim_admin_work_item(uuid,integer,text,text,uuid)','EXECUTE'),'anonymous access remains denied');
select * from finish();
rollback;
