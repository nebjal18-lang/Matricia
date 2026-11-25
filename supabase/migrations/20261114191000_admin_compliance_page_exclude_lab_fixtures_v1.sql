begin;

create or replace function public.admin_lab_organization_name_v1(p_name text)
returns boolean
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  select coalesce(
    nullif(btrim(p_name), '') is not null
    and (
      p_name ~* '\ye2e\y'
      or p_name ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
      or btrim(p_name) ~* '^p[0-9]{2}([[:space:]]+[[:alnum:]]+)?$'
      or p_name ~* '\y(demo|démo)\y'
      or btrim(p_name) ~* '^client[[:space:]]+test\y'
    ),
    false
  );
$$;

revoke all on function public.admin_lab_organization_name_v1(text) from public, anon, authenticated, service_role;
grant execute on function public.admin_lab_organization_name_v1(text) to authenticated;

-- SECURITY DEFINER: organizations RLS is member-only; central admins still need lab classification.
create or replace function public.admin_case_is_lab_fixture_v1(
  p_organization_id uuid,
  p_compliance_case_id uuid,
  p_profile_version integer
) returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    public.admin_lab_organization_name_v1(o.display_name)
    or public.admin_lab_organization_name_v1(o.legal_name)
    or public.admin_lab_organization_name_v1(v.organization_snapshot->>'display_name')
    or public.admin_lab_organization_name_v1(v.organization_snapshot->>'legal_name'),
    false
  )
  from (select p_organization_id as organization_id) seed
  left join public.organizations o on o.id = seed.organization_id
  left join public.client_profile_versions v
    on v.compliance_case_id = p_compliance_case_id
   and v.version = p_profile_version;
$$;

revoke all on function public.admin_case_is_lab_fixture_v1(uuid, uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.admin_case_is_lab_fixture_v1(uuid, uuid, integer) to authenticated;

drop function if exists private.admin_case_is_lab_fixture_v1(uuid, uuid, integer);
drop function if exists public.get_admin_client_compliance_page_v1(integer, text, uuid);
drop function if exists public.get_admin_client_compliance_page_v1(integer, text, uuid, boolean);

create function public.get_admin_client_compliance_page_v1(
  p_page integer default 1,
  p_filter text default 'all',
  p_case_id uuid default null,
  p_include_fixtures boolean default false
) returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  rows jsonb;
  totals jsonb;
  n bigint;
  states text[];
  v_include boolean := coalesce(p_include_fixtures, false) or p_case_id is not null;
  v_fixture_count bigint := 0;
begin
  if p_page is null or p_page not between 1 and 100000
     or p_filter is null or p_filter not in ('all', 'check', 'complement', 'review', 'decided') then
    raise exception 'INVALID_COMPLIANCE_PAGE' using errcode = '22023';
  end if;

  states := case p_filter
    when 'check' then array['DOCUMENTS_REQUIRED']
    when 'complement' then array['QUESTION_REQUIRED']
    when 'review' then array['UNDER_REVIEW', 'RESPONSE_RECEIVED']
    when 'decided' then array['VERIFIED', 'REJECTED']
    else null
  end;

  select
    count(*) filter (
      where public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version)
    ),
    jsonb_build_object(
      'all', count(*) filter (
        where v_include or not public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version)
      ),
      'check', count(*) filter (
        where c.status = 'DOCUMENTS_REQUIRED'
          and (v_include or not public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version))
      ),
      'complement', count(*) filter (
        where c.status = 'QUESTION_REQUIRED'
          and (v_include or not public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version))
      ),
      'review', count(*) filter (
        where c.status in ('UNDER_REVIEW', 'RESPONSE_RECEIVED')
          and (v_include or not public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version))
      ),
      'decided', count(*) filter (
        where c.status in ('VERIFIED', 'REJECTED')
          and (v_include or not public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version))
      )
    )
  into v_fixture_count, totals
  from public.client_compliance_cases c;

  select count(*) into n
  from public.client_compliance_cases c
  where (p_case_id is null or c.id = p_case_id)
    and (states is null or c.status = any (states))
    and (
      v_include
      or not public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version)
    );

  select coalesce(
    jsonb_agg(to_jsonb(page_rows) order by page_rows.updated_at desc, page_rows.id desc),
    '[]'::jsonb
  )
  into rows
  from (
    select
      c.id,
      c.organization_id,
      c.status,
      c.current_profile_version,
      c.submitted_at,
      c.decision_reason_public,
      c.created_at,
      c.updated_at
    from public.client_compliance_cases c
    where (p_case_id is null or c.id = p_case_id)
      and (states is null or c.status = any (states))
      and (
        v_include
        or not public.admin_case_is_lab_fixture_v1(c.organization_id, c.id, c.current_profile_version)
      )
    order by c.updated_at desc, c.id desc
    limit 50 offset ((p_page - 1) * 50)
  ) page_rows;

  return jsonb_build_object(
    'cases', rows,
    'page', p_page,
    'has_next', p_page::bigint * 50 < n,
    'counts', totals,
    'fixture_count', v_fixture_count
  );
end;
$$;

revoke all on function public.get_admin_client_compliance_page_v1(integer, text, uuid, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.get_admin_client_compliance_page_v1(integer, text, uuid, boolean)
  to authenticated;

notify pgrst, 'reload schema';
commit;
