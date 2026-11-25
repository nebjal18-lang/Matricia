begin;

-- Display-only profile context for ADM identity review UI.
-- Kept outside identity_snapshot so canonical identity_hash stays stable.
create or replace function public.get_client_identity_review_context_v1(p_compliance_case_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  c public.client_compliance_cases%rowtype;
  o public.organizations%rowtype;
  p public.client_profile_versions%rowtype;
  s jsonb;
  display jsonb;
begin
  if auth.uid() is null
     or auth.jwt()->>'aal' is distinct from 'aal2'
     or not private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'COMPLIANCE_MANAGER', 'READ_ONLY_AUDITOR']) then
    raise exception 'CLIENT_IDENTITY_REVIEW_DENIED' using errcode = '42501';
  end if;

  select * into c from public.client_compliance_cases where id = p_compliance_case_id;
  if c.id is null then
    raise exception 'COMPLIANCE_CASE_NOT_FOUND' using errcode = 'P0002';
  end if;

  s := private.client_canonical_identity_review_snapshot_v1(c.id);
  if s is null then
    raise exception 'CLIENT_IDENTITY_PROFILE_REQUIRED' using errcode = '55000';
  end if;

  select * into o from public.organizations where id = c.organization_id;
  select * into p from public.client_profile_versions
  where compliance_case_id = c.id and version = c.current_profile_version;

  display := jsonb_build_object(
    'display_name', coalesce(o.display_name, o.legal_name),
    'legal_form', nullif(btrim(coalesce(p.profile_data->>'legal_form', '')), ''),
    'incorporation_date', nullif(btrim(coalesce(p.profile_data->>'incorporation_date', '')), ''),
    'activity', nullif(btrim(coalesce(p.profile_data->>'activity', '')), ''),
    'sector', nullif(btrim(coalesce(p.profile_data->>'sector', '')), ''),
    'registered_city', nullif(btrim(coalesce(p.profile_data->>'registered_city', '')), ''),
    'registered_address', coalesce(p.profile_data->'registered_address', '{}'::jsonb),
    'representative', coalesce(p.profile_data->'representative', '{}'::jsonb),
    'can_mutate', private.has_platform_role(
      array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'COMPLIANCE_MANAGER']
    )
  );

  return jsonb_build_object(
    'compliance_case_id', c.id,
    'organization_id', c.organization_id,
    'case_row_version', c.row_version,
    'profile_version', c.current_profile_version,
    'status', c.status,
    'identity_snapshot', s,
    'identity_hash', private.canonical_request_hash(s),
    'created_by', c.created_by,
    'profile_display', display
  );
end;
$$;

revoke all on function public.get_client_identity_review_context_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_client_identity_review_context_v1(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
