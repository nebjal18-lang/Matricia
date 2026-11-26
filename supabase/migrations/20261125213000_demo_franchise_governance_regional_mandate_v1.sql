-- Demo franchisee: drop accidental platform roles that force MFA on scoped
-- governance snapshots, and attach an ACTIVE library mandate for regional
-- franchise actors (Nour Atlas / Tanger, etc.).

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

  -- Franchise demo personas must not keep platform finance/compliance roles:
  -- those roles force AAL2 inside franchise_governance_dashboard_snapshot when
  -- called with p_franchise_id (every franchise board load path).
  update public.platform_user_roles
     set revoked_at = v_now
   where user_id = p_user_id
     and revoked_at is null
     and role_code in (
       'SUPER_ADMIN',
       'MATRICIA_ADMIN',
       'FINANCE_MANAGER',
       'COMPLIANCE_MANAGER',
       'LIBRARY_MANAGER',
       'READ_ONLY_AUDITOR'
     );

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

-- Regional actor: when persona=franchise, also attach a unique ACTIVE mandate
-- for that territory (library COM preferred). Deterministic IDs from org seed.
drop function if exists public.ensure_demo_regional_actor_v1(uuid, uuid, uuid, text, text, text, text, text);

create function public.ensure_demo_regional_actor_v1(
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
set search_path = pg_catalog, public, private, auth, extensions
as $$
declare
  v_role text;
  v_territory text;
  v_now timestamptz := clock_timestamp();
  v_from timestamptz := clock_timestamp() - interval '30 days';
  v_library_id uuid;
  v_library_code text;
  v_economic_rule_id uuid;
  v_franchise_id uuid;
  v_territory_version_id uuid;
  v_mandate_version_id uuid;
  v_catalog_mandate_id uuid;
  v_hash text;
  v_name_fr text;
  v_name_ar text;
  v_seed text;
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

  v_territory := upper(btrim(p_territory_code));
  if v_territory !~ '^[A-Z][A-Z0-9_-]{1,31}$' then
    raise exception 'INVALID_DEMO_REGIONAL_TERRITORY' using errcode = '22023';
  end if;

  v_role := case p_persona
    when 'franchise' then 'FRANCHISE_OWNER'
    when 'provider' then 'PROVIDER_OWNER'
    else 'CLIENT_OWNER'
  end;

  insert into public.organizations(id, legal_name, display_name, country_code, status, created_by)
  values (
    p_organization_id,
    coalesce(nullif(btrim(p_display_name), ''), p_email) || ' SARL',
    coalesce(nullif(btrim(p_display_name), ''), p_email),
    'MA',
    'ACTIVE',
    p_user_id
  )
  on conflict (id) do update
    set display_name = excluded.display_name,
        legal_name = excluded.legal_name,
        country_code = excluded.country_code,
        status = 'ACTIVE';

  insert into private.demo_workspace_organizations_v1(
    organization_id, persona, territory_code, slot, email
  ) values (
    p_organization_id,
    p_persona,
    v_territory,
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
            'demo_territory', v_territory,
            'demo_slot', upper(btrim(p_slot))
          )
   where id = p_user_id;

  if p_persona = 'franchise' then
    -- Same UUID scheme as apps/web/.../demo-regional-ensure.ts demoRegionalUuid.
    v_seed := 'DEMO_REGIONAL_ACTOR_V1:franchise:' || v_territory || ':' || upper(btrim(p_slot));
    v_franchise_id := (
      select (
        substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3)
        || '-8' || substr(h, 18, 3) || '-' || substr(h, 21, 12)
      )::uuid
      from encode(extensions.digest(convert_to(v_seed || ':franchise', 'UTF8'), 'sha256'), 'hex') h
    );
    v_territory_version_id := (
      select (
        substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3)
        || '-8' || substr(h, 18, 3) || '-' || substr(h, 21, 12)
      )::uuid
      from encode(extensions.digest(convert_to(v_seed || ':territory:v1', 'UTF8'), 'sha256'), 'hex') h
    );
    v_mandate_version_id := (
      select (
        substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3)
        || '-8' || substr(h, 18, 3) || '-' || substr(h, 21, 12)
      )::uuid
      from encode(extensions.digest(convert_to(v_seed || ':mandate:v1', 'UTF8'), 'sha256'), 'hex') h
    );
    v_catalog_mandate_id := (
      select (
        substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3)
        || '-8' || substr(h, 18, 3) || '-' || substr(h, 21, 12)
      )::uuid
      from encode(extensions.digest(convert_to(v_seed || ':catalog-mandate', 'UTF8'), 'sha256'), 'hex') h
    );

    select lib.id, lib.code
      into v_library_id, v_library_code
    from public.catalog_libraries lib
    where lib.code in ('COM', 'ACC', 'SALES')
      and lib.status not in ('RETIRED', 'ARCHIVED')
    order by case lib.code when 'COM' then 0 when 'ACC' then 1 else 2 end
    limit 1;

    if v_library_id is null then
      raise exception 'DEMO_REGIONAL_LIBRARY_MISSING' using errcode = 'P0001';
    end if;

    select r.id
      into v_economic_rule_id
    from public.franchise_economic_rule_versions r
    where r.franchise_type = 'STANDARD'
      and r.status = 'ACTIVE'
    order by r.version desc
    limit 1;

    if v_economic_rule_id is null then
      raise exception 'DEMO_REGIONAL_ECONOMIC_RULE_MISSING' using errcode = 'P0001';
    end if;

    v_name_fr := case v_territory
      when 'TANGER_TETOUAN_AL_HOCEIMA' then 'Tanger-Tétouan-Al Hoceïma'
      when 'ORIENTAL' then 'Oriental'
      when 'FES_MEKNES' then 'Fès-Meknès'
      when 'RABAT_SALE_KENITRA' then 'Rabat-Salé-Kénitra'
      when 'BENI_MELLAL_KHENIFRA' then 'Béni Mellal-Khénifra'
      when 'CASABLANCA_SETTAT' then 'Casablanca-Settat'
      when 'MARRAKECH_SAFI' then 'Marrakech-Safi'
      when 'DRAA_TAFILALET' then 'Drâa-Tafilalet'
      when 'SOUSS_MASSA' then 'Souss-Massa'
      when 'GUELMIM_OUED_NOUN' then 'Guelmim-Oued Noun'
      when 'LAAYOUNE_SAKIA_EL_HAMRA' then 'Laâyoune-Sakia El Hamra'
      when 'DAKHLA_OUED_ED_DAHAB' then 'Dakhla-Oued Ed-Dahab'
      else replace(v_territory, '_', '-')
    end;
    v_name_ar := case v_territory
      when 'TANGER_TETOUAN_AL_HOCEIMA' then 'طنجة تطوان الحسيمة'
      when 'ORIENTAL' then 'الشرق'
      when 'FES_MEKNES' then 'فاس مكناس'
      when 'RABAT_SALE_KENITRA' then 'الرباط سلا القنيطرة'
      when 'BENI_MELLAL_KHENIFRA' then 'بني ملال خنيفرة'
      when 'CASABLANCA_SETTAT' then 'الدار البيضاء سطات'
      when 'MARRAKECH_SAFI' then 'مراكش آسفي'
      when 'DRAA_TAFILALET' then 'درعة تافيلالت'
      when 'SOUSS_MASSA' then 'سوس ماسة'
      when 'GUELMIM_OUED_NOUN' then 'كلميم واد نون'
      when 'LAAYOUNE_SAKIA_EL_HAMRA' then 'العيون الساقية الحمراء'
      when 'DAKHLA_OUED_ED_DAHAB' then 'الداخلة وادي الذهب'
      else v_territory
    end;

    -- Never keep platform roles on regional franchise demo accounts either.
    update public.platform_user_roles
       set revoked_at = v_now
     where user_id = p_user_id
       and revoked_at is null
       and role_code in (
         'SUPER_ADMIN',
         'MATRICIA_ADMIN',
         'FINANCE_MANAGER',
         'COMPLIANCE_MANAGER',
         'LIBRARY_MANAGER',
         'READ_ONLY_AUDITOR'
       );

    insert into public.franchises(
      id, library_id, operator_organization_id, franchise_type, operator_code, territory_code, status, created_by
    ) values (
      v_franchise_id, v_library_id, p_organization_id, 'STANDARD', 'FRANCHISEE', v_territory, 'ACTIVE', p_user_id
    )
    on conflict (id) do update
      set status = 'ACTIVE',
          library_id = excluded.library_id,
          operator_organization_id = excluded.operator_organization_id,
          territory_code = excluded.territory_code,
          updated_at = v_now;

    update public.organization_member_roles
       set franchise_id = v_franchise_id,
           library_id = v_library_id,
           revoked_at = null,
           granted_by = p_user_id
     where membership_id = p_membership_id
       and role_code = 'FRANCHISE_OWNER';

    insert into public.catalog_library_mandates(
      id, library_id, organization_id, status, valid_from, policy_version, created_by
    )
    select v_catalog_mandate_id, v_library_id, p_organization_id, 'ACTIVE', v_from, 1, p_user_id
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
      v_territory_version_id,
      v_franchise_id,
      1,
      v_territory,
      v_name_fr,
      v_name_ar,
      jsonb_build_object('regions', jsonb_build_array(v_name_fr), 'origin', 'demo_regional'),
      v_from,
      encode(extensions.digest(convert_to(v_franchise_id::text || ':territory:v1', 'UTF8'), 'sha256'), 'hex'),
      p_user_id
    )
    on conflict (id) do nothing;

    if not exists (
      select 1
      from public.franchise_mandate_versions m
      where m.franchise_id = v_franchise_id
        and m.mandate_status = 'ACTIVE'
    ) then
      v_hash := encode(
        extensions.digest(
          convert_to(v_franchise_id::text || ':mandate:v1:' || v_territory_version_id::text || ':' || v_economic_rule_id::text, 'UTF8'),
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
        v_mandate_version_id,
        v_franchise_id,
        coalesce(
          (select t.id from public.franchise_territory_versions t where t.franchise_id = v_franchise_id and t.version = 1 limit 1),
          v_territory_version_id
        ),
        v_economic_rule_id,
        coalesce(
          (select max(m.version) + 1 from public.franchise_mandate_versions m where m.franchise_id = v_franchise_id),
          1
        ),
        'ACTIVE',
        jsonb_build_object('origin', 'demo_regional', 'libraryCode', v_library_code, 'territory', v_territory),
        jsonb_build_object('origin', 'demo_regional', 'obligations', jsonb_build_array('catalog_quality', 'network_followup')),
        jsonb_build_object('origin', 'demo_regional', 'mode', 'NON_CONTRACTUAL_DEMO'),
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
     where f.id = v_franchise_id;
  end if;

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'membership_id', p_membership_id,
    'role_code', v_role,
    'persona', p_persona,
    'franchise_id', v_franchise_id,
    'territory_code', v_territory
  );
end;
$$;

revoke all on function public.ensure_demo_regional_actor_v1(uuid, uuid, uuid, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.ensure_demo_regional_actor_v1(uuid, uuid, uuid, text, text, text, text, text)
  to service_role;

-- Immediate cleanup for the already-provisioned global demo franchisee.
update public.platform_user_roles r
   set revoked_at = clock_timestamp()
  from auth.users u
 where r.user_id = u.id
   and r.revoked_at is null
   and lower(u.email) = 'demo.franchise@matricia.test'
   and r.role_code in (
     'SUPER_ADMIN',
     'MATRICIA_ADMIN',
     'FINANCE_MANAGER',
     'COMPLIANCE_MANAGER',
     'LIBRARY_MANAGER',
     'READ_ONLY_AUDITOR'
   );

notify pgrst, 'reload schema';
