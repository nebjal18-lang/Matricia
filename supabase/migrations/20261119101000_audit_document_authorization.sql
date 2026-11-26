begin;

-- SEC-01: match tenant vault roles; reuse consent is not a viewer access grant.
create or replace function public.authorize_client_bound_document(p_document_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  actor uuid := auth.uid();
  document public.client_compliance_documents%rowtype;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode = '42501'; end if;
  select d.* into document
  from public.client_compliance_documents d
  where d.id = p_document_id
    and d.status = 'VERIFIED'
    and d.scan_status = 'CLEAN'
    and d.current_scan_result_id is not null
    and (d.expires_on is null or d.expires_on >= current_date)
    and private.has_org_role(d.organization_id, array['CLIENT_OWNER','CLIENT_ADMIN'], actor)
    and exists (
      select 1 from private.client_document_scan_results scan
      where scan.id = d.current_scan_result_id
        and scan.document_id = d.id
        and scan.organization_id = d.organization_id
        and scan.result = 'CLEAN'
        and scan.computed_sha256 = d.declared_sha256
    );
  if not found then raise exception 'CLIENT_DOCUMENT_DENIED' using errcode = '42501'; end if;
  insert into public.audit_events(
    organization_id, actor_user_id, actor_type, action, resource_type,
    resource_id, correlation_id, metadata, event_hash
  ) values (
    document.organization_id, actor, 'USER', 'client.document.downloaded',
    'client_compliance_document', document.id::text, extensions.gen_random_uuid(),
    jsonb_build_object('document_version', document.version), repeat('0', 64)
  );
  return jsonb_build_object(
    'outcome', 'CLIENT_DOCUMENT_AUTHORIZED',
    'document_id', document.id,
    'bucket', document.storage_bucket,
    'object_path', document.storage_object_path,
    'file_name', document.original_file_name,
    'mime_type', document.declared_mime_type,
    'size_bytes', document.declared_size_bytes
  );
end;
$$;

revoke all on function public.authorize_client_bound_document(uuid)
  from public, anon, service_role;
grant execute on function public.authorize_client_bound_document(uuid) to authenticated;


-- SEC-02: environment gate before any effect.
-- Demo-only helper: service_role can restore MATRICIA_ADMIN for the demo admin persona.
-- Prevents demo Admin login from falling back to the client dashboard (role-fallback).

create or replace function public.ensure_demo_admin_platform_role_v1(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_email text;
  v_persona text;
begin
  if not exists (select 1 from private.admin_execution_environment_v1
    where singleton and environment in ('DEVELOPMENT', 'STAGING')) then
    raise exception 'DEMO_ADMIN_ENVIRONMENT_DENIED' using errcode = '42501';
  end if;
  if auth.role() is distinct from 'service_role' then
    raise exception 'DEMO_ADMIN_ROLE_DENIED' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'INVALID_DEMO_ADMIN_USER' using errcode = '22023';
  end if;

  select u.email, coalesce(u.raw_app_meta_data ->> 'demo_persona', '')
    into v_email, v_persona
  from auth.users u
  where u.id = p_user_id
    and u.deleted_at is null
  for key share;

  if v_email is null then
    raise exception 'DEMO_ADMIN_USER_MISSING' using errcode = '22023';
  end if;

  if v_persona is distinct from 'admin'
     or lower(v_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.(test|invalid)$'
     or not exists (select 1 from auth.users u where u.id = p_user_id
       and u.raw_app_meta_data->'matricia_demo' = 'true'::jsonb) then
    raise exception 'DEMO_ADMIN_PERSONA_REQUIRED' using errcode = '42501';
  end if;

  insert into public.platform_user_roles(user_id, role_code, granted_by, revoked_at)
  values (p_user_id, 'MATRICIA_ADMIN', p_user_id, null)
  on conflict (user_id, role_code) do update
    set granted_by = excluded.granted_by,
        granted_at = clock_timestamp(),
        revoked_at = null;

  return true;
end;
$$;

revoke all on function public.ensure_demo_admin_platform_role_v1(uuid) from public, anon, authenticated;
grant execute on function public.ensure_demo_admin_platform_role_v1(uuid) to service_role;

-- SEC-02: retain the current full-workspace alias and its service-role ACL.
-- The canonical implementation retains actor/AAL2 checks for authenticated users.
create or replace function public.reset_demo_box_network_v1()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if not exists (select 1 from private.admin_execution_environment_v1
    where singleton and environment in ('DEVELOPMENT', 'STAGING')) then
    raise exception 'DEMO_BOX_RESET_ENVIRONMENT_DENIED' using errcode = '42501';
  end if;
  return public.reset_demo_workspace_v1();
end;
$$;

revoke all on function public.reset_demo_box_network_v1() from public, anon, authenticated, service_role;
grant execute on function public.reset_demo_box_network_v1() to authenticated, service_role;

commit;
