begin;
-- Infrastructure owner supplies this explicit platform-controller scope only
-- after receiving the real legal approval. No client organization is inferred.
create table private.platform_privacy_deployment_scope_v1(singleton boolean primary key default true check(singleton),controller_organization_id uuid references public.organizations(id),legal_approval_reference text,configured_at timestamptz,check((controller_organization_id is null)=(legal_approval_reference is null)),check(legal_approval_reference is null or length(btrim(legal_approval_reference))between 8 and 500));
insert into private.platform_privacy_deployment_scope_v1(singleton)values(true);
revoke all on private.platform_privacy_deployment_scope_v1 from public,anon,authenticated,service_role;
-- Reuse the exact existing registry checks without an actor-dependent gate.
do $$declare body text;first_pos integer;last_pos integer;begin
 select prosrc into body from pg_proc where oid='public.assert_privacy_production_ready(uuid)'::regprocedure;
 first_pos:=strpos(body,'if auth.jwt()');last_pos:=strpos(substring(body from first_pos),'end if;');
 if first_pos=0 or last_pos=0 or strpos(substring(body from first_pos for last_pos),'PRIVACY_PRODUCTION_GATE_DENIED')=0 then raise exception'PRIVACY_PURE_GATE_PATCH_TARGET_NOT_FOUND';end if;
 body:=substring(body from 1 for first_pos-1)||substring(body from first_pos+last_pos+length('end if;')-1);
 execute format('create function private.assert_privacy_registry_ready_v1(p_organization_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,private as %L',body);
end$$;
revoke all on function private.assert_privacy_registry_ready_v1(uuid)from public,anon,authenticated,service_role;
create or replace function public.assert_privacy_production_ready(p_organization_id uuid)returns boolean language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.jwt()->>'aal'is distinct from'aal2'or not private.privacy_manage_access(p_organization_id)then raise exception'PRIVACY_PRODUCTION_GATE_DENIED'using errcode='42501';end if;
 return private.assert_privacy_registry_ready_v1(p_organization_id);
end$$;
create function public.check_platform_privacy_readiness_v1(p_environment text)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare environment text;s private.platform_privacy_deployment_scope_v1%rowtype;ready boolean:=false;reason text;
begin
 if auth.role()is distinct from'service_role'then raise exception'PLATFORM_PRIVACY_READINESS_DENIED'using errcode='42501';end if;
 select e.environment into environment from private.admin_execution_environment_v1 e where singleton;
 if p_environment not in('DEVELOPMENT','STAGING','PRODUCTION')or environment is distinct from p_environment then raise exception'ADMIN_DEPLOYMENT_ENVIRONMENT_MISMATCH'using errcode='42501';end if;
 select*into s from private.platform_privacy_deployment_scope_v1 where singleton;
 if s.controller_organization_id is null or length(btrim(coalesce(s.legal_approval_reference,'')))<8 then reason:='PLATFORM_PRIVACY_CONTROLLER_SCOPE_UNCONFIGURED';
 else
  begin ready:=private.assert_privacy_registry_ready_v1(s.controller_organization_id);exception when sqlstate'55000'then reason:='PLATFORM_PRIVACY_REGISTER_BLOCKED';end;
 end if;
 if environment='PRODUCTION'and not ready then raise exception'PLATFORM_PRIVACY_PRODUCTION_NOT_READY'using errcode='55000';end if;
 return jsonb_build_object('environment',environment,'required',environment='PRODUCTION','ready',ready,'reason',reason);
end$$;
revoke all on function public.check_platform_privacy_readiness_v1(text)from public,anon,authenticated,service_role;
grant execute on function public.check_platform_privacy_readiness_v1(text)to service_role;
notify pgrst,'reload schema';
commit;
