-- =============================================================================
-- Matricia — SQL démo complet (à coller dans Supabase SQL Editor, DEV/STAGING)
-- =============================================================================
-- Contenu :
--   1) ensure_demo_admin_platform_role_v1
--   2) registre + ensure_demo_regional_actor_v1 (client / ST / franchisé)
--   3) reset_demo_workspace_v1 (+ alias reset_demo_box_network_v1)
--   4) catalogue wholesale Box (list + param marge)
--
-- Après apply :
--   select public.reset_demo_workspace_v1();   -- nettoie l’ancien démo
--
-- Les listes admin (Entreprises, Devis, film métier…) viennent de l’app
-- quand MATRICIA_DEMO_ACCESS_ENABLED=true (+ APP_ENV non prod).
-- Les raccourcis connexion créent les users via Auth + ensure_demo_regional_actor_v1.
-- =============================================================================

-- 1) Admin démo → rôle plateforme
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

-- 2) Registre + acteurs régionaux (franchise / provider / client)
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

-- 3) Reset propre (jamais PRODUCTION)
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

  update public.organization_memberships m
     set status = 'REVOKED',
         updated_at = clock_timestamp(),
         row_version = m.row_version + 1
   where m.organization_id in (select organization_id from private.demo_workspace_organizations_v1)
     and m.status = 'ACTIVE';
  get diagnostics deactivated_memberships = row_count;

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

-- 4) Wholesale Box (param marge + catalogue territorial)
create or replace function public.create_platform_parameter_version(
  p_audit_organization_id uuid,
  p_parameter_key text,
  p_value_integer bigint,
  p_change_reason text,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  a uuid := auth.uid();
  hid text;
  cached jsonb;
  result jsonb;
  vid uuid;
  ver integer;
begin
  if a is null or not private.has_platform_role(array['SUPER_ADMIN', 'MATRICIA_ADMIN', 'FINANCE_MANAGER'], a) then
    raise exception 'PLATFORM_PARAMETER_DENIED' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations where id = p_audit_organization_id and status = 'ACTIVE')
     or p_parameter_key not in (
       'DOCUMENT_EXPIRY_WARNING_DAYS',
       'VOLUME_RESERVATION_DEFAULT_TTL_HOURS',
       'CREDIT_PROMOTION_MAX_BONUS',
       'BOX_PLATFORM_MARGIN_BPS'
     )
     or p_value_integer is null or p_value_integer <= 0
     or (p_parameter_key = 'DOCUMENT_EXPIRY_WARNING_DAYS' and p_value_integer > 365)
     or (p_parameter_key = 'VOLUME_RESERVATION_DEFAULT_TTL_HOURS' and p_value_integer > 2160)
     or (p_parameter_key = 'CREDIT_PROMOTION_MAX_BONUS' and p_value_integer > 1000000)
     or (p_parameter_key = 'BOX_PLATFORM_MARGIN_BPS' and p_value_integer > 10000)
     or length(btrim(coalesce(p_change_reason, ''))) not between 10 and 500 then
    raise exception 'INVALID_PLATFORM_PARAMETER' using errcode = '22023';
  end if;
  hid := private.canonical_request_hash(jsonb_build_object('key', p_parameter_key, 'value', p_value_integer, 'reason', p_change_reason));
  cached := private.begin_credit_command(p_audit_organization_id, 'platform.parameter.draft', p_idempotency_key, hid, a);
  if cached is not null then return cached; end if;
  select coalesce(max(version), 0) + 1 into ver from public.platform_parameter_versions where parameter_key = p_parameter_key;
  insert into public.platform_parameter_versions(parameter_key, version, value_integer, status, effective_from, change_reason, content_hash, created_by)
  values (p_parameter_key, ver, p_value_integer, 'DRAFT', clock_timestamp(), btrim(p_change_reason), hid, a)
  returning id into vid;
  result := jsonb_build_object('outcome', 'PLATFORM_PARAMETER_DRAFT_CREATED', 'parameter_version_id', vid, 'version', ver, 'status', 'DRAFT');
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, event_hash)
  values (p_audit_organization_id, a, 'USER', 'admin.platform_parameter.drafted', 'platform_parameter_version', vid::text, p_correlation_id, result, repeat('0', 64));
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key)
  values (p_audit_organization_id, 'platform_parameter_version', vid::text, 'PlatformParameterDraftedV1', p_correlation_id, result, p_idempotency_key);
  perform private.finish_credit_command(p_audit_organization_id, 'platform.parameter.draft', p_idempotency_key, result);
  return result;
end
$$;

create or replace function public.list_admin_wholesale_offers_by_territory_v1(
  p_territory_code text,
  p_subject text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  actor uuid := auth.uid();
  territory text := upper(btrim(coalesce(p_territory_code, '')));
  subject text := nullif(lower(btrim(coalesce(p_subject, ''))), '');
  margin_bps integer := 1500;
  result jsonb;
begin
  if actor is null or not (
    private.credits_admin_access(actor)
    or private.volume_admin_access(actor)
    or private.has_platform_role(array['READ_ONLY_AUDITOR'], actor)
  ) then
    raise exception 'WHOLESALE_CATALOG_DENIED' using errcode = '42501';
  end if;

  if territory = '' or territory !~ '^[A-Z][A-Z0-9_-]{0,63}$' then
    raise exception 'INVALID_TERRITORY_CODE' using errcode = '22023';
  end if;

  select value_integer into margin_bps
  from public.platform_parameter_versions
  where parameter_key = 'BOX_PLATFORM_MARGIN_BPS' and status = 'ACTIVE'
  order by version desc
  limit 1;
  if margin_bps is null then
    margin_bps := 1500;
  end if;

  select jsonb_build_object(
    'generated_at', clock_timestamp(),
    'territory_code', territory,
    'subject', subject,
    'margin_bps', margin_bps,
    'margin_source', case
      when exists (
        select 1 from public.platform_parameter_versions
        where parameter_key = 'BOX_PLATFORM_MARGIN_BPS' and status = 'ACTIVE'
      ) then 'PLATFORM_PARAMETER'
      else 'DEFAULT'
    end,
    'territories', coalesce((
      select jsonb_agg(jsonb_build_object('code', code) order by code)
      from (
        select distinct upper(btrim(r.code)) as code
        from public.provider_capacity_commitments c
        cross join lateral unnest(c.region_codes) as r(code)
        where c.status = 'ACTIVE'
          and length(btrim(r.code)) > 0
        union
        select distinct upper(btrim(f.territory_code))
        from public.franchises f
        where length(btrim(coalesce(f.territory_code, ''))) > 0
      ) t
    ), '[]'::jsonb),
    'offers', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.category_code, o.sku_code, o.provider_name)
      from (
        select
          c.id::text as commitment_id,
          c.provider_organization_id::text as provider_organization_id,
          coalesce(nullif(btrim(org.display_name), ''), nullif(btrim(org.legal_name), ''), c.provider_organization_id::text) as provider_name,
          a.id::text as agreement_id,
          a.agreement_code,
          s.id::text as sku_id,
          s.code as sku_code,
          s.unit_code,
          s.unit_quantity::text as pack_quantity,
          s.currency as sku_currency,
          s.reference_cost_minor::text as reference_cost_minor,
          c.unit_price_minor::text as wholesale_unit_price_minor,
          av.currency,
          c.capacity_units::text as capacity_units,
          (c.capacity_units - c.committed_units - c.consumed_units - c.released_units)::text as remaining_units,
          c.region_codes as region_codes,
          lib.code as library_code,
          cat.code as category_code,
          coalesce(catv.name_fr, cat.code) as category_name_fr,
          coalesce(catv.name_ar, cat.code) as category_name_ar,
          coalesce(sv.name_fr, s.code) as service_name_fr,
          coalesce(sv.name_ar, s.code) as service_name_ar,
          (
            c.unit_price_minor
            + ((c.unit_price_minor * margin_bps) / 10000)
          )::text as proposed_pack_price_minor
        from public.provider_capacity_commitments c
        join public.organizations org on org.id = c.provider_organization_id
        join public.framework_agreement_versions av on av.id = c.agreement_version_id
        join public.framework_agreements a on a.id = c.agreement_id
        join public.service_skus s on s.id = a.sku_id and s.status = 'ACTIVE'
        join public.catalog_services svc on svc.id = s.service_id
        join public.catalog_libraries lib on lib.id = svc.library_id
        join public.catalog_subcategories sub on sub.id = svc.primary_subcategory_id
        join public.catalog_categories cat on cat.id = sub.category_id
        left join public.catalog_category_versions catv
          on catv.id = coalesce(cat.current_published_version_id, cat.current_draft_version_id)
        left join public.catalog_service_versions sv
          on sv.id = coalesce(svc.current_published_version_id, svc.current_draft_version_id)
        where c.status = 'ACTIVE'
          and territory = any (
            select upper(btrim(x)) from unnest(c.region_codes) as x
          )
          and (
            subject is null
            or lower(coalesce(sv.name_fr, '')) like '%' || subject || '%'
            or lower(coalesce(sv.name_ar, '')) like '%' || subject || '%'
            or lower(coalesce(catv.name_fr, '')) like '%' || subject || '%'
            or lower(coalesce(catv.name_ar, '')) like '%' || subject || '%'
            or lower(s.code) like '%' || subject || '%'
            or lower(cat.code) like '%' || subject || '%'
            or lower(a.agreement_code) like '%' || subject || '%'
          )
      ) o
    ), '[]'::jsonb)
  ) into result;

  return result;
end
$$;

revoke all on function public.list_admin_wholesale_offers_by_territory_v1(text, text) from public, anon, authenticated, service_role;
grant execute on function public.list_admin_wholesale_offers_by_territory_v1(text, text) to authenticated;

-- Nettoyage (DEV/STAGING uniquement, admin AAL2 ou service_role)
-- select public.reset_demo_workspace_v1();
