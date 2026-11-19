-- Reset démo workspace : archive l’ancien contenu démo (matricia_demo / @matricia.test / DEMO_*)
-- et enregistre les orgs régionales pour un reseed propre. Jamais en PRODUCTION.

create table if not exists private.demo_workspace_organizations_v1 (
  organization_id uuid primary key references public.organizations(id),
  persona text not null check (persona in ('franchise', 'provider', 'client', 'admin', 'legacy')),
  territory_code text,
  slot text,
  email text,
  registered_at timestamptz not null default clock_timestamp()
);

revoke all on table private.demo_workspace_organizations_v1 from public, anon, authenticated;
grant select, insert, update, delete on table private.demo_workspace_organizations_v1 to service_role;

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

  insert into private.demo_workspace_organizations_v1(
    organization_id, persona, territory_code, slot, email
  ) values (
    p_organization_id,
    p_persona,
    upper(btrim(p_territory_code)),
    upper(btrim(p_slot)),
    lower(btrim(p_email))
  )
  on conflict (organization_id) do update
    set persona = excluded.persona,
        territory_code = excluded.territory_code,
        slot = excluded.slot,
        email = excluded.email,
        registered_at = clock_timestamp();

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

-- Remplace l’ancien reset Box étroit : nettoie DEMO_* + archive toutes les orgs démo marquées.
create or replace function public.reset_demo_workspace_v1()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  env text;
  actor uuid := auth.uid();
  deleted_commitments integer := 0;
  deleted_agreements integer := 0;
  deleted_skus integer := 0;
  archived_orgs integer := 0;
  deactivated_memberships integer := 0;
begin
  select environment into env from private.admin_execution_environment_v1 where singleton;
  if env is null or env not in ('DEVELOPMENT', 'STAGING') then
    raise exception 'DEMO_WORKSPACE_RESET_ENVIRONMENT_DENIED' using errcode = '42501';
  end if;

  if auth.role() is distinct from 'service_role' then
    if actor is null or not private.credits_admin_access(actor) then
      raise exception 'DEMO_WORKSPACE_RESET_DENIED' using errcode = '42501';
    end if;
    if auth.jwt()->>'aal' is distinct from 'aal2' then
      raise exception 'DEMO_WORKSPACE_RESET_AAL2_REQUIRED' using errcode = '42501';
    end if;
  end if;

  -- 1) Artefacts Box DEMO_*
  delete from public.provider_capacity_commitments c
  using public.framework_agreements a
  where c.agreement_id = a.id
    and a.agreement_code like 'DEMO\_%' escape '\';
  get diagnostics deleted_commitments = row_count;

  delete from public.framework_agreement_versions v
  using public.framework_agreements a
  where v.agreement_id = a.id
    and a.agreement_code like 'DEMO\_%' escape '\';

  delete from public.framework_agreements
  where agreement_code like 'DEMO\_%' escape '\';
  get diagnostics deleted_agreements = row_count;

  delete from public.service_skus
  where code like 'DEMO\_%' escape '\';
  get diagnostics deleted_skus = row_count;

  -- 2) Enregistrer orgs liées aux comptes démo (@matricia.test / matricia_demo) encore hors registre
  insert into private.demo_workspace_organizations_v1(organization_id, persona, email)
  select distinct o.id,
         case
           when u.raw_app_meta_data->>'demo_persona' in ('franchise', 'provider', 'client', 'admin')
             then u.raw_app_meta_data->>'demo_persona'
           else 'legacy'
         end,
         lower(u.email)
  from public.organizations o
  join public.organization_memberships m on m.organization_id = o.id
  join auth.users u on u.id = m.user_id
  where o.status in ('PENDING', 'ACTIVE', 'SUSPENDED')
    and (
      lower(coalesce(u.raw_app_meta_data->>'matricia_demo', '')) in ('true', 't', '1')
      or lower(u.email) like 'demo.%@matricia.test'
      or lower(u.email) like '%@matricia.test'
    )
  on conflict (organization_id) do nothing;

  -- 3) Révoquer memberships des orgs démo
  update public.organization_memberships m
     set status = 'REVOKED',
         updated_at = clock_timestamp(),
         row_version = m.row_version + 1
   where m.organization_id in (select organization_id from private.demo_workspace_organizations_v1)
     and m.status = 'ACTIVE';
  get diagnostics deactivated_memberships = row_count;

  -- 4) Archiver les organisations démo (plus visibles dans la supervision ACTIVE)
  update public.organizations o
     set status = 'ARCHIVED',
         updated_at = clock_timestamp(),
         row_version = o.row_version + 1
   where o.id in (select organization_id from private.demo_workspace_organizations_v1)
     and o.status is distinct from 'ARCHIVED';
  get diagnostics archived_orgs = row_count;

  return jsonb_build_object(
    'outcome', 'DEMO_WORKSPACE_RESET',
    'deleted_commitments', deleted_commitments,
    'deleted_agreements', deleted_agreements,
    'deleted_skus', deleted_skus,
    'archived_organizations', archived_orgs,
    'deactivated_memberships', deactivated_memberships
  );
end;
$$;

revoke all on function public.reset_demo_workspace_v1() from public, anon, authenticated, service_role;
grant execute on function public.reset_demo_workspace_v1() to authenticated, service_role;

-- Alias : l’ancien reset Box appelle le reset workspace complet.
create or replace function public.reset_demo_box_network_v1()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  return public.reset_demo_workspace_v1();
end;
$$;

revoke all on function public.reset_demo_box_network_v1() from public, anon, authenticated, service_role;
grant execute on function public.reset_demo_box_network_v1() to authenticated, service_role;
