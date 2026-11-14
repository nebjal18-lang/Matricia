begin;
-- Enrich admin diagnostics projection with questionnaire version + titles.

do $$
declare
  definition text;
  patched text;
begin
  select pg_get_functiondef('public.list_admin_supervision_page_raw_v1(integer,integer)'::regprocedure) into definition;

  patched := regexp_replace(
    definition,
    $re$'overall_score',\s*d\.overall_score,\s*'completed_at',\s*d\.completed_at\s*\)\s*item\s*from\s+public\.diagnostic_runs\s+d\s+join\s+public\.organizations\s+o\s+on\s+o\.id\s*=\s*d\.organization_id$re$,
    $dst$'overall_score', d.overall_score,
          'completed_at', d.completed_at,
          'questionnaire_version_id', qs.questionnaire_version_id,
          'questionnaire_version', qv.version,
          'questionnaire_title_fr', qv.title_fr,
          'questionnaire_title_ar', qv.title_ar
        ) item
        from public.diagnostic_runs d
        join public.organizations o on o.id = d.organization_id
        left join public.questionnaire_sessions qs on qs.id = d.questionnaire_session_id
        left join public.questionnaire_versions qv on qv.id = qs.questionnaire_version_id$dst$,
    'n'
  );

  if patched is not distinct from definition or position('questionnaire_version' in patched) = 0 then
    raise exception 'ADMIN_DIAGNOSTICS_QUEUE_FIELDS_PATCH_FAILED' using errcode = '55000';
  end if;

  execute patched;
end$$;

notify pgrst, 'reload schema';
commit;
