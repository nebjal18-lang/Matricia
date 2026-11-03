begin;
set local search_path=public,extensions;
grant usage on schema extensions to authenticated,service_role;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('a2340000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','session-gate-234-'||i||'@example.invalid','',now(),'{}','{}',now(),now()from generate_series(1,2)i;
insert into public.platform_user_roles(user_id,role_code)values('a2340000-0000-4000-8000-000000000001','MATRICIA_ADMIN');
insert into public.organizations(id,legal_name,display_name,status,created_by)values('b2340000-0000-4000-8000-000000000001','Session gate fixture','Session gate fixture','ACTIVE','a2340000-0000-4000-8000-000000000001');
insert into public.organization_memberships(id,organization_id,user_id,status)values('c2340000-0000-4000-8000-000000000001','b2340000-0000-4000-8000-000000000001','a2340000-0000-4000-8000-000000000001','ACTIVE');
insert into public.organization_member_roles(membership_id,role_code)values('c2340000-0000-4000-8000-000000000001','CLIENT_OWNER');
insert into public.credit_wallets(id,organization_id,wallet_type)values('d2340000-0000-4000-8000-000000000001','b2340000-0000-4000-8000-000000000001','CLIENT');
insert into auth.sessions(id,user_id,aal,created_at,updated_at)values
 ('e2340000-0000-4000-8000-000000000001','a2340000-0000-4000-8000-000000000001','aal2',now(),now()),
 ('e2340000-0000-4000-8000-000000000002','a2340000-0000-4000-8000-000000000002','aal2',now(),now());
-- Stored metadata tests policy behavior; actual Storage bytes and real GoTrue
-- JWT verification are exercised separately by the native revocation recipe.
insert into storage.objects(id,bucket_id,name,metadata)values('f2340000-0000-4000-8000-000000000001','delivery-proofs','a2340000-0000-4000-8000-000000000001/session-gate-unbound.pdf','{"mimetype":"application/pdf","size":100}');
create function pg_temp.session_actor(p_session text)returns void language plpgsql as $$begin
 perform set_config('request.jwt.claim.sub','a2340000-0000-4000-8000-000000000001',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub','a2340000-0000-4000-8000-000000000001','role','authenticated','aal','aal2','session_id',p_session)::text,true);
end$$;
set local role authenticated;
select pg_temp.session_actor('e2340000-0000-4000-8000-000000000001');
select lives_ok($$select public.enforce_current_auth_session_v1()$$,'a live native-session reference passes the REST request guard');
select is((select(v->>'total')::integer from public.list_admin_actor_directory_v1(10,0,'a2340000-0000-4000-8000-000000000001')v),1,'live session retains its staff authority');
select is((select count(*)from public.credit_wallets where id='d2340000-0000-4000-8000-000000000001'),1::bigint,'existing stored tenant RLS expression keeps the original helper OID and allows the live owner');
select is((select count(*)from storage.objects where id='f2340000-0000-4000-8000-000000000001'),1::bigint,'live owner can read an unbound upload under the original direct auth.uid policy');
select pg_temp.session_actor('e2340000-0000-4000-8000-000000000002');
select throws_ok($$select public.enforce_current_auth_session_v1()$$,'PT401','SESSION_REVOKED_OR_EXPIRED','a session belonging to a different identity cannot authorize this token');
select is((select count(*)from public.credit_wallets where id='d2340000-0000-4000-8000-000000000001'),0::bigint,'session identity mismatch denies the stored tenant RLS policy');
select pg_temp.session_actor('not-a-valid-session-id');
select throws_ok($$select public.enforce_current_auth_session_v1()$$,'PT401','SESSION_REVOKED_OR_EXPIRED','malformed session reference fails closed without a UUID cast error');
select pg_temp.session_actor('e2340000-0000-4000-8000-000000000001');
reset role;
update auth.sessions set not_after=now()-interval'1 minute'where id='e2340000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.enforce_current_auth_session_v1()$$,'PT401','SESSION_REVOKED_OR_EXPIRED','a session past its native not_after boundary is rejected');
reset role;update auth.sessions set not_after=null where id='e2340000-0000-4000-8000-000000000001';
create function pg_temp.previous_request_guard()returns void language plpgsql security invoker as $$begin perform set_config('matricia.previous_hook_role',current_user,true);end$$;
update private.auth_session_request_gate_v1 set previous_hook='pg_temp.previous_request_guard()'::regprocedure where singleton;
set local role authenticated;
select public.enforce_current_auth_session_v1();
select is(current_setting('matricia.previous_hook_role'),'authenticated','previous request hook is preserved under its original invoking role');
reset role;
update private.auth_session_request_gate_v1 set previous_hook=null where singleton;
delete from auth.sessions where id='e2340000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.enforce_current_auth_session_v1()$$,'PT401','SESSION_REVOKED_OR_EXPIRED','the same token reference is rejected immediately after native session deletion');
select throws_ok($$select public.prepare_current_auth_request_v1('service_role')$$,'PT401','SESSION_REVOKED_OR_EXPIRED','an input argument cannot impersonate the trusted service-role JWT');
select throws_ok($$select public.list_admin_actor_directory_v1(10,0,null)$$,'42501','ADMIN_ACTOR_DIRECTORY_DENIED','staff role helper independently denies a revoked session even without a REST hook invocation');
select is((select count(*)from public.credit_wallets where id='d2340000-0000-4000-8000-000000000001'),0::bigint,'revoked token cannot read tenant data through a pre-existing policy');
select is((select count(*)from storage.objects where id='f2340000-0000-4000-8000-000000000001'),0::bigint,'restrictive Storage policy denies the direct auth.uid owner path after revocation');
reset role;
select ok(exists(select 1 from pg_policy where polrelid='storage.objects'::regclass and polname='storage_live_session_required_v1'and not polpermissive),'the session condition composes restrictively with all object ACLs');
select ok(not has_function_privilege('authenticated','private.has_org_role_before_session_264020(uuid,text[],uuid)','EXECUTE')and not has_function_privilege('authenticated','private.has_platform_role_before_session_264020(text[],uuid)','EXECUTE'),'unwrapped authorization cores are not callable by an API role');
select ok(exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole where r.rolname='authenticator'and s.setdatabase=(select oid from pg_database where datname=current_database())and s.setconfig@>array['pgrst.db_pre_request=public.enforce_current_auth_session_v1']),'request hook configuration is bound to this database, not other projects in the cluster');
select set_config('request.jwt.claim.sub','',true);select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
select lives_ok($$select public.enforce_current_auth_session_v1()$$,'trusted background service credentials do not need an interactive user session');
reset role;
select*from finish();
rollback;
