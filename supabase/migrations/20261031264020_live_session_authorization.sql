begin;
-- JWT signature/expiry is necessary but not sufficient after a session has been
-- revoked. Keep authorization tied to the native GoTrue session and account.
create function private.current_auth_session_active_v1()returns boolean
language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare actor uuid:=auth.uid();session_reference text:=auth.jwt()->>'session_id';begin
 if auth.role()='service_role'then return true;end if;
 -- Database-owner maintenance and SQL contract fixtures are an explicit trusted
 -- channel. PostgREST uses authenticator and Storage uses its dedicated role;
 -- neither can obtain this exception from JWT claims or SET ROLE.
 if actor is null then return auth.role()is null and session_user in('postgres','supabase_admin');end if;
 if not exists(select 1 from auth.users where id=actor and deleted_at is null and(banned_until is null or banned_until<=statement_timestamp()))then return false;end if;
 if session_reference is null then return session_user in('postgres','supabase_admin');end if;
 if session_reference!~*'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'then return false;end if;
 return exists(select 1 from auth.sessions where id=session_reference::uuid and user_id=actor and(not_after is null or not_after>statement_timestamp()));
end$$;
revoke all on function private.current_auth_session_active_v1()from public,anon,authenticated,service_role;

-- Preserve the original helper OIDs: stored RLS expressions already refer to
-- them. Their existing organization/mandate/MFA rules remain authoritative.
do $$declare signature text;definition text;original_name text;core_name text;begin
 foreach signature in array array['private.has_org_role(uuid,text[],uuid)','private.is_active_org_member(uuid,uuid)','private.has_platform_role(text[],uuid)','private.has_franchise_role(uuid,text[],uuid)']loop
  select p.proname,pg_get_functiondef(p.oid)into original_name,definition from pg_proc p where p.oid=signature::regprocedure;
  core_name:=original_name||'_before_session_264020';
  definition:=replace(definition,'FUNCTION private.'||original_name||'(','FUNCTION private.'||core_name||'(');
  execute definition;
  execute format('revoke all on function private.%I(%s) from public,anon,authenticated,service_role',core_name,pg_get_function_identity_arguments(signature::regprocedure));
 end loop;
end$$;
create or replace function private.has_org_role(target_organization_id uuid,allowed_roles text[],target_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select private.current_auth_session_active_v1()and private.has_org_role_before_session_264020(target_organization_id,allowed_roles,target_user_id)
$$;
create or replace function private.is_active_org_member(target_organization_id uuid,target_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select private.current_auth_session_active_v1()and private.is_active_org_member_before_session_264020(target_organization_id,target_user_id)
$$;
create or replace function private.has_platform_role(allowed_roles text[],target_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select private.current_auth_session_active_v1()and private.has_platform_role_before_session_264020(allowed_roles,target_user_id)
$$;
create or replace function private.has_franchise_role(p_franchise_id uuid,p_role_codes text[],p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,private as $$
 select private.current_auth_session_active_v1()and private.has_franchise_role_before_session_264020(p_franchise_id,p_role_codes,p_actor)
$$;

-- Storage has its own SQL connections and some upload-owner policies use
-- auth.uid() directly. A restrictive policy composes with every permissive
-- object policy, including unbound uploads, without widening any file ACL.
grant execute on function private.current_auth_session_active_v1()to authenticated;
create policy storage_live_session_required_v1 on storage.objects as restrictive for all to authenticated
 using(private.current_auth_session_active_v1())with check(private.current_auth_session_active_v1());

-- Cover REST routes and self-read policies which do not use the role helpers.
-- Retain any pre-existing pre-request hook and call it under the invoking role.
create table private.auth_session_request_gate_v1(singleton boolean primary key default true check(singleton),previous_hook regprocedure);
revoke all on private.auth_session_request_gate_v1 from public,anon,authenticated,service_role;
create function public.prepare_current_auth_request_v1(p_invoking_role text)returns regprocedure language plpgsql security definer set search_path=pg_catalog,private as $$
declare previous regprocedure;begin
 if(auth.uid()is not null or auth.role()='authenticated'or p_invoking_role='authenticated')and not private.current_auth_session_active_v1()then
  raise exception'SESSION_REVOKED_OR_EXPIRED'using errcode='PT401';
 end if;
 select previous_hook into previous from private.auth_session_request_gate_v1 where singleton;return previous;
end$$;
create function public.enforce_current_auth_session_v1()returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare previous regprocedure;begin
 previous:=public.prepare_current_auth_request_v1(current_user::text);
 if previous is not null then execute format('select %s',previous);end if;
end$$;
revoke all on function public.prepare_current_auth_request_v1(text),public.enforce_current_auth_session_v1()from public,anon,authenticated,service_role;
grant execute on function public.prepare_current_auth_request_v1(text),public.enforce_current_auth_session_v1()to anon,authenticated,service_role;
do $$declare setting text;previous regprocedure;begin
 select split_part(value,'=',2)into setting from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)value
 where r.rolname='authenticator'and s.setdatabase in(0,(select oid from pg_database where datname=current_database()))and value like'pgrst.db_pre_request=%'
 order by(s.setdatabase<>0)desc limit 1;
 if nullif(setting,'')is not null and setting<>'public.enforce_current_auth_session_v1'then
  previous:=to_regprocedure(setting||'()');
  if previous is null then raise exception'PREVIOUS_REQUEST_HOOK_NOT_FOUND';end if;
 end if;
 insert into private.auth_session_request_gate_v1(singleton,previous_hook)values(true,previous);
 -- Database-specific configuration avoids changing other projects or clones
 -- that share an authenticator role on the same PostgreSQL instance.
 execute format('alter role authenticator in database %I set pgrst.db_pre_request=%L',current_database(),'public.enforce_current_auth_session_v1');
end$$;
notify pgrst,'reload config';
notify pgrst,'reload schema';
commit;
