-- Diagnostic facts come from the immutable FINAL evaluation of published rules.
-- The existing platform health bands are fixed here, never supplied by a caller.
begin;
alter table public.diagnostic_anomalies drop constraint diagnostic_anomalies_severity_check;
alter table public.diagnostic_anomalies add constraint diagnostic_anomalies_severity_check check(severity in('INFO','WARNING','HIGH','CRITICAL','UNKNOWN'));
alter table public.diagnostic_recommendations alter column anomaly_id drop not null,alter column priority drop not null,alter column priority type numeric(7,2),alter column solution_level drop not null;
alter table public.diagnostic_opportunities alter column recommendation_id drop not null,alter column anomaly_id drop not null,alter column priority drop not null,alter column priority type numeric(7,2),alter column solution_level drop not null;
alter table public.diagnostic_opportunities drop constraint diagnostic_opportunities_diagnostic_run_id_recommendation_i_key;
alter table public.diagnostic_recommendations drop constraint diagnostic_recommendations_priority_check;
alter table public.diagnostic_recommendations add constraint diagnostic_recommendations_priority_check check(priority between 0 and 100);
alter table public.diagnostic_opportunities drop constraint diagnostic_opportunities_priority_check;
alter table public.diagnostic_opportunities add constraint diagnostic_opportunities_priority_check check(priority between 0 and 100);
create function private.published_diagnostic_priority(p_metadata jsonb)returns numeric language sql immutable set search_path=pg_catalog as $$
 select case when p_metadata->>'priority_basis_points'~'^[0-9]{1,5}$'and(p_metadata->>'priority_basis_points')::integer between 0 and 10000 then(p_metadata->>'priority_basis_points')::numeric/100
 when p_metadata->>'priority'~'^[0-9]{1,3}(\.[0-9]{1,2})?$'and(p_metadata->>'priority')::numeric between 0 and 100 then(p_metadata->>'priority')::numeric else null end
$$;
create function private.published_diagnostic_service(p_target text,p_library_id uuid)returns uuid language plpgsql stable security definer set search_path=pg_catalog,private as $$
declare result uuid;matches integer;
begin
 select count(*)::integer,min(s.id::text)::uuid into matches,result from public.catalog_services s join public.catalog_service_versions v on v.id=s.current_published_version_id and v.service_id=s.id and v.library_id=s.library_id where(lower(s.id::text)=lower(p_target) or s.code=p_target)and s.library_id=p_library_id and s.status='PUBLISHED'and v.status='PUBLISHED';
 if matches<>1 then raise exception'PUBLISHED_DIAGNOSTIC_SERVICE_REQUIRED'using errcode='55000';end if;return result;
end$$;
create function private.published_client_diagnostic_policy(p_session_id uuid,p_service_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,private,extensions as $$
declare s public.questionnaire_sessions%rowtype;e public.questionnaire_session_evaluations%rowtype;snap public.questionnaire_session_snapshots%rowtype;rule record;act jsonb;source_actions jsonb;canonical jsonb;source_hash text;
begin
 select*into s from public.questionnaire_sessions where id=p_session_id;
 select*into e from public.questionnaire_session_evaluations where session_id=s.id and organization_id=s.organization_id;
 select*into snap from public.questionnaire_session_snapshots where id=e.session_snapshot_id and session_id=s.id and organization_id=s.organization_id;
 if s.id is null or e.id is null or snap.id is null or s.status<>'SUBMITTED'or s.audience<>'CLIENT'or s.is_simulation or e.questionnaire_version_id<>s.questionnaire_version_id or snap.questionnaire_version_id<>s.questionnaire_version_id or snap.catalog_release_id<>s.catalog_release_id or e.answer_manifest_hash is distinct from s.answer_manifest_hash or e.result_payload->>'mode'is distinct from'FINAL'or e.result_payload->>'session_snapshot_id'is distinct from snap.id::text or e.result_payload->>'answer_manifest_hash'is distinct from e.answer_manifest_hash or e.result_payload->'triggered_actions'is distinct from e.triggered_actions or(e.result_payload->>'score_basis_points')::numeric is distinct from e.score_basis_points or e.result_payload->>'legacy_compatibility'='true'then raise exception'PUBLISHED_DIAGNOSTIC_EVALUATION_REQUIRED'using errcode='55000';end if;
 if e.engine_version is distinct from snap.engine_version or e.policy_version is distinct from snap.policy_version or e.questionnaire_version_id is distinct from snap.questionnaire_version_id
 or encode(extensions.digest(convert_to(s.answer_manifest::text,'UTF8'),'sha256'),'hex')is distinct from s.answer_manifest_hash
 or encode(extensions.digest(convert_to(private.questionnaire_session_snapshot_payload(s.id)::text,'UTF8'),'sha256'),'hex')is distinct from snap.snapshot_hash
 or encode(extensions.digest(convert_to(jsonb_build_object('snapshot_hash',snap.snapshot_hash,'result',e.result_payload)::text,'UTF8'),'sha256'),'hex')is distinct from e.reproducibility_hash then raise exception'DIAGNOSTIC_CANONICAL_HASH_MISMATCH'using errcode='23514';end if;
 if not exists(select 1 from jsonb_array_elements(snap.rules_manifest)m join public.question_rule_versions r on r.id=(m->>'rule_version_id')::uuid where exists(select 1 from jsonb_array_elements(r.actions)a where a->>'type'='SCORE'))then raise exception'PUBLISHED_DIAGNOSTIC_SCORING_RULE_REQUIRED'using errcode='55000';end if;
 for rule in select m.value manifest,r.*from jsonb_array_elements(snap.rules_manifest)m join public.question_rule_versions r on r.id=(m.value->>'rule_version_id')::uuid loop
  if rule.compiled_hash is distinct from rule.manifest->>'compiled_hash'or rule.status not in('PUBLISHED','SUPERSEDED','ARCHIVED')then raise exception'DIAGNOSTIC_PUBLISHED_RULE_MISMATCH'using errcode='23514';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(snap.rules_manifest)m where not exists(select 1 from public.question_rule_versions r where r.id=(m->>'rule_version_id')::uuid and r.compiled_hash=m->>'compiled_hash'))or exists(select 1 from jsonb_array_elements(snap.questions_manifest)m where not exists(select 1 from public.question_versions q where q.id=(m->>'question_version_id')::uuid and q.content_hash=m->>'content_hash'))then raise exception'DIAGNOSTIC_PUBLISHED_SOURCE_MISMATCH'using errcode='23514';end if;
 for act in select value from jsonb_array_elements(e.triggered_actions)loop
  select r.actions into source_actions from public.question_rule_versions r join jsonb_array_elements(snap.rules_manifest)m on r.id=(m->>'rule_version_id')::uuid where r.id=(act->>'rule_version_id')::uuid and(act->>'evaluation_order')::integer=(m->>'evaluation_order')::integer;
  if source_actions is null or not exists(select 1 from jsonb_array_elements(source_actions)a where a=act-array['rule_version_id','evaluation_order'])then raise exception'DIAGNOSTIC_PUBLISHED_ACTION_MISMATCH'using errcode='23514';end if;
  if act->>'type'='SUGGEST_SERVICE'then perform private.published_diagnostic_service(act->>'target',s.library_id);end if;
 end loop;
 if p_service_id is not null then perform private.published_diagnostic_service(p_service_id::text,s.library_id);end if;
 canonical:=jsonb_build_object('version','PUBLISHED_RULE_ENGINE_V1','engine_version',e.engine_version,'published_policy_version',e.policy_version,'thresholds',jsonb_build_object('good',80,'attention',60,'important',40),'rating_policy_version','EXISTING_HEALTH_BANDS_V1','score_source','FINAL_PUBLISHED_RULE_EVALUATION','questionnaire_version_id',s.questionnaire_version_id,'questionnaire_snapshot_hash',snap.questionnaire_snapshot_hash,'release_source_bundle_hash',snap.release_source_bundle_hash,'selected_service_id',p_service_id,
 'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'version',q.version,'content_hash',q.content_hash,'weight',q.weight,'maximum_score',q.maximum_score)order by q.id)from jsonb_array_elements(snap.questions_manifest)m join public.question_versions q on q.id=(m->>'question_version_id')::uuid),'[]'),
 'rules',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'version',r.version,'compiled_hash',r.compiled_hash,'priority',r.priority,'condition_ast',r.condition_ast,'actions',r.actions,'evaluation_order',m->'evaluation_order')order by(m->>'evaluation_order')::integer,r.id)from jsonb_array_elements(snap.rules_manifest)m join public.question_rule_versions r on r.id=(m->>'rule_version_id')::uuid),'[]'));
 source_hash:=private.canonical_request_hash(canonical);return canonical||jsonb_build_object('content_hash',source_hash,'session_snapshot_hash',snap.snapshot_hash,'evaluation_id',e.id,'evaluation_reproducibility_hash',e.reproducibility_hash);
exception when invalid_text_representation then raise exception'DIAGNOSTIC_PUBLISHED_SOURCE_MISMATCH'using errcode='23514';
end$$;
create function public.complete_published_client_diagnostic_v1(p_session_id uuid,p_service_id uuid,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,private,extensions as $$
declare actor uuid:=auth.uid();s public.questionnaire_sessions%rowtype;e public.questionnaire_session_evaluations%rowtype;policy jsonb;cached jsonb;request_hash text;run_id uuid:=extensions.gen_random_uuid();old_run public.diagnostic_runs%rowtype;score numeric(5,2);rating text;result jsonb;act jsonb;other jsonb;metadata jsonb;rule_id uuid;anomaly_id uuid;recommendation_id uuid;service_id uuid;services uuid[];i integer:=0;code text;severity text;level text;priority numeric;missing jsonb;title_fr text;title_ar text;text_fr text;text_ar text;found_anomalies jsonb:='{}';found_recommendations jsonb:='{}';candidates jsonb;rule_anomalies jsonb;opportunity_created boolean:=false;
begin
 select*into s from public.questionnaire_sessions where id=p_session_id;
 if actor is null or s.id is null or not private.has_org_role(s.organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],actor)then raise exception'DIAGNOSTIC_COMPLETE_DENIED'using errcode='42501';end if;
 if length(coalesce(p_idempotency_key,''))not between 8 and 200 or p_correlation_id is null then raise exception'INVALID_DIAGNOSTIC_COMMAND'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('diagnostic-session:'||s.id::text,0));
 policy:=private.published_client_diagnostic_policy(s.id,p_service_id);
 select*into e from public.questionnaire_session_evaluations where id=(policy->>'evaluation_id')::uuid;
 request_hash:=private.canonical_request_hash(jsonb_build_object('session',s.id,'policy',policy->>'content_hash','evaluation',e.reproducibility_hash));
 cached:=private.begin_contract_command(s.organization_id,'diagnostic.published.'||s.id::text,p_idempotency_key,request_hash,actor);if cached is not null then return cached;end if;
 select*into old_run from public.diagnostic_runs where questionnaire_session_id=s.id and status='COMPLETED';
 if old_run.id is not null and old_run.input_manifest_hash=e.answer_manifest_hash and old_run.scoring_policy_snapshot->>'content_hash'=policy->>'content_hash'then
  result:=jsonb_build_object('outcome','DIAGNOSTIC_COMPLETED','diagnostic_run_id',old_run.id,'score',old_run.overall_score,'rating',old_run.rating,'evaluation_id',e.id,'replayed',true);perform private.finish_contract_command(s.organization_id,'diagnostic.published.'||s.id::text,p_idempotency_key,result);return result;
 end if;
 if old_run.id is not null then update public.diagnostic_runs set status='SUPERSEDED',superseded_at=clock_timestamp()where id=old_run.id;end if;
 score:=e.score_basis_points::numeric/100;rating:=case when score>=80 then'GOOD'when score>=60 then'ATTENTION'when score>=40 then'IMPORTANT'else'CRITICAL'end;
 insert into public.diagnostic_runs(id,organization_id,questionnaire_session_id,library_id,site_id,project_id,status,input_manifest_hash,scoring_policy_snapshot,overall_score,rating,explanation,completed_by,correlation_id)values(run_id,s.organization_id,s.id,s.library_id,s.site_id,s.project_id,'COMPLETED',e.answer_manifest_hash,policy-array['evaluation_id','evaluation_reproducibility_hash','session_snapshot_hash'],score,rating,jsonb_build_object('formula','FINAL_PUBLISHED_RULE_EVALUATION.score_basis_points / 100','questionnaire_version_id',s.questionnaire_version_id,'evaluation_id',e.id,'session_snapshot_hash',policy->>'session_snapshot_hash','evaluation_reproducibility_hash',e.reproducibility_hash,'triggered_actions',e.triggered_actions,'questions_weight_used',false),actor,p_correlation_id);
 insert into public.diagnostic_subscores(diagnostic_run_id,dimension_key,score,weighted_points,maximum_points,explanation)values(run_id,'OVERALL',score,e.score_basis_points,10000,jsonb_build_object('source','PUBLISHED_RULE_ENGINE','evaluation_id',e.id,'engine_version',e.engine_version));
 -- Only actually triggered published anomalies/risks become findings.
 for act in select value from jsonb_array_elements(e.triggered_actions)loop
  i:=i+1;if act->>'type'not in('ANOMALY','RISK')then continue;end if;
  metadata:=coalesce(act->'metadata','{}');rule_id:=(act->>'rule_version_id')::uuid;anomaly_id:=extensions.gen_random_uuid();
  code:=case when act->>'target'~'^[A-Z][A-Z0-9_.-]{1,119}$'then act->>'target'else'RULE_'||upper(replace(rule_id::text,'-',''))||'_A'||i end;
  if exists(select 1 from public.diagnostic_anomalies where diagnostic_run_id=run_id and anomaly_code=code)then code:='RULE_'||upper(replace(rule_id::text,'-',''))||'_A'||i;end if;
  severity:=case when metadata->>'severity'in('INFO','WARNING','HIGH','CRITICAL')then metadata->>'severity'else'UNKNOWN'end;
  title_fr:=coalesce(nullif(btrim(metadata->>'title_fr'),''),nullif(btrim(metadata->>'label_fr'),''),'Constat issu des règles publiées');title_ar:=coalesce(nullif(btrim(metadata->>'title_ar'),''),nullif(btrim(metadata->>'label_ar'),''),'ملاحظة ناتجة عن القواعد المنشورة');
  insert into public.diagnostic_anomalies(id,diagnostic_run_id,organization_id,anomaly_code,severity,blocking,title_fr,title_ar,explanation,rule_snapshot)values(anomaly_id,run_id,s.organization_id,code,severity,coalesce(metadata->'blocking','false')='true'::jsonb or exists(select 1 from jsonb_array_elements(e.triggered_actions)a where a->>'rule_version_id'=rule_id::text and a->>'type'='BLOCK_RFQ'),title_fr,title_ar,jsonb_build_object('published_target',act->>'target','summary',metadata->>'client_text_fr','metadata',metadata,'evaluation_id',e.id),act);
  found_anomalies:=jsonb_set(found_anomalies,array[rule_id::text],coalesce(found_anomalies->rule_id::text,'[]')||jsonb_build_array(jsonb_build_object('id',anomaly_id,'target',act->>'target')));
 end loop;
 -- A recommendation can exist without a finding. No artificial anomaly is created.
 i:=0;
 for act in select value from jsonb_array_elements(e.triggered_actions)loop
  i:=i+1;if act->>'type'<>'RECOMMENDATION'then continue;end if;
  rule_id:=(act->>'rule_version_id')::uuid;metadata:=coalesce(act->'metadata','{}');priority:=private.published_diagnostic_priority(metadata);
  level:=case when metadata->>'solution_level'in('GUIDANCE','ASSISTED','MANAGED')then metadata->>'solution_level'else null end;
  if level is null then select min(a->>'target')into level from jsonb_array_elements(e.triggered_actions)a where a->>'rule_version_id'=rule_id::text and a->>'type'='SOLUTION_LEVEL'and a->>'target'in('GUIDANCE','ASSISTED','MANAGED')having count(distinct a->>'target')=1;end if;
  anomaly_id:=null;rule_anomalies:=coalesce(found_anomalies->rule_id::text,'[]');
  if jsonb_array_length(rule_anomalies)=1 then anomaly_id:=(rule_anomalies->0->>'id')::uuid;elsif metadata->>'anomaly_target'is not null then select(a->>'id')::uuid into anomaly_id from jsonb_array_elements(rule_anomalies)a where a->>'target'=metadata->>'anomaly_target';end if;
  services:='{}';for other in select value from jsonb_array_elements(e.triggered_actions)where value->>'rule_version_id'=rule_id::text and value->>'type'='SUGGEST_SERVICE'loop service_id:=private.published_diagnostic_service(other->>'target',s.library_id);if not(service_id=any(services))then services:=array_append(services,service_id);end if;end loop;
  service_id:=case when cardinality(services)=1 then services[1]when cardinality(services)=0 or p_service_id=any(services)then p_service_id else null end;
  title_fr:=coalesce(nullif(btrim(metadata->>'title_fr'),''),nullif(btrim(metadata->>'label_fr'),''),'Recommandation issue des règles publiées');title_ar:=coalesce(nullif(btrim(metadata->>'title_ar'),''),nullif(btrim(metadata->>'label_ar'),''),'توصية ناتجة عن القواعد المنشورة');
  text_fr:=coalesce(nullif(btrim(metadata->>'client_text_fr'),''),'Le contenu détaillé de cette recommandation n’est pas renseigné dans la règle publiée.');text_ar:=coalesce(nullif(btrim(metadata->>'client_text_ar'),''),'لم يرد المحتوى التفصيلي لهذه التوصية في القاعدة المنشورة.');
  recommendation_id:=extensions.gen_random_uuid();insert into public.diagnostic_recommendations(id,diagnostic_run_id,organization_id,anomaly_id,recommendation_key,priority,title_fr,title_ar,client_text_fr,client_text_ar,service_id,solution_level,rule_snapshot)values(recommendation_id,run_id,s.organization_id,anomaly_id,'RULE_'||upper(replace(rule_id::text,'-',''))||'_A'||i,priority,title_fr,title_ar,text_fr,text_ar,service_id,level,act);
  found_recommendations:=jsonb_set(found_recommendations,array[rule_id::text],coalesce(found_recommendations->rule_id::text,'[]')||jsonb_build_array(jsonb_build_object('id',recommendation_id,'target',act->>'target','service_id',service_id)));
 end loop;
 -- Every opportunity is anchored to its own actual published action. Ambiguous
 -- recommendation links stay null instead of choosing an arbitrary first item.
 i:=0;
 for act in select value from jsonb_array_elements(e.triggered_actions)loop
  i:=i+1;if act->>'type'not in('OPPORTUNITY','SUGGEST_SERVICE')then continue;end if;rule_id:=(act->>'rule_version_id')::uuid;
  if act->>'type'='SUGGEST_SERVICE'and exists(select 1 from jsonb_array_elements(e.triggered_actions)a where a->>'rule_version_id'=rule_id::text and a->>'type'='OPPORTUNITY')then continue;end if;
  metadata:=coalesce(act->'metadata','{}');priority:=private.published_diagnostic_priority(metadata);
  level:=case when metadata->>'solution_level'in('GUIDANCE','ASSISTED','MANAGED')then metadata->>'solution_level'else null end;
  if level is null then select min(a->>'target')into level from jsonb_array_elements(e.triggered_actions)a where a->>'rule_version_id'=rule_id::text and a->>'type'='SOLUTION_LEVEL'and a->>'target'in('GUIDANCE','ASSISTED','MANAGED')having count(distinct a->>'target')=1;end if;
  anomaly_id:=null;rule_anomalies:=coalesce(found_anomalies->rule_id::text,'[]');if jsonb_array_length(rule_anomalies)=1 then anomaly_id:=(rule_anomalies->0->>'id')::uuid;elsif metadata->>'anomaly_target'is not null then select(a->>'id')::uuid into anomaly_id from jsonb_array_elements(rule_anomalies)a where a->>'target'=metadata->>'anomaly_target';end if;
  services:='{}';
  if act->>'type'='SUGGEST_SERVICE'then services:=array[private.published_diagnostic_service(act->>'target',s.library_id)];else
   for other in select value from jsonb_array_elements(e.triggered_actions)where value->>'rule_version_id'=rule_id::text and value->>'type'='SUGGEST_SERVICE'loop service_id:=private.published_diagnostic_service(other->>'target',s.library_id);if not(service_id=any(services))then services:=array_append(services,service_id);end if;end loop;
  end if;
  if cardinality(services)=0 then services:=array_append(services,p_service_id);end if;
  foreach service_id in array services loop
   select coalesce(jsonb_agg(a),'[]')into candidates from jsonb_array_elements(coalesce(found_recommendations->rule_id::text,'[]'))a where(a->>'service_id'is null or a->>'service_id'=service_id::text)and(metadata->>'recommendation_target'is null or a->>'target'=metadata->>'recommendation_target');
   recommendation_id:=case when jsonb_array_length(candidates)=1 then(candidates->0->>'id')::uuid else null end;
   missing:=coalesce(metadata->'missing_fields','[]');if jsonb_typeof(missing)<>'array'then missing:='[]';end if;if service_id is null then missing:=missing||'"published_service"'::jsonb;end if;if level is null then missing:=missing||'"published_solution_level"'::jsonb;end if;
   insert into public.diagnostic_opportunities(organization_id,diagnostic_run_id,anomaly_id,recommendation_id,service_id,solution_level,priority,known_data,missing_fields)values(s.organization_id,run_id,anomaly_id,recommendation_id,service_id,level,priority,jsonb_build_object('diagnostic_score',score,'rating',rating,'evaluation_id',e.id,'rule_version_id',rule_id,'published_target',act->>'target','published_opportunity',metadata,'published_action',act),missing);opportunity_created:=true;
  end loop;
 end loop;
 result:=jsonb_build_object('outcome','DIAGNOSTIC_COMPLETED','diagnostic_run_id',run_id,'score',score,'rating',rating,'evaluation_id',e.id,'opportunity_created',opportunity_created,'replayed',false);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(s.organization_id,actor,'USER','diagnostic.completed','diagnostic_run',run_id::text,p_correlation_id,jsonb_build_object('evaluation_id',e.id,'canonical_policy_hash',policy->>'content_hash','evaluation_reproducibility_hash',e.reproducibility_hash),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(s.organization_id,'diagnostic_run',run_id::text,'DiagnosticCompletedV1',p_correlation_id,result,p_idempotency_key);
 perform private.finish_contract_command(s.organization_id,'diagnostic.published.'||s.id::text,p_idempotency_key,result);return result;
end$$;
-- The old JSON policy route cannot authorize advisory text, weights or services.
create or replace function public.complete_diagnostic_session(p_session_id uuid,p_scoring_policy_snapshot jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$begin raise exception'CANONICAL_DIAGNOSTIC_ENDPOINT_REQUIRED'using errcode='55000';end$$;
revoke all on function private.published_diagnostic_priority(jsonb),private.published_diagnostic_service(text,uuid),private.published_client_diagnostic_policy(uuid,uuid),public.complete_published_client_diagnostic_v1(uuid,uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.complete_published_client_diagnostic_v1(uuid,uuid,text,uuid)to authenticated;
commit;
