begin;
create function private.franchise_activation_mode_allowed_v1(p_franchise_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select exists(select 1 from public.franchises f where f.id=p_franchise_id and(f.activation_mode is distinct from'NON_CONTRACTUAL_DEMO'or exists(select 1 from private.admin_execution_environment_v1 e where e.singleton and e.environment in('DEVELOPMENT','STAGING'))))
$$;
revoke all on function private.franchise_activation_mode_allowed_v1(uuid)from public,anon,authenticated,service_role;
-- Preserve the function OID referenced by existing RLS policies and consumers.
do $$declare definition text;begin
 select pg_get_functiondef('private.has_franchise_role(uuid,text[],uuid)'::regprocedure)into definition;
 if strpos(definition,'select p_actor is not null and exists')=0 then raise exception'FRANCHISE_DEMO_ACCESS_PATCH_TARGET_MISSING';end if;
 definition:=replace(definition,'select p_actor is not null and exists','select p_actor is not null and private.franchise_activation_mode_allowed_v1(p_franchise_id)and exists');execute definition;
end$$;
commit;
