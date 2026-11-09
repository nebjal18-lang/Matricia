-- Franchise library workspace was timing out: PostgREST RLS on catalog_* tables
-- costs multiple seconds per query, and the page reader materialised all 600 IT
-- questions on every sibling-kind load. Serve the workspace slice via one
-- security-definer bundle after the same mandate/AAL gate as franchise_catalog_page.
begin;

create or replace function public.franchise_catalog_page(
  p_franchise_id uuid,
  p_kind text default 'SERVICE',
  p_search text default '',
  p_page integer default 1,
  p_object_id uuid default null,
  p_status text default 'ALL',
  p_category_id uuid default null,
  p_language text default 'ALL',
  p_completeness text default 'ALL',
  p_validation text default 'ALL'
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  lib uuid;
  result jsonb;
begin
  lib := private.franchise_catalog_reader_library(p_franchise_id);
  if p_kind is null or p_page is null or p_search is null
    or p_kind not in ('SERVICE', 'QUESTIONNAIRE', 'RULE', 'QUESTION', 'ALL')
    or p_page not between 1 and 100000
    or length(p_search) > 120
  then
    raise exception 'INVALID_FRANCHISE_CATALOG_PAGE' using errcode = '22023';
  end if;

  with objects as (
    select 'SERVICE' kind, s.id, coalesce(s.current_draft_version_id, s.current_published_version_id) version_id, s.code,
      case when s.status in ('ARCHIVED', 'RETIRED') then s.status else coalesce(v.status, s.status) end status,
      coalesce(v.name_fr, '') fr, coalesce(v.name_ar, '') ar, coalesce(v.short_description_fr, '') description,
      s.primary_subcategory_id subcategory_id, sub.category_id
    from public.catalog_services s
    left join public.catalog_service_versions v on v.id = coalesce(s.current_draft_version_id, s.current_published_version_id)
    left join public.catalog_subcategories sub on sub.id = s.primary_subcategory_id
    where s.library_id = lib
    union all
    select 'QUESTIONNAIRE', q.id, coalesce(q.current_draft_version_id, q.current_published_version_id), q.code,
      case when q.status in ('ARCHIVED', 'RETIRED') then q.status else coalesce(v.status, q.status) end,
      coalesce(v.title_fr, ''), coalesce(v.title_ar, ''), '', null, null
    from public.questionnaires q
    left join public.questionnaire_versions v on v.id = coalesce(q.current_draft_version_id, q.current_published_version_id)
    where q.library_id = lib and private.can_read_questionnaire_version(v.id)
    union all
    select 'RULE', r.id, coalesce(r.current_draft_version_id, r.current_published_version_id), r.rule_key,
      case when r.status in ('ARCHIVED', 'RETIRED') then r.status else coalesce(v.status, r.status) end,
      r.rule_key, r.rule_key, '', null, null
    from public.question_rules r
    left join public.question_rule_versions v on v.id = coalesce(r.current_draft_version_id, r.current_published_version_id)
    where r.library_id = lib
    union all
    select 'QUESTION', q.id, coalesce(q.current_draft_version_id, q.current_published_version_id), q.question_key,
      case when q.status in ('ARCHIVED', 'RETIRED') then q.status else coalesce(v.status, q.status) end,
      coalesce(v.label_fr, ''), coalesce(v.label_ar, ''), '', null, null
    from public.question_bank_questions q
    join public.question_versions v on v.id = coalesce(q.current_draft_version_id, q.current_published_version_id)
    where q.library_id = lib
  ),
  filtered as (
    select *
    from objects
    where (p_kind = 'ALL' or kind = p_kind)
      and (p_search = '' or position(lower(p_search) in lower(code || ' ' || fr || ' ' || ar)) > 0)
      and (
        p_status = 'ALL'
        or status = p_status
        or (p_status = 'REVIEW' and status in ('IN_REVIEW', 'FRANCHISE_REVIEW', 'CENTRAL_REVIEW', 'LOCAL_TEST'))
        or (
          p_status = 'RETURNS'
          and (
            status in ('REJECTED', 'CHANGES_REQUESTED')
            or (
              select cr.status
              from public.catalog_change_requests cr
              where cr.target_id = objects.id and cr.library_id = lib
              order by cr.requested_at desc, cr.id desc
              limit 1
            ) = 'REJECTED'
          )
        )
        or (p_status = 'DONE' and status in ('APPROVED', 'PUBLISHED'))
      )
      and (p_category_id is null or category_id = p_category_id or subcategory_id = p_category_id)
      and (p_language = 'ALL' or (p_language = 'FR' and fr <> '') or (p_language = 'AR' and ar <> ''))
      and (
        p_completeness = 'ALL'
        or (p_completeness = 'FULL' and fr <> '' and ar <> '' and description <> '')
        or (p_completeness = 'PARTIAL' and (fr = '' or ar = '' or description = ''))
      )
      and (
        p_validation = 'ALL'
        or (p_validation = 'DRAFT' and status = 'DRAFT')
        or (p_validation = 'REVIEW' and status in ('IN_REVIEW', 'FRANCHISE_REVIEW', 'CENTRAL_REVIEW', 'LOCAL_TEST'))
        or (p_validation = 'PUBLISHED' and status in ('APPROVED', 'PUBLISHED'))
      )
  ),
  ranked as (
    select *, row_number() over (partition by kind order by code, id) rn from filtered
  ),
  sibling as (
    select *, row_number() over (partition by kind order by code, id) rn from objects
  ),
  kinds as (
    select unnest(array['SERVICE', 'QUESTIONNAIRE', 'RULE', 'QUESTION']) kind
  )
  select jsonb_build_object(
    'page', p_page,
    'pageSize', 25,
    'kind', p_kind,
    'search', p_search,
    'status', p_status,
    'categoryId', p_category_id,
    'language', p_language,
    'completeness', p_completeness,
    'validation', p_validation,
    'bucketCounts', coalesce((
      select jsonb_object_agg(status, n)
      from (select status, count(*) n from objects where kind <> 'QUESTION' group by status) c
    ), '{}'::jsonb),
    'counts', jsonb_build_object(
      'drafts', (select count(*) from objects where kind <> 'QUESTION' and status = 'DRAFT'),
      'inReview', (select count(*) from objects where kind <> 'QUESTION' and status in ('IN_REVIEW', 'FRANCHISE_REVIEW', 'CENTRAL_REVIEW', 'LOCAL_TEST')),
      'published', (select count(*) from objects where kind <> 'QUESTION' and status = 'PUBLISHED'),
      'returns', (select count(*) from public.catalog_change_requests where library_id = lib and status = 'REJECTED')
    ),
    'groups', (
      select jsonb_object_agg(
        k.kind,
        jsonb_build_object(
          'total', case
            when p_kind = 'ALL' or k.kind = p_kind then (select count(*) from filtered f where f.kind = k.kind)
            else (select count(*) from objects o where o.kind = k.kind)
          end,
          'ids', coalesce((
            select jsonb_agg(x.id order by x.code, x.id)
            from (
              select r.id, r.code
              from ranked r
              where r.kind = k.kind
                and (p_kind = 'ALL' or k.kind = p_kind)
                and (
                  (r.rn > (p_page - 1) * 25 and r.rn <= p_page * 25)
                  or r.id = p_object_id
                  or r.version_id = p_object_id
                )
              union all
              select s.id, s.code
              from sibling s
              where s.kind = k.kind
                and p_kind <> 'ALL'
                and k.kind <> p_kind
                and s.rn <= 25
            ) x
          ), '[]'::jsonb),
          'versionIds', coalesce((
            select jsonb_agg(distinct x.version_id)
            from (
              select r.version_id
              from ranked r
              where r.kind = k.kind
                and r.version_id is not null
                and (p_kind = 'ALL' or k.kind = p_kind)
                and (
                  (r.rn > (p_page - 1) * 25 and r.rn <= p_page * 25)
                  or r.id = p_object_id
                  or r.version_id = p_object_id
                )
              union all
              select s.version_id
              from sibling s
              where s.kind = k.kind
                and s.version_id is not null
                and p_kind <> 'ALL'
                and k.kind <> p_kind
                and s.rn <= 25
            ) x
          ), '[]'::jsonb)
        )
      )
      from kinds k
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.franchise_catalog_page(uuid, text, text, integer, uuid, text, uuid, text, text, text)
  from public, anon, service_role;
grant execute on function public.franchise_catalog_page(uuid, text, text, integer, uuid, text, uuid, text, text, text)
  to authenticated;

create or replace function public.franchise_catalog_workspace_v1(
  p_franchise_id uuid,
  p_kind text default 'SERVICE',
  p_search text default '',
  p_page integer default 1,
  p_object_id uuid default null,
  p_status text default 'ALL',
  p_category_id uuid default null,
  p_language text default 'ALL',
  p_completeness text default 'ALL',
  p_validation text default 'ALL'
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  lib uuid;
  page jsonb;
  load_composition boolean;
  load_bank boolean;
  service_ids uuid[];
  questionnaire_ids uuid[];
  rule_ids uuid[];
  question_ids uuid[];
  questionnaire_version_ids uuid[];
  result jsonb;
begin
  lib := private.franchise_catalog_reader_library(p_franchise_id);
  page := public.franchise_catalog_page(
    p_franchise_id, p_kind, p_search, p_page, p_object_id, p_status, p_category_id, p_language, p_completeness, p_validation
  );
  load_composition := p_kind in ('QUESTIONNAIRE', 'RULE', 'ALL');
  load_bank := p_kind in ('QUESTIONNAIRE', 'RULE');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into service_ids
  from jsonb_array_elements_text(page #> '{groups,SERVICE,ids}') value;
  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into questionnaire_ids
  from jsonb_array_elements_text(page #> '{groups,QUESTIONNAIRE,ids}') value;
  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into rule_ids
  from jsonb_array_elements_text(page #> '{groups,RULE,ids}') value;
  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into question_ids
  from jsonb_array_elements_text(page #> '{groups,QUESTION,ids}') value;
  select coalesce(array_agg(value::uuid), array[]::uuid[])
    into questionnaire_version_ids
  from jsonb_array_elements_text(page #> '{groups,QUESTIONNAIRE,versionIds}') value;

  if cardinality(service_ids) = 0 then service_ids := array['00000000-0000-0000-0000-000000000000'::uuid]; end if;
  if cardinality(questionnaire_ids) = 0 then questionnaire_ids := array['00000000-0000-0000-0000-000000000000'::uuid]; end if;
  if cardinality(rule_ids) = 0 then rule_ids := array['00000000-0000-0000-0000-000000000000'::uuid]; end if;
  if cardinality(question_ids) = 0 then question_ids := array['00000000-0000-0000-0000-000000000000'::uuid]; end if;
  if cardinality(questionnaire_version_ids) = 0 then questionnaire_version_ids := array['00000000-0000-0000-0000-000000000000'::uuid]; end if;

  select jsonb_build_object(
    'page', page,
    'library', (
      select to_jsonb(l)
      from (
        select id, code, status, row_version, current_draft_version_id, current_published_version_id, current_release_id
        from public.catalog_libraries
        where id = lib
        limit 1
      ) l
    ),
    'libraryVersions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.version desc, v.id)
      from (
        select id, library_id, name_fr, name_ar, version
        from public.catalog_library_versions
        where library_id = lib
      ) v
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.code, s.id)
      from (
        select id, library_id, primary_subcategory_id, code, slug, status, row_version, current_draft_version_id, current_published_version_id
        from public.catalog_services
        where library_id = lib and id = any (service_ids)
      ) s
    ), '[]'::jsonb),
    'serviceVersions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.version desc, v.id)
      from (
        select id, service_id, version, status, row_version, name_fr, name_ar, short_description_fr, short_description_ar,
          long_description_fr, long_description_ar, service_type, unit_label_fr, unit_label_ar, credit_eligible, volume_eligible,
          recurring_eligible, trial_eligible, rfq_required, fixed_fulfillment_allowed, base_currency, sort_order,
          fulfillment_config, visibility_rules, sensitive, slug
        from public.catalog_service_versions
        where library_id = lib and service_id = any (service_ids)
      ) v
    ), '[]'::jsonb),
    'questionnaires', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.code, q.id)
      from (
        select id, library_id, code, status, row_version, current_draft_version_id, current_published_version_id
        from public.questionnaires
        where library_id = lib and id = any (questionnaire_ids)
      ) q
    ), '[]'::jsonb),
    'questionnaireVersions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.version desc, v.id)
      from (
        select id, questionnaire_id, version, status, row_version, title_fr, title_ar
        from public.questionnaire_versions
        where library_id = lib and questionnaire_id = any (questionnaire_ids)
      ) v
    ), '[]'::jsonb),
    'rules', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.rule_key, r.id)
      from (
        select id, library_id, rule_key, status, row_version, current_draft_version_id, current_published_version_id
        from public.question_rules
        where library_id = lib and id = any (rule_ids)
      ) r
    ), '[]'::jsonb),
    'ruleVersions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.version desc, v.id)
      from (
        select id, rule_id, version, status, row_version, actions, condition_ast, dependency_graph, priority, sensitive
        from public.question_rule_versions
        where library_id = lib and rule_id = any (rule_ids)
      ) v
    ), '[]'::jsonb),
    'questions', case
      when p_kind in ('QUESTION', 'QUESTIONNAIRE', 'RULE', 'ALL') then coalesce((
        select jsonb_agg(to_jsonb(q) order by q.question_key, q.id)
        from (
          select id, library_id, question_key, status, current_draft_version_id, current_published_version_id
          from public.question_bank_questions
          where library_id = lib and id = any (question_ids)
        ) q
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'questionVersions', case
      when p_kind in ('QUESTION', 'QUESTIONNAIRE', 'RULE', 'ALL') then coalesce((
        select jsonb_agg(to_jsonb(v) order by v.version desc, v.id)
        from (
          select id, question_id, version, status, label_fr, label_ar, help_fr, help_ar, answer_type, required_by_default, source_service_id
          from public.question_versions
          where library_id = lib and question_id = any (question_ids)
        ) v
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'categories', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.code, c.id)
      from (
        select id, library_id, code, status, row_version, current_draft_version_id, current_published_version_id
        from public.catalog_categories
        where library_id = lib
      ) c
    ), '[]'::jsonb),
    'categoryVersions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.id)
      from (
        select id, category_id, name_fr, name_ar, status, row_version
        from public.catalog_category_versions
        where library_id = lib
      ) v
    ), '[]'::jsonb),
    'subcategories', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.code, s.id)
      from (
        select id, library_id, category_id, code, status, row_version, current_draft_version_id, current_published_version_id
        from public.catalog_subcategories
        where library_id = lib
      ) s
    ), '[]'::jsonb),
    'subcategoryVersions', coalesce((
      select jsonb_agg(to_jsonb(v) order by v.id)
      from (
        select id, subcategory_id, name_fr, name_ar, status, row_version
        from public.catalog_subcategory_versions
        where library_id = lib
      ) v
    ), '[]'::jsonb),
    'releases', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id)
      from (
        select id, library_id, release_key, status, created_at
        from public.catalog_releases
        where library_id = lib
      ) r
    ), '[]'::jsonb),
    'changes', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.requested_at desc, c.id)
      from (
        select id, target_id, target_type, target_version_id, status, requested_at, reviewed_at, review_comment
        from public.catalog_change_requests
        where library_id = lib
          and target_id = any (service_ids || questionnaire_ids || rule_ids)
      ) c
    ), '[]'::jsonb),
    'sections', case
      when load_composition then coalesce((
        select jsonb_agg(to_jsonb(s) order by s.sort_order, s.id)
        from (
          select id, questionnaire_version_id, section_key, label_fr, label_ar, help_fr, help_ar, sort_order
          from public.questionnaire_sections
          where questionnaire_version_id = any (questionnaire_version_ids)
        ) s
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'compositionRules', case
      when load_composition then coalesce((
        select jsonb_agg(to_jsonb(r) order by r.questionnaire_version_id, r.evaluation_order)
        from (
          select questionnaire_version_id, rule_version_id, evaluation_order
          from public.questionnaire_version_rules
          where library_id = lib and questionnaire_version_id = any (questionnaire_version_ids)
        ) r
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'questionnaireQuestions', case
      when load_composition then coalesce((
        select jsonb_agg(to_jsonb(q) order by q.questionnaire_version_id, q.sort_order)
        from (
          select questionnaire_version_id, question_version_id, section_id, required_override, sort_order
          from public.questionnaire_version_questions
          where library_id = lib and questionnaire_version_id = any (questionnaire_version_ids)
        ) q
      ), '[]'::jsonb)
      else '[]'::jsonb
    end,
    'questionBank', case
      when load_bank then public.franchise_catalog_bank(p_franchise_id, 'QUESTION', '', 1)
      else jsonb_build_object('page', 1, 'items', '[]'::jsonb, 'total', 0)
    end,
    'ruleBank', case
      when load_bank then public.franchise_catalog_bank(p_franchise_id, 'RULE', '', 1)
      else jsonb_build_object('page', 1, 'items', '[]'::jsonb, 'total', 0)
    end
  ) into result;

  if load_composition or load_bank then
    result := result || jsonb_build_object(
      'ruleVersions', coalesce((
        select jsonb_agg(distinct to_jsonb(v))
        from public.question_rule_versions v
        where v.library_id = lib
          and (
            v.rule_id in (select (x->>'id')::uuid from jsonb_array_elements(result->'rules') x)
            or v.id in (
              select (x->>'rule_version_id')::uuid from jsonb_array_elements(result->'compositionRules') x
              union
              select (x->>'id')::uuid from jsonb_array_elements(result->'ruleBank'->'items') x
            )
          )
      ), '[]'::jsonb),
      'rules', coalesce((
        select jsonb_agg(distinct to_jsonb(r))
        from public.question_rules r
        where r.library_id = lib
          and (
            r.id in (select (x->>'id')::uuid from jsonb_array_elements(result->'rules') x)
            or r.id in (
              select v.rule_id
              from public.question_rule_versions v
              where v.library_id = lib
                and v.id in (
                  select (x->>'rule_version_id')::uuid from jsonb_array_elements(result->'compositionRules') x
                  union
                  select (x->>'id')::uuid from jsonb_array_elements(result->'ruleBank'->'items') x
                )
            )
          )
      ), '[]'::jsonb),
      'questionVersions', coalesce((
        select jsonb_agg(distinct to_jsonb(v))
        from public.question_versions v
        where v.library_id = lib
          and (
            v.question_id in (select (x->>'id')::uuid from jsonb_array_elements(result->'questions') x)
            or v.id in (
              select (x->>'question_version_id')::uuid from jsonb_array_elements(result->'questionnaireQuestions') x
              union
              select (x->>'id')::uuid from jsonb_array_elements(result->'questionBank'->'items') x
            )
          )
      ), '[]'::jsonb),
      'questions', coalesce((
        select jsonb_agg(distinct to_jsonb(q))
        from public.question_bank_questions q
        where q.library_id = lib
          and (
            q.id in (select (x->>'id')::uuid from jsonb_array_elements(result->'questions') x)
            or q.id in (
              select v.question_id
              from public.question_versions v
              where v.library_id = lib
                and v.id in (
                  select (x->>'question_version_id')::uuid from jsonb_array_elements(result->'questionnaireQuestions') x
                  union
                  select (x->>'id')::uuid from jsonb_array_elements(result->'questionBank'->'items') x
                )
            )
          )
      ), '[]'::jsonb)
    );
  end if;

  return result;
end;
$$;

revoke all on function public.franchise_catalog_workspace_v1(uuid, text, text, integer, uuid, text, uuid, text, text, text)
  from public, anon, service_role;
grant execute on function public.franchise_catalog_workspace_v1(uuid, text, text, integer, uuid, text, uuid, text, text, text)
  to authenticated;

commit;
