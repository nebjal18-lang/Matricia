-- Demo-only: attach an ACTIVE STANDARD franchise mandate + catalog ACL for the
-- global franchise persona. Mirrors scripts/provision-demo-franchise-persona.mjs
-- so "Connexion automatique → Franchisé" self-heals after workspace reset.

create or replace function public.ensure_demo_franchise_persona_v1(
  p_user_id uuid,
  p_organization_id uuid,
  p_membership_id uuid,
  p_franchise_id uuid,
  p_territory_version_id uuid,
  p_mandate_version_id uuid,
  p_catalog_mandate_id uuid,
  p_email text,
  p_display_name text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  v_email text;
  v_persona text;
  v_library_id uuid;
  v_library_code text;
  v_economic_rule_id uuid;
  v_now timestamptz := clock_timestamp();
  v_from timestamptz := clock_timestamp() - interval '30 days';
  v_hash text;
  v_label text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'DEMO_FRANCHISE_DENIED' using errcode = '42501';
  end if;
  if p_user_id is null
     or p_organization_id is null
     or p_membership_id is null
     or p_franchise_id is null
     or p_territory_version_id is null
     or p_mandate_version_id is null
     or p_catalog_mandate_id is null
     or coalesce(length(btrim(p_email)), 0) < 5 then
    raise exception 'INVALID_DEMO_FRANCHISE_PERSONA' using errcode = '22023';
  end if;

  select u.email, coalesce(u.raw_app_meta_data ->> 'demo_persona', '')
    into v_email, v_persona
  from auth.users u
  where u.id = p_user_id
    and u.deleted_at is null
  for key share;

  if v_email is null then
    raise exception 'DEMO_FRANCHISE_USER_MISSING' using errcode = '22023';
  end if;

  if v_persona is distinct from 'franchise'
     and lower(v_email) is distinct from 'demo.franchise@matricia.test'
     and lower(v_email) not like 'demo.franchise%@matricia.test' then
    raise exception 'DEMO_FRANCHISE_PERSONA_REQUIRED' using errcode = '42501';
  end if;

  if lower(btrim(p_email)) is distinct from lower(v_email) then
    raise exception 'DEMO_FRANCHISE_EMAIL_MISMATCH' using errcode = '22023';
  end if;

  select lib.id, lib.code
    into v_library_id, v_library_code
  from public.catalog_libraries lib
  where lib.code in ('COM', 'ACC', 'SALES')
    and lib.status not in ('RETIRED', 'ARCHIVED')
  order by case lib.code when 'COM' then 0 when 'ACC' then 1 else 2 end
  limit 1;

  if v_library_id is null then
    raise exception 'DEMO_FRANCHISE_LIBRARY_MISSING' using errcode = 'P0001';
  end if;

  select r.id
    into v_economic_rule_id
  from public.franchise_economic_rule_versions r
  where r.franchise_type = 'STANDARD'
    and r.status = 'ACTIVE'
  order by r.version desc
  limit 1;

  if v_economic_rule_id is null then
    raise exception 'DEMO_FRANCHISE_ECONOMIC_RULE_MISSING' using errcode = 'P0001';
  end if;

  v_label := coalesce(nullif(btrim(p_display_name), ''), 'Franchisé · Démo Matricia');

  insert into public.organizations(id, legal_name, display_name, country_code, status, created_by)
  values (
    p_organization_id,
    'Franchisé Démo Matricia',
    v_label,
    'MA',
    'ACTIVE',
    p_user_id
  )
  on conflict (id) do update
    set legal_name = excluded.legal_name,
        display_name = excluded.display_name,
        country_code = excluded.country_code,
        status = 'ACTIVE';

  insert into public.organization_memberships(id, organization_id, user_id, status, activated_at)
  values (p_membership_id, p_organization_id, p_user_id, 'ACTIVE', v_now)
  on conflict (id) do update
    set user_id = excluded.user_id,
        organization_id = excluded.organization_id,
        status = 'ACTIVE',
        activated_at = coalesce(public.organization_memberships.activated_at, v_now);

  insert into public.franchises(
    id, library_id, operator_organization_id, franchise_type, operator_code, territory_code, status, created_by
  ) values (
    p_franchise_id, v_library_id, p_organization_id, 'STANDARD', 'FRANCHISEE', 'SOUSS', 'ACTIVE', p_user_id
  )
  on conflict (id) do update
    set status = 'ACTIVE',
        library_id = excluded.library_id,
        operator_organization_id = excluded.operator_organization_id,
        territory_code = excluded.territory_code,
        updated_at = v_now;

  insert into public.organization_member_roles(
    membership_id, role_code, franchise_id, library_id, granted_by, revoked_at
  ) values (
    p_membership_id, 'FRANCHISE_OWNER', p_franchise_id, v_library_id, p_user_id, null
  )
  on conflict (membership_id, role_code) do update
    set franchise_id = excluded.franchise_id,
        library_id = excluded.library_id,
        granted_by = excluded.granted_by,
        revoked_at = null;

  insert into public.catalog_library_mandates(
    id, library_id, organization_id, status, valid_from, policy_version, created_by
  )
  select p_catalog_mandate_id, v_library_id, p_organization_id, 'ACTIVE', v_from, 1, p_user_id
  where not exists (
    select 1
    from public.catalog_library_mandates m
    where m.library_id = v_library_id
      and m.organization_id = p_organization_id
      and m.status = 'ACTIVE'
  );

  insert into public.franchise_territory_versions(
    id, franchise_id, version, territory_code, name_fr, name_ar, scope_snapshot, effective_from, content_hash, created_by
  ) values (
    p_territory_version_id,
    p_franchise_id,
    1,
    'SOUSS',
    'Souss-Massa (démo)',
    'سوس ماسة (تجريبي)',
    jsonb_build_object('regions', jsonb_build_array('Souss-Massa'), 'origin', 'demo'),
    v_from,
    encode(extensions.digest(convert_to(p_franchise_id::text || ':territory:v1', 'UTF8'), 'sha256'), 'hex'),
    p_user_id
  )
  on conflict (id) do nothing;

  -- Mandates are append-only / immutable. Never UPDATE an existing version.
  if not exists (
    select 1
    from public.franchise_mandate_versions m
    where m.franchise_id = p_franchise_id
      and m.mandate_status = 'ACTIVE'
  ) then
    v_hash := encode(
      extensions.digest(
        convert_to(p_franchise_id::text || ':mandate:v1:' || p_territory_version_id::text || ':' || v_economic_rule_id::text, 'UTF8'),
        'sha256'
      ),
      'hex'
    );

    insert into public.franchise_mandate_versions(
      id, franchise_id, territory_version_id, economic_rule_version_id, version, mandate_status,
      rights_snapshot, obligations_snapshot, contract_snapshot,
      entry_fee_minor, entry_fee_mode, entry_fee_term_months,
      franchisee_share_bps, neoxa_share_bps, matricia_share_bps, distribution_basis,
      effective_from, content_hash, created_by
    ) values (
      p_mandate_version_id,
      p_franchise_id,
      coalesce(
        (select t.id from public.franchise_territory_versions t where t.franchise_id = p_franchise_id and t.version = 1 limit 1),
        p_territory_version_id
      ),
      v_economic_rule_id,
      coalesce(
        (select max(m.version) + 1 from public.franchise_mandate_versions m where m.franchise_id = p_franchise_id),
        1
      ),
      'ACTIVE',
      jsonb_build_object('origin', 'demo', 'libraryCode', v_library_code),
      jsonb_build_object('origin', 'demo', 'obligations', jsonb_build_array('catalog_quality', 'network_followup')),
      jsonb_build_object('origin', 'demo', 'mode', 'CONTRACTUAL'),
      0, 'EXEMPT', 0,
      5000, 2500, 2500, 'DISTRIBUTABLE_PROFIT',
      v_from, v_hash, p_user_id
    )
    on conflict (id) do nothing;
  end if;

  update public.franchises f
     set current_mandate_version_id = coalesce(
           (select m.id
              from public.franchise_mandate_versions m
             where m.franchise_id = f.id
               and m.mandate_status = 'ACTIVE'
             order by m.version desc
             limit 1),
           f.current_mandate_version_id
         ),
         status = 'ACTIVE',
         updated_at = v_now
   where f.id = p_franchise_id;

  if to_regclass('private.demo_workspace_organizations_v1') is not null then
    insert into private.demo_workspace_organizations_v1(
      organization_id, persona, territory_code, slot, email
    ) values (
      p_organization_id, 'franchise', 'SOUSS', 'GLOBAL', lower(btrim(p_email))
    )
    on conflict (organization_id) do update
      set persona = excluded.persona,
          territory_code = excluded.territory_code,
          slot = excluded.slot,
          email = excluded.email;
  end if;

  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('matricia_demo', true, 'demo_persona', 'franchise')
   where id = p_user_id;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'franchise_id', p_franchise_id,
    'library_id', v_library_id,
    'library_code', v_library_code,
    'mandate_version_id', (
      select m.id
      from public.franchise_mandate_versions m
      where m.franchise_id = p_franchise_id
        and m.mandate_status = 'ACTIVE'
      order by m.version desc
      limit 1
    )
  );
end;
$$;

revoke all on function public.ensure_demo_franchise_persona_v1(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.ensure_demo_franchise_persona_v1(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, text)
  to service_role;

notify pgrst, 'reload schema';
