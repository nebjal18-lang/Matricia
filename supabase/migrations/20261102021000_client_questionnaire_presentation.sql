-- Client presentation uses the exact rule evaluator used by final submission.
-- It accepts no caller-provided answers, tenant, rule or visibility overrides.
create function public.questionnaire_session_presentation(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare
 s public.questionnaire_sessions%rowtype;
 snapshot public.questionnaire_session_snapshots%rowtype;
 evaluation jsonb;
 previous jsonb := '{}'::jsonb;
 actions jsonb := '[]'::jsonb;
 hidden text[] := '{}'; required_rules text[] := '{}'; optional_rules text[] := '{}';
 action jsonb; presentation jsonb;
begin
 if auth.uid() is null then raise exception 'AUTHENTICATION_REQUIRED' using errcode='42501'; end if;
 select * into s from public.questionnaire_sessions where id=p_session_id;
 if not found or s.actor_user_id<>auth.uid() or not private.can_access_questionnaire_session(s.id) then
  raise exception 'SESSION_SCOPE_DENIED' using errcode='42501';
 end if;
 select * into snapshot from public.questionnaire_session_snapshots where session_id=s.id;
 if not found then raise exception 'SESSION_SNAPSHOT_MISSING' using errcode='23514'; end if;
 if s.status='SUBMITTED' then
  select e.triggered_actions into actions from public.questionnaire_session_evaluations e where e.session_id=s.id order by e.evaluated_at desc,e.id desc limit 1;
  if actions is null then
   -- The legacy v1 contract has no conditional actions or stored engine evaluation.
   if snapshot.engine_version='1' or snapshot.engine_version like '1.%' then actions:='[]'::jsonb;
   else raise exception 'SESSION_EVALUATION_MISSING' using errcode='23514'; end if;
  end if;
 elsif snapshot.engine_version<>'1' and snapshot.engine_version not like '1.%' then
  if s.revision_of_session_id is not null then previous:=private.questionnaire_session_answers_object(s.revision_of_session_id); end if;
  evaluation:=private.simulate_questionnaire_rule_engine_core(s.questionnaire_version_id,private.questionnaire_session_answers_object(s.id),previous);
  actions:=evaluation->'triggered_actions';
 end if;
 for action in select value from jsonb_array_elements(actions) loop
  if action->>'type'='HIDE' then hidden:=array_append(hidden,action->>'target');
  elsif action->>'type'='REQUIRED' then required_rules:=array_append(required_rules,action->>'target');
  elsif action->>'type'='OPTIONAL' then optional_rules:=array_append(optional_rules,action->>'target'); end if;
 end loop;
 if exists(select 1 from unnest(required_rules) q where q=any(hidden)) then
  raise exception 'CONTRADICTORY_REQUIRED_VISIBILITY' using errcode='23514';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'question_version_id',q.id,'visible',not(q.id::text=any(hidden)),
  'required',((coalesce(x.required_override,q.required_by_default) and not(q.id::text=any(optional_rules))) or q.id::text=any(required_rules))
 )order by x.sort_order,q.id),'[]'::jsonb) into presentation
 from public.questionnaire_version_questions x join public.question_versions q on q.id=x.question_version_id
 where x.questionnaire_version_id=s.questionnaire_version_id;
 return jsonb_build_object('session_id',s.id,'row_version',s.row_version,'questions',presentation);
end $$;
revoke all on function public.questionnaire_session_presentation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.questionnaire_session_presentation(uuid) to authenticated;
