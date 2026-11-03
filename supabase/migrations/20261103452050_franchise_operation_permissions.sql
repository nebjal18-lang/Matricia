-- Read UI capabilities from the same exact mandate roles as mutation guards.
-- CRM write permission is not qualification or editorial authority.
create function public.franchise_operation_permissions_v1(p_franchise_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare f public.franchises%rowtype;
begin
 if auth.uid()is null or not private.active_franchise_messaging_scope(p_franchise_id)then raise exception 'FRANCHISE_OPERATIONS_SCOPE_DENIED'using errcode='42501';end if;
 select*into f from public.franchises where id=p_franchise_id;
 return jsonb_build_object('franchiseId',f.id,'libraryId',f.library_id,
  'canDecideQualifications',private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT','FRANCHISE_PROVIDER_MANAGER']),
  'canMaintainDefinitions',private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT']),
  'canInstructDisputes',private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER','FRANCHISE_EXPERT']),
  'canProposeVolume',private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER']));
end$$;
revoke all on function public.franchise_operation_permissions_v1(uuid)from public,anon,service_role;
grant execute on function public.franchise_operation_permissions_v1(uuid)to authenticated;
