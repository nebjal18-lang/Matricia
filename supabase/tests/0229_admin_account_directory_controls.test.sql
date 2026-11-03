begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select no_plan();
update private.admin_execution_environment_v1 set environment='DEVELOPMENT'where singleton;
-- SQL fixtures are synthetic. No user JWT, real signature, or production
-- approval is claimed by these transactionally rolled-back contract tests.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a2290000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','account-admin-229-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,7)i;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('ff229000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','unassigned-229-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,506)i;
insert into public.user_profiles(id,display_name)values('a2290000-0000-4000-8000-000000000003','Compte sans organisation')on conflict(id)do update set display_name=excluded.display_name;
insert into public.platform_user_roles(user_id,role_code)values
('a2290000-0000-4000-8000-000000000001','SUPER_ADMIN'),
('a2290000-0000-4000-8000-000000000002','MATRICIA_ADMIN'),
('a2290000-0000-4000-8000-000000000004','MATRICIA_ADMIN'),
('a2290000-0000-4000-8000-000000000006','READ_ONLY_AUDITOR');
insert into auth.sessions(id,user_id,created_at,updated_at,aal)select extensions.gen_random_uuid(),'a2290000-0000-4000-8000-000000000003',now(),now(),'aal1'from generate_series(1,2);
create temporary table account_results(k text primary key,v jsonb);grant all on account_results to authenticated;
create function pg_temp.account_actor(i integer,p_aal text default'aal2')returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub','a2290000-0000-4000-8000-'||lpad(i::text,12,'0'),true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub','a2290000-0000-4000-8000-'||lpad(i::text,12,'0'),'role','authenticated','aal',p_aal)::text,true);
end$$;
set local role authenticated;select pg_temp.account_actor(1,'aal1');
select throws_ok($$select public.list_admin_actor_directory_v1(500,0,null)$$,'42501','ADMIN_ACTOR_DIRECTORY_DENIED','directory requires real AAL2 authority');
select pg_temp.account_actor(5);
select throws_ok($$select public.list_admin_actor_directory_v1(500,0,null)$$,'42501','ADMIN_ACTOR_DIRECTORY_DENIED','ordinary account cannot enumerate users or their security metadata');
select pg_temp.account_actor(1);
insert into account_results values('orphan',public.list_admin_actor_directory_v1(500,0,'a2290000-0000-4000-8000-000000000003'));
select is((select(v->>'total')::integer from account_results where k='orphan'),1,'an exact account with no membership has a real directory row');
select ok((select(v#>'{rows,0,membership_id}')='null'::jsonb and(v#>'{rows,0,organization_id}')='null'::jsonb and(v#>'{rows,0,organization_name}')='null'::jsonb from account_results where k='orphan'),'unassigned account uses NULLs instead of sentinel organization identifiers');
select is((select v#>>'{rows,0,display_name}'from account_results where k='orphan'),'Compte sans organisation','directory displays the person profile, not an invented organization label');
select is((select(v#>>'{rows,0,session_count}')::integer from account_results where k='orphan'),2,'orphan account session count is authoritative');
insert into account_results values('staff',public.list_admin_actor_directory_v1(500,0,'a2290000-0000-4000-8000-000000000002'));
select is((select v#>'{rows,0,roles}'from account_results where k='staff'),'[]'::jsonb,'central role is not falsely projected as an organization role');
select is((select v#>'{rows,0,platform_roles}'from account_results where k='staff'),'["MATRICIA_ADMIN"]'::jsonb,'central account with no organization exposes its actual platform role');
insert into account_results values('page',public.list_admin_actor_directory_v1(500,0,null)),('snapshot',public.get_admin_actor_directory_snapshot_v1());
select is((select count(*)from account_results r cross join jsonb_array_elements(r.v->'rows')x where r.k='snapshot'and x->>'user_id'like'ff229000-%'),506::bigint,'consistent snapshot includes all 506 accounts beyond the first page');
select is((select jsonb_array_length(v->'rows')from account_results where k='page'),500,'normal directory page retains its bounded size');
select throws_ok($$select public.list_admin_actor_directory_v1(null,0,null)$$,'22023','INVALID_ADMIN_DIRECTORY_PAGE','malformed pagination is rejected explicitly');
insert into account_results values('context',public.get_admin_account_access_v1('a2290000-0000-4000-8000-000000000003'));
select throws_ok($$select public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','REVOKE_SESSIONS',null,(select v->>'source_hash'from account_results where k='context'),'Revoke sessions for this fixture account','account229-env','PRODUCTION','fixture-production-reference')$$,'42501','ACCOUNT_ENVIRONMENT_MISMATCH','caller cannot override the trusted deployment environment');
select throws_ok($$select public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','GRANT_PLATFORM_ROLE','CLIENT_OWNER',(select v->>'source_hash'from account_results where k='context'),'Reject role of a different scope','account229-role','DEVELOPMENT',null)$$,'22023','INVALID_PLATFORM_ROLE','organization role cannot become a global platform role');
insert into account_results values('revoke',public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','REVOKE_SESSIONS',null,(select v->>'source_hash'from account_results where k='context'),'Revoke all sessions after independent review','account229-revoke','DEVELOPMENT',null));
insert into account_results values('revoke-replay',public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','REVOKE_SESSIONS',null,(select v->>'source_hash'from account_results where k='context'),'Revoke all sessions after independent review','account229-revoke','DEVELOPMENT',null));
select is((select v from account_results where k='revoke'),(select v from account_results where k='revoke-replay'),'same request key returns exactly the same durable receipt');
select throws_ok($$select public.decide_platform_account_change_v1((select(v->>'request_id')::uuid from account_results where k='revoke'),true,(select v->>'source_hash'from account_results where k='context'),'Cannot approve my own security request','DEVELOPMENT','a2290000-0000-4000-8000-000000000003')$$,'42501','ACCOUNT_INDEPENDENT_REVIEW_REQUIRED','preparer cannot approve their own account change');
select pg_temp.account_actor(6);
select throws_ok($$select public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','REVOKE_SESSIONS',null,(select v->>'source_hash'from account_results where k='context'),'Read-only cannot request security changes','account229-auditor','DEVELOPMENT',null)$$,'42501','ACCOUNT_CHANGE_REQUEST_DENIED','read-only auditor cannot mutate security');
select pg_temp.account_actor(2);
select throws_ok($$select public.decide_platform_account_change_v1((select(v->>'request_id')::uuid from account_results where k='revoke'),true,(select v->>'source_hash'from account_results where k='context'),'Review must bind the exact subject account','DEVELOPMENT','a2290000-0000-4000-8000-000000000005')$$,'22023','INVALID_ACCOUNT_REVIEW','review cannot substitute a different target user');
insert into account_results values('revoke-approved',public.decide_platform_account_change_v1((select(v->>'request_id')::uuid from account_results where k='revoke'),true,(select v->>'source_hash'from account_results where k='context'),'Independent review authorizes revocation','DEVELOPMENT','a2290000-0000-4000-8000-000000000003'));
insert into account_results values('revoke-approved-replay',public.decide_platform_account_change_v1((select(v->>'request_id')::uuid from account_results where k='revoke'),true,(select v->>'source_hash'from account_results where k='context'),'Independent review authorizes revocation','DEVELOPMENT','a2290000-0000-4000-8000-000000000003'));
select is((select(v->>'sessions_revoked')::integer from account_results where k='revoke-approved'),2,'approval actually revokes both stored sessions');
select is((select v from account_results where k='revoke-approved'),(select v from account_results where k='revoke-approved-replay'),'review retry returns the same effect receipt without executing again');
reset role;select is((select count(*)from auth.sessions where user_id='a2290000-0000-4000-8000-000000000003'),0::bigint,'no target session remains after the actual command');
set local role authenticated;select pg_temp.account_actor(1);
insert into account_results values('grant',public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','GRANT_PLATFORM_ROLE','SUPPORT_AGENT',(select public.get_admin_account_access_v1('a2290000-0000-4000-8000-000000000003')->>'source_hash'),'Grant support only with independent approval','account229-grant','DEVELOPMENT',null));
select pg_temp.account_actor(2);
insert into account_results values('grant-context',public.get_admin_account_access_v1('a2290000-0000-4000-8000-000000000003'));
select public.decide_platform_account_change_v1((select(v->>'request_id')::uuid from account_results where k='grant'),true,(select v->>'source_hash'from account_results where k='grant-context'),'Independent review of a canonical platform role','DEVELOPMENT','a2290000-0000-4000-8000-000000000003');
reset role;select ok(exists(select 1 from public.platform_user_roles where user_id='a2290000-0000-4000-8000-000000000003'and role_code='SUPPORT_AGENT'and revoked_at is null),'approved canonical platform role is actually granted');
set local role authenticated;select pg_temp.account_actor(1);
insert into account_results values('ban-context',public.get_admin_account_access_v1('a2290000-0000-4000-8000-000000000003'));
insert into account_results values('ban',public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','SUSPEND_ACCOUNT',null,(select v->>'source_hash'from account_results where k='ban-context'),'Suspend unassigned account with explicit scope','account229-ban','DEVELOPMENT',null));
select pg_temp.account_actor(2);
select public.decide_platform_account_change_v1((select(v->>'request_id')::uuid from account_results where k='ban'),true,(select v->>'source_hash'from account_results where k='ban-context'),'Independent suspension of this unassigned account','DEVELOPMENT','a2290000-0000-4000-8000-000000000003');
reset role;
select ok((select banned_until>now()from auth.users where id='a2290000-0000-4000-8000-000000000003'),'suspension uses native GoTrue account ban state');
select is((select count(*)from public.platform_user_roles where user_id='a2290000-0000-4000-8000-000000000003'and revoked_at is null),0::bigint,'suspension removes the target platform permissions immediately');
select throws_ok($$insert into public.organizations(legal_name,display_name,created_by)values('Banned account new tenant','Banned account new tenant','a2290000-0000-4000-8000-000000000003')$$,'42501','ACCOUNT_PRIVILEGE_GRANT_DENIED','cached token cannot create a new tenant for the banned account');
select throws_ok($$insert into public.platform_user_roles(user_id,role_code)values('a2290000-0000-4000-8000-000000000003','MATRICIA_ADMIN')$$,'42501','ACCOUNT_PRIVILEGE_GRANT_DENIED','a banned account cannot receive live platform roles');
set local role authenticated;select pg_temp.account_actor(1);
insert into account_results values('unblock-context',public.get_admin_account_access_v1('a2290000-0000-4000-8000-000000000003'));
insert into account_results values('unblock',public.request_platform_account_change_v1('a2290000-0000-4000-8000-000000000003','UNBLOCK_ACCOUNT',null,(select v->>'source_hash'from account_results where k='unblock-context'),'Unblock account without silently restoring roles','account229-unblock','DEVELOPMENT',null));
select pg_temp.account_actor(2);
select public.decide_platform_account_change_v1((select(v->>'request_id')::uuid from account_results where k='unblock'),true,(select v->>'source_hash'from account_results where k='unblock-context'),'Independent review permits native account unblock','DEVELOPMENT','a2290000-0000-4000-8000-000000000003');
reset role;
select is((select banned_until from auth.users where id='a2290000-0000-4000-8000-000000000003'),null::timestamptz,'unblock clears native GoTrue ban state');
select is((select count(*)from public.platform_user_roles where user_id='a2290000-0000-4000-8000-000000000003'and revoked_at is null),0::bigint,'unblock does not resurrect the previously revoked roles');
select is((select count(*)from public.event_outbox where event_type='PlatformAccountAccessChangedV1'and aggregate_id=(select v->>'request_id'from account_results where k='revoke')),1::bigint,'review retry emits exactly one effect event');
select ok(not has_table_privilege('authenticated','public.platform_account_change_decisions_v1','INSERT'),'browser cannot insert approval or execution facts directly');
select ok(not has_function_privilege('authenticated','private.platform_account_source_hash_v1(uuid)','EXECUTE'),'sensitive account fingerprint helper is not exposed as an API shortcut');
select*from finish();
rollback;
