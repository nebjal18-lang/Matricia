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
     and lower(v_email) is distinct from 'demo.admin@matricia.test'
     and lower(v_email) not like 'demo.admin%@matricia.test' then
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
