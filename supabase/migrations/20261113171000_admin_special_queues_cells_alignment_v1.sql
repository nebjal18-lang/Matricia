begin;
-- Align special admin queues on catalog data columns (no shifted status / raw dump).

create or replace function public.get_admin_provider_queue_snapshot_v1(p_locale text) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public as $$
declare profile_ids uuid[]; names jsonb; rows jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_locale is null or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('providers') then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  profile_ids := array(select provider_organization_id from public.provider_profiles order by updated_at desc, provider_organization_id limit 20001);
  if cardinality(profile_ids) > 20000 then raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000'; end if;
  names := public.list_admin_provider_organization_names_v1(profile_ids);
  if jsonb_typeof(names->'organizations') is distinct from 'array' then raise exception 'INVALID_ADMIN_PROVIDER_NAMES' using errcode = '55000'; end if;
  if jsonb_array_length(names->'organizations') <> cardinality(profile_ids)
    or exists(select 1 from unnest(profile_ids) id where not exists(select 1 from jsonb_array_elements(names->'organizations') n where n->>'id' = id::text)) then
    raise exception 'INVALID_ADMIN_PROVIDER_NAMES' using errcode = '55000';
  end if;
  select coalesce(jsonb_agg(item order by updated_at desc, organization_id), '[]'::jsonb) into rows from (
    select p.updated_at, p.provider_organization_id organization_id, jsonb_build_object(
      'id', p.provider_organization_id,
      'title', o.display_name,
      'status', p.overall_status,
      'organizationId', p.provider_organization_id,
      'cells', jsonb_build_array(
        o.display_name,
        coalesce((select s.code from public.provider_services ps join public.catalog_services s on s.id = ps.service_id where ps.provider_organization_id = p.provider_organization_id order by ps.updated_at desc, ps.id limit 1), '—'),
        p.overall_status,
        p.company_status,
        (select count(*)::text from public.provider_document_versions d where d.provider_organization_id = p.provider_organization_id),
        '—'
      ),
      'extras', jsonb_build_object('rowVersion', p.row_version::text, 'partner', p.partner_contract_status)
    ) item
    from public.provider_profiles p
    join jsonb_to_recordset(names->'organizations') as o(id uuid, display_name text) on o.id = p.provider_organization_id
    where p.provider_organization_id = any (profile_ids)
  ) page;
  if jsonb_array_length(rows) <> cardinality(profile_ids) then raise exception 'INVALID_ADMIN_PROVIDER_NAMES' using errcode = '55000'; end if;
  if octet_length(rows::text) > 16777216 then raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000'; end if;
  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end$$;

create or replace function public.get_admin_capacite_queue_snapshot_v1(p_locale text) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public, private as $$
declare rows jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_locale is null or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('capacite') then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(item), '[]'::jsonb) into rows from (
    select jsonb_build_object(
      'id', d.id,
      'title', o.display_name || ' · ' || f.code,
      'status', d.status,
      'organizationId', o.id,
      'cells', jsonb_build_array(
        o.display_name,
        f.code,
        d.status,
        '—',
        '—',
        f.document_kind || ' v' || d.version_number,
        coalesce(d.expires_on::text, '—')
      ),
      'extras', jsonb_build_object(
        'kind', f.document_kind,
        'version', d.version_number::text,
        'statusCodes', case
          when d.expires_on < current_date then 'EXPIRED'
          when d.expires_on <= current_date + 30 then 'EXPIRING'
          else ''
        end
      )
    ) item
    from public.provider_document_versions d
    join public.provider_document_families f on f.id = d.family_id
    join public.organizations o on o.id = d.provider_organization_id
    order by d.created_at desc, d.id
    limit 20001
  ) page;
  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;
  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end$$;

create or replace function public.get_admin_franchises_queue_snapshot_v1(p_locale text) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public, private as $$
declare rows jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_locale is null or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('franchises') then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(item), '[]'::jsonb) into rows from (
    select jsonb_build_object(
      'id', f.id,
      'title', operator_label || ' · ' || territory_label,
      'status', f.status,
      'organizationId', f.operator_organization_id,
      'cells', jsonb_build_array(
        operator_label || ' · ' || territory_label,
        library_label,
        territory_label,
        coalesce('v' || v.version, '—'),
        coalesce(v.mandate_status, '—'),
        case when f.franchise_type = 'IT' then 'IT' when p_locale = 'ar' then 'قياسي' else 'Standard' end,
        case when f.status = 'ACTIVE' then '—' when p_locale = 'ar' then 'متابعة مطلوبة' else 'Suivi requis' end,
        f.status
      ),
      'extras', jsonb_build_object('mandateId', coalesce(v.id::text, ''), 'type', f.franchise_type)
    ) item
    from public.franchises f
    join public.catalog_libraries l on l.id = f.library_id
    left join lateral (
      select name_fr, name_ar from public.catalog_library_versions where library_id = l.id order by version desc limit 1
    ) lv on true
    left join public.franchise_mandate_versions v on v.id = f.current_mandate_version_id
    left join public.franchise_territory_versions tv on tv.id = v.territory_version_id
    cross join lateral (
      select
        case f.operator_code
          when 'HATIM_AHMITECH' then 'Hatim Ahmitech'
          when 'FRANCHISEE' then case when p_locale = 'ar' then 'صاحب امتياز' else 'Franchisé' end
          else initcap(replace(regexp_replace(f.operator_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' '))
        end as operator_label,
        coalesce(
          nullif(case when p_locale = 'ar' then tv.name_ar else tv.name_fr end, ''),
          nullif(initcap(replace(regexp_replace(f.territory_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' ')), ''),
          f.territory_code
        ) as territory_label,
        coalesce(nullif(case when p_locale = 'ar' then lv.name_ar else lv.name_fr end, ''), l.code) as library_label
    ) labels
    order by f.created_at desc, f.id
    limit 20001
  ) page;
  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;
  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end$$;

create or replace function public.get_admin_qualification_queue_snapshot_v1(p_locale text) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public, private as $$
declare rows jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_locale is null or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('qualification') then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(item), '[]'::jsonb) into rows from (
    select jsonb_build_object(
      'id', coalesce(q.id, s.id),
      'title', o.display_name,
      'status', coalesce(d.status, 'NOT_REQUESTED'),
      'organizationId', o.id,
      'cells', jsonb_build_array(
        o.display_name,
        c.code,
        '—',
        case when coalesce((e.value->>'eligible')::boolean, false)
          then case when p_locale = 'ar' then 'مؤهل' else 'éligible' end
          else case when p_locale = 'ar' then 'غير مؤهل' else 'non éligible' end
        end,
        coalesce(d.status, 'NOT_REQUESTED'),
        coalesce(e.value->'reasons'->>0, '—')
      ),
      'extras', jsonb_build_object('serviceId', s.id::text, 'rowVersion', coalesce(q.row_version, 1)::text)
    ) item
    from public.provider_services s
    join public.organizations o on o.id = s.provider_organization_id
    join public.catalog_services c on c.id = s.service_id
    left join public.provider_qualifications q on q.provider_service_id = s.id
    left join public.provider_qualification_decisions d on d.id = q.current_decision_id
    cross join lateral (
      select case
        when public.admin_special_space_snapshot_access_v1('QUALIFICATION_ELIGIBILITY')
          then public.explain_provider_service_eligibility(o.id, s.service_id)
        else jsonb_build_object('eligible', false, 'reasons', jsonb_build_array('ELIGIBILITY_UNAVAILABLE'))
      end value
    ) e
    order by s.updated_at desc, s.id
    limit 20001
  ) page;
  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;
  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end$$;

create or replace function public.get_admin_gouvernance_queue_snapshot_v1(p_locale text) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public, private as $$
declare rows jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_locale is null or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('gouvernance') then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(item), '[]'::jsonb) into rows from (
    select jsonb_build_object(
      'id', r.id,
      'title', r.request_type,
      'status', r.status,
      'organizationId', f.operator_organization_id,
      'cells', jsonb_build_array(
        left(r.id::text, 8),
        operator_label || ' · ' || territory_label,
        r.request_type,
        territory_label,
        r.row_version::text,
        '—',
        r.status,
        coalesce(d.decision, '—')
      ),
      'extras', jsonb_build_object('rowVersion', r.row_version::text, 'reason', r.change_reason)
    ) item
    from public.franchise_approval_requests r
    join public.franchises f on f.id = r.franchise_id
    left join public.franchise_mandate_versions v on v.id = r.mandate_version_id
    left join public.franchise_territory_versions tv on tv.id = v.territory_version_id
    left join public.franchise_approval_decisions d on d.approval_request_id = r.id
    cross join lateral (
      select
        case f.operator_code
          when 'HATIM_AHMITECH' then 'Hatim Ahmitech'
          when 'FRANCHISEE' then case when p_locale = 'ar' then 'صاحب امتياز' else 'Franchisé' end
          else initcap(replace(f.operator_code, '_', ' '))
        end as operator_label,
        coalesce(
          nullif(case when p_locale = 'ar' then tv.name_ar else tv.name_fr end, ''),
          nullif(initcap(replace(regexp_replace(f.territory_code, '(^|[_[:space:]-])E2E(?=$|[_[:space:]-])', '\1', 'gi'), '_', ' ')), ''),
          f.territory_code
        ) as territory_label
    ) labels
    order by r.requested_at desc, r.id
    limit 20001
  ) page;
  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;
  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end$$;

create or replace function public.get_admin_litiges_queue_snapshot_v1(p_locale text) returns jsonb
language plpgsql stable security invoker set search_path = pg_catalog, public, private as $$
declare rows jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'aal' is distinct from 'aal2' or p_locale is null or p_locale not in ('fr', 'ar')
    or not public.admin_special_space_snapshot_access_v1('litiges') then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(item), '[]'::jsonb) into rows from (
    select jsonb_build_object(
      'id', c.id,
      'title', initcap(replace(c.obligation_key, '_', ' ')),
      'status', c.status,
      'organizationId', c.client_organization_id,
      'cells', jsonb_build_array(
        left(c.id::text, 8),
        left(c.mission_id::text, 8),
        '—',
        initcap(replace(c.obligation_key, '_', ' ')),
        coalesce(cardinality(d.evidence_ids)::text, '—'),
        '—',
        coalesce(r.status, '—'),
        coalesce(d.outcome, '—'),
        c.status
      ),
      'extras', jsonb_build_object(
        'missionId', c.mission_id::text,
        'policy', coalesce(c.policy_snapshot->>'version', '—'),
        'statusCodes', coalesce(r.status, '')
      )
    ) item
    from public.dispute_cases c
    left join lateral (
      select * from public.dispute_decisions where dispute_case_id = c.id order by decision_number desc limit 1
    ) d on true
    left join public.mission_reassignments r on r.dispute_case_id = c.id
    order by c.opened_at desc, c.id
    limit 20001
  ) page;
  if jsonb_array_length(rows) > 20000 or octet_length(rows::text) > 16777216 then
    raise exception 'ADMIN_EXPORT_SNAPSHOT_BUDGET_EXCEEDED' using errcode = '54000';
  end if;
  return jsonb_build_object('rows', rows, 'snapshotAt', statement_timestamp(), 'complete', true);
end$$;

revoke all on function public.get_admin_provider_queue_snapshot_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_provider_queue_snapshot_v1(text) to authenticated;
revoke all on function public.get_admin_capacite_queue_snapshot_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_capacite_queue_snapshot_v1(text) to authenticated;
revoke all on function public.get_admin_franchises_queue_snapshot_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_franchises_queue_snapshot_v1(text) to authenticated;
revoke all on function public.get_admin_qualification_queue_snapshot_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_qualification_queue_snapshot_v1(text) to authenticated;
revoke all on function public.get_admin_gouvernance_queue_snapshot_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_gouvernance_queue_snapshot_v1(text) to authenticated;
revoke all on function public.get_admin_litiges_queue_snapshot_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_litiges_queue_snapshot_v1(text) to authenticated;

-- Replace the whole dispatcher instead of splicing pg_get_functiondef text
-- (keyword casing / formatting after prior patches breaks strpos on "end if;").
create or replace function public.get_admin_special_space_snapshot_v1(p_space text, p_locale text)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null
    or auth.jwt()->>'aal' is distinct from 'aal2'
    or p_locale is null
    or p_locale not in ('fr', 'ar')
  then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  if not public.admin_special_space_snapshot_access_v1(p_space) then
    raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
  end if;
  if p_space = 'providers' then
    return public.get_admin_provider_queue_snapshot_v1(p_locale);
  elsif p_space = 'qualification' then
    return public.get_admin_qualification_queue_snapshot_v1(p_locale);
  elsif p_space = 'capacite' then
    return public.get_admin_capacite_queue_snapshot_v1(p_locale);
  elsif p_space = 'franchises' then
    return public.get_admin_franchises_queue_snapshot_v1(p_locale);
  elsif p_space = 'territoires' then
    return public.get_admin_territoires_queue_snapshot_v1(p_locale);
  elsif p_space = 'gouvernance' then
    return public.get_admin_gouvernance_queue_snapshot_v1(p_locale);
  elsif p_space = 'litiges' then
    return public.get_admin_litiges_queue_snapshot_v1(p_locale);
  end if;
  raise exception 'ADMIN_EXPORT_SCOPE_DENIED' using errcode = '42501';
end;
$$;

revoke all on function public.get_admin_special_space_snapshot_v1(text, text) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_special_space_snapshot_v1(text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
