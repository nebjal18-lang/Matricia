-- Preserve the deployment guard after a queued invitation crosses a deployment boundary.
create or replace function private.franchise_network_active_scope_v1(p_franchise_id uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.franchises f join public.franchise_mandate_versions m on m.id=f.current_mandate_version_id and m.franchise_id=f.id
 join public.organizations o on o.id=f.operator_organization_id
 where f.id=p_franchise_id and f.status='ACTIVE' and o.status='ACTIVE' and m.mandate_status='ACTIVE' and private.franchise_activation_mode_allowed_v1(f.id)
 and m.effective_from<=statement_timestamp() and (m.effective_until is null or m.effective_until>statement_timestamp()))
$$;
revoke all on function private.franchise_network_active_scope_v1(uuid) from public,anon,authenticated,service_role;

notify pgrst,'reload schema';
