begin;

-- Enrich admin organization fiche memberships with display identity (name + email).
-- Display-only; preserves existing legal/compliance enrichment wrapper.
create or replace function public.get_admin_organization_fiche(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  result jsonb;
  c public.client_compliance_cases%rowtype;
  p public.client_profile_versions%rowtype;
  profile jsonb;
  snapshot jsonb;
  actions jsonb;
  representative jsonb;
  memberships jsonb;
begin
  result := public.get_admin_organization_fiche_before_client_facts_v1(p_organization_id);
  select * into c from public.client_compliance_cases where organization_id = p_organization_id;
  if c.id is not null then
    select * into p from public.client_profile_versions
    where compliance_case_id = c.id and version = c.current_profile_version;
    representative := coalesce(p.profile_data->'representative', '{}'::jsonb);
    profile := case
      when p.id is null then null
      else jsonb_build_object(
        'version', p.version,
        'legal_form', p.profile_data->>'legal_form',
        'incorporation_date', p.profile_data->>'incorporation_date',
        'activity', p.profile_data->>'activity',
        'sector', p.profile_data->>'sector',
        'registered_city', p.profile_data->>'registered_city',
        'registered_address', p.profile_data->'registered_address',
        'if_number', p.profile_data->>'if_number',
        'rc_number', p.profile_data->>'rc_number',
        'representative_name', nullif(
          btrim(
            concat_ws(
              ' ',
              representative->>'first_name',
              representative->>'last_name'
            )
          ),
          ''
        )
      )
    end;
    select coalesce(jsonb_agg(item order by item->>'kind', item->>'id'), '[]') into actions from (
      select jsonb_build_object(
        'id', id, 'kind', 'ANOMALY', 'code', anomaly_code,
        'label_fr', client_message_fr, 'label_ar', client_message_ar
      ) item
      from public.client_administrative_anomalies
      where compliance_case_id = c.id and blocking and status in ('OPEN', 'QUESTIONED')
      union all
      select jsonb_build_object(
        'id', id, 'kind', 'QUESTION', 'code', status,
        'label_fr', question_text_fr, 'label_ar', question_text_ar
      )
      from public.client_compliance_questions
      where compliance_case_id = c.id and status in ('OPEN', 'ANSWERED')
    ) a;
    snapshot := jsonb_build_object(
      'case_id', c.id,
      'status', c.status,
      'profile_version', c.current_profile_version,
      'document_count', (
        select count(*) from public.client_compliance_documents
        where compliance_case_id = c.id and status <> 'SUPERSEDED'
      ),
      'verified_document_count', (
        select count(*) from public.client_compliance_documents
        where compliance_case_id = c.id
          and status = 'VERIFIED'
          and scan_status = 'CLEAN'
          and (expires_on is null or expires_on >= current_date)
      ),
      'currently_verified',
        c.status = 'VERIFIED' and private.client_identity_allows_new_operations(p_organization_id),
      'required_actions', actions
    );
  end if;

  select coalesce(
    (
      select jsonb_agg(
        elem || jsonb_build_object(
          'display_name', coalesce(
            nullif(btrim(up.display_name), ''),
            nullif(btrim(concat_ws(
              ' ',
              u.raw_user_meta_data->>'given_name',
              u.raw_user_meta_data->>'family_name'
            )), ''),
            nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
            'Membre'
          ),
          'email', u.email
        )
        order by ord
      )
      from jsonb_array_elements(coalesce(result->'memberships', '[]'::jsonb))
        with ordinality as t(elem, ord)
      left join auth.users u on u.id = nullif(elem->>'user_id', '')::uuid
      left join public.user_profiles up on up.id = u.id
    ),
    '[]'::jsonb
  ) into memberships;

  return jsonb_set(
    jsonb_set(
      result,
      '{organization}',
      coalesce(result->'organization', '{}'::jsonb) || jsonb_build_object(
        'client_compliance_status', c.status,
        'client_legal_profile', profile,
        'client_compliance_snapshot', snapshot
      )
    ),
    '{memberships}',
    memberships
  ) || jsonb_build_object(
    'client_request_count',
    (select count(*) from public.service_requests where client_organization_id = p_organization_id)
  );
end;
$$;

revoke all on function public.get_admin_organization_fiche(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_admin_organization_fiche(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
