begin;
-- Territoires queue: Franchisé, Territoire, Bibliothèque, Mandat, Début, Fin, État.
-- The previous cells array inserted a duplicate version and shifted Fin into État.
create or replace function public.get_admin_territoires_queue_snapshot_v1(p_locale text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
declare
  rows jsonb;
begin
  if auth.uid() is null
    or auth.jwt()->>'aal' is distinct from 'aal2'
    or p_locale is null
    or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('territoires')
  then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb)
  into rows
  from (
    select jsonb_build_object(
      'id', v.id,
      'title', operator_label || ' · ' || territory_label,
      'status', v.mandate_status,
      'organizationId', f.operator_organization_id,
      'cells', jsonb_build_array(
        operator_label || ' · ' || territory_label,
        territory_label,
        library_label,
        'v' || v.version,
        v.effective_from::date::text,
        coalesce(v.effective_until::date::text, '—'),
        v.mandate_status
      ),
      'extras', jsonb_build_object(
        'franchiseId', f.id::text,
        'type', f.franchise_type,
        'libraryCode', l.code,
        'territoryCode', f.territory_code
      )
    ) item
    from public.franchises f
    join public.catalog_libraries l on l.id = f.library_id
    left join lateral (
      select name_fr, name_ar
      from public.catalog_library_versions
      where library_id = l.id
      order by version desc
      limit 1
    ) lv on true
    join public.franchise_mandate_versions v on v.franchise_id = f.id
    left join public.franchise_territory_versions tv on tv.id = v.territory_version_id
    cross join lateral (
      select
        case f.operator_code
          when 'HATIM_AHMITECH' then 'Hatim Ahmitech'
          when 'FRANCHISEE' then case when p_locale = 'ar' then 'صاحب امتياز' else 'Franchisé' end
          when 'NEOXA_JALIL' then 'Jalil · NEOXA'
          when 'ASMA_MATRICIA' then 'Asma · Matricia'
          else initcap(replace(regexp_replace(f.operator_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' '))
        end as operator_label,
        coalesce(
          nullif(case when p_locale = 'ar' then tv.name_ar else tv.name_fr end, ''),
          nullif(initcap(replace(regexp_replace(f.territory_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' ')), ''),
          f.territory_code
        ) as territory_label,
        coalesce(
          nullif(case when p_locale = 'ar' then lv.name_ar else lv.name_fr end, ''),
          l.code
        ) as library_label
    ) labels
    order by v.created_at desc, v.id
    limit 20001
  ) page;

  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;

  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end;
$$;

revoke all on function public.get_admin_territoires_queue_snapshot_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_territoires_queue_snapshot_v1(text) to authenticated;

do $$
declare
  definition text;
  first integer;
  last integer;
begin
  definition := pg_get_functiondef('public.get_admin_special_space_snapshot_v1(text,text)'::regprocedure);
  first := strpos(definition, 'elsif p_space=''territoires''then');
  last := strpos(definition, 'elsif p_space=''gouvernance''then');
  if first = 0 or last <= first then
    raise exception 'ADMIN_TERRITOIRES_QUEUE_DEFINITION_CHANGED';
  end if;
  execute substring(definition from 1 for first - 1)
    || 'elsif p_space=''territoires''then return public.get_admin_territoires_queue_snapshot_v1(p_locale); '
    || substring(definition from last);
end;
$$;

notify pgrst, 'reload schema';
commit;
