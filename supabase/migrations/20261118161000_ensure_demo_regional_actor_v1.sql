-- Demo regional actors: attach org + membership/role for franchise / ST / client shortcuts.

create or replace function public.ensure_demo_regional_actor_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_membership_id uuid,
  p_persona text,
  p_territory_code text,
  p_slot text,
  p_email text,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
as $$
declare
  v_role text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'DEMO_REGIONAL_DENIED' using errcode = '42501';
  end if;
  if p_user_id is null
     or p_organization_id is null
     or p_membership_id is null
     or p_persona not in ('franchise', 'provider', 'client')
     or coalesce(length(btrim(p_territory_code)), 0) < 3
     or coalesce(length(btrim(p_slot)), 0) < 1
     or coalesce(length(btrim(p_email)), 0) < 5 then
    raise exception 'INVALID_DEMO_REGIONAL_ACTOR' using errcode = '22023';
  end if;

  perform 1 from auth.users where id = p_user_id and deleted_at is null for key share;
  if not found then
    raise exception 'DEMO_REGIONAL_USER_MISSING' using errcode = '22023';
  end if;

  v_role := case p_persona
    when 'franchise' then 'FRANCHISE_OWNER'
    when 'provider' then 'PROVIDER_OWNER'
    else 'CLIENT_OWNER'
  end;

  insert into public.organizations(id, legal_name, display_name, status, created_by)
  values (
    p_organization_id,
    coalesce(nullif(btrim(p_display_name), ''), p_email) || ' SARL',
    coalesce(nullif(btrim(p_display_name), ''), p_email),
    'ACTIVE',
    p_user_id
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        legal_name = excluded.legal_name,
        status = 'ACTIVE';

  insert into public.organization_memberships(id, organization_id, user_id, status, activated_at)
  values (p_membership_id, p_organization_id, p_user_id, 'ACTIVE', clock_timestamp())
  on conflict (id) do update
    set status = 'ACTIVE',
        activated_at = coalesce(public.organization_memberships.activated_at, clock_timestamp());

  insert into public.organization_member_roles(membership_id, role_code, granted_by, revoked_at)
  values (p_membership_id, v_role, p_user_id, null)
  on conflict (membership_id, role_code) do update
    set revoked_at = null,
        granted_by = excluded.granted_by;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object(
            'matricia_demo', true,
            'demo_persona', p_persona,
            'demo_territory', upper(p_territory_code),
            'demo_slot', upper(p_slot)
          )
   where id = p_user_id;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'membership_id', p_membership_id,
    'role_code', v_role,
    'persona', p_persona
  );
end;
$$;

revoke all on function public.ensure_demo_regional_actor_v1(uuid, uuid, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ensure_demo_regional_actor_v1(uuid, uuid, uuid, text, text, text, text, text) to service_role;
