begin;
-- These two projection functions run as the caller so mission RLS applies.
-- Their boolean permission check must itself be executable without exposing
-- the general actor-parameter role helper to API roles.
create function public.provider_mission_query_access_v1(p_organization_id uuid)returns boolean
language sql stable security definer set search_path=pg_catalog,private as $$
 select auth.uid()is not null and private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_TECHNICIAN','PROVIDER_VIEWER','PROVIDER_SALES','PROVIDER_ACCOUNTING'],auth.uid())
$$;
revoke all on function public.provider_mission_query_access_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.provider_mission_query_access_v1(uuid)to authenticated;
do $patch$declare sig text;body text;needle text:='auth.uid()is null or not private.has_org_role(p_organization_id,array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN'',''PROVIDER_VIEWER'',''PROVIDER_SALES'',''PROVIDER_ACCOUNTING''],auth.uid())';begin
 foreach sig in array array['public.search_provider_missions_v1(uuid,text,integer)','public.get_provider_mission_counts_v1(uuid)']loop
  body:=pg_get_functiondef(sig::regprocedure);if position(needle in body)=0 then raise exception'MISSION_QUERY_AUTHORIZATION_SOURCE_DRIFT:%',sig;end if;
  execute replace(body,needle,'not public.provider_mission_query_access_v1(p_organization_id)');
 end loop;
end$patch$;
notify pgrst,'reload schema';
commit;
