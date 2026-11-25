-- Admin Box Builder: catalogue tarifs de gros par territoire + marge plateforme versionnée.

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
