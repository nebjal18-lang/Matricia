-- Atomic editing of a DRAFT composition; approved/published snapshots remain immutable.
create or replace function public.save_franchise_questionnaire_composition(
 p_version_id uuid,p_sections jsonb,p_questions jsonb,p_rules jsonb,p_expected_row_version integer,
 p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb language plpgsql security definer set search_path=pg_catalog,extensions,private as $$
declare v public.questionnaire_versions%rowtype;a uuid:=auth.uid();h text;command uuid;replay jsonb;
 section jsonb;question jsonb;selected_rule_id jsonb;rule public.question_rule_versions%rowtype;question_ids text[];section_id uuid;position integer;response jsonb;org uuid;
begin
 select * into v from public.questionnaire_versions where id=p_version_id;
 if a is null or not found or not private.has_library_permission(v.library_id,'CATALOG_EDIT',a) then raise exception 'CATALOG_SCOPE_DENIED' using errcode='42501';end if;
 if jsonb_typeof(p_sections) is distinct from 'array' or jsonb_array_length(p_sections) not between 1 and 100
 or jsonb_typeof(p_rules) is distinct from 'array' or jsonb_array_length(p_rules)>500
 or jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions)>5000 then raise exception 'INVALID_QUESTIONNAIRE_COMPOSITION' using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('version',p_version_id,'sections',p_sections,'questions',p_questions,'rules',p_rules,'expected',p_expected_row_version));
 select b.command_id,b.response_body into command,replay from private.begin_catalog_command(a,'catalog.questionnaire.composition.save',p_idempotency_key,h)b;
 perform pg_advisory_xact_lock(hashtextextended('catalog-questionnaire-version:'||p_version_id::text,0));
 select * into v from public.questionnaire_versions where id=p_version_id for update;
 perform private.assert_catalog_permission_locked(v.library_id,'CATALOG_EDIT',a);
 if replay is not null then return replay;end if;
 if v.status<>'DRAFT' then raise exception 'CATALOG_QUESTIONNAIRE_NOT_EDITABLE' using errcode='55000';end if;
 if v.row_version is distinct from p_expected_row_version then raise exception 'STALE_CATALOG_VERSION' using errcode='40001';end if;
 if v.sensitive and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED' using errcode='42501';end if;
 for section in select value from jsonb_array_elements(p_sections) loop
   if coalesce(section->>'key','')!~'^[A-Z][A-Z0-9_-]{1,79}$' or length(btrim(coalesce(section->>'labelFr','')))not between 1 and 240
   or length(btrim(coalesce(section->>'labelAr','')))not between 1 and 240 then raise exception 'INVALID_QUESTIONNAIRE_SECTION' using errcode='22023';end if;
 end loop;
 if (select count(distinct q.question_id) from jsonb_array_elements(p_questions)j join public.question_versions q on q.id=(j->>'versionId')::uuid)<>jsonb_array_length(p_questions) then raise exception 'DUPLICATE_QUESTIONNAIRE_QUESTION' using errcode='22023';end if;
 if (select count(distinct value->>'key') from jsonb_array_elements(p_sections))<>jsonb_array_length(p_sections)
 or (select count(distinct value->>'versionId')from jsonb_array_elements(p_questions))<>jsonb_array_length(p_questions)
 then raise exception 'DUPLICATE_QUESTIONNAIRE_ELEMENT' using errcode='22023';end if;
 for question in select value from jsonb_array_elements(p_questions) loop
   if not exists(select 1 from public.question_versions q where q.id=(question->>'versionId')::uuid and q.library_id=v.library_id and q.status in('APPROVED','PUBLISHED'))
   or not exists(select 1 from jsonb_array_elements(p_sections)s where s->>'key'=question->>'sectionKey')
   or jsonb_typeof(question->'required') is distinct from 'boolean' then raise exception 'CATALOG_QUESTIONNAIRE_LINK_NOT_FOUND' using errcode='P0002';end if;
   if exists(select 1 from public.question_versions q where q.id=(question->>'versionId')::uuid and q.sensitivity in('CONFIDENTIAL','RESTRICTED')) and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED' using errcode='42501';end if;
 end loop;
 select coalesce(array_agg(value->>'versionId'),'{}'::text[]) into question_ids from jsonb_array_elements(p_questions);
 if(select count(distinct value)from jsonb_array_elements(p_rules))<>jsonb_array_length(p_rules)then raise exception 'DUPLICATE_QUESTIONNAIRE_RULE' using errcode='22023';end if;
 for selected_rule_id in select value from jsonb_array_elements(p_rules)loop
   select * into rule from public.question_rule_versions where id=(selected_rule_id#>>'{}')::uuid and library_id=v.library_id and status in('APPROVED','PUBLISHED');
   if not found then raise exception 'CATALOG_QUESTIONNAIRE_RULE_NOT_FOUND' using errcode='P0002';end if;
   if rule.sensitive and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED' using errcode='42501';end if;
   perform private.assert_advanced_rule_contract(rule.condition_ast,rule.actions,rule.dependency_graph,question_ids);
 end loop;
 delete from public.questionnaire_version_rules where questionnaire_version_id=v.id;
 delete from public.questionnaire_version_questions where questionnaire_version_id=v.id;
 delete from public.questionnaire_sections where questionnaire_version_id=v.id;
 position:=0;
 for section in select value from jsonb_array_elements(p_sections)loop
   position:=position+1;
   insert into public.questionnaire_sections(questionnaire_version_id,section_key,label_fr,label_ar,sort_order,help_fr,help_ar,content_hash)
   values(v.id,section->>'key',btrim(section->>'labelFr'),btrim(section->>'labelAr'),position,section->>'helpFr',section->>'helpAr',private.canonical_request_hash(section));
 end loop;
 position:=0;
 for question in select value from jsonb_array_elements(p_questions)loop
   position:=position+1;
   select id into section_id from public.questionnaire_sections where questionnaire_version_id=v.id and section_key=question->>'sectionKey';
   insert into public.questionnaire_version_questions(questionnaire_version_id,library_id,section_id,question_version_id,sort_order,required_override)
   values(v.id,v.library_id,section_id,(question->>'versionId')::uuid,position,(question->>'required')::boolean);
 end loop;
 position:=0;
 for selected_rule_id in select value from jsonb_array_elements(p_rules)loop
   position:=position+1;
   insert into public.questionnaire_version_rules(questionnaire_version_id,library_id,rule_version_id,evaluation_order)values(v.id,v.library_id,(selected_rule_id#>>'{}')::uuid,position);
 end loop;
 h:=private.refresh_draft_questionnaire_snapshot(v.id);
 select steward_organization_id into org from public.catalog_libraries where id=v.library_id;
 response:=jsonb_build_object('outcome','QUESTIONNAIRE_COMPOSITION_SAVED','version_id',v.id,'row_version',v.row_version+1,'snapshot_hash',h);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)
 values(org,a,'USER','catalog.questionnaire.composition_saved','catalog_questionnaire',v.questionnaire_id::text,p_correlation_id,jsonb_build_object('version',v.id,'questions',jsonb_array_length(p_questions),'sections',jsonb_array_length(p_sections)),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)
 values(org,'catalog_questionnaire',v.questionnaire_id::text,'QuestionnaireCompositionSavedV1',p_correlation_id,response,p_idempotency_key,command);
 perform private.finish_catalog_command(a,'catalog.questionnaire.composition.save',p_idempotency_key,response);return response;
end$$;
revoke all on function public.save_franchise_questionnaire_composition(uuid,jsonb,jsonb,jsonb,integer,text,uuid) from public,anon,service_role;
grant execute on function public.save_franchise_questionnaire_composition(uuid,jsonb,jsonb,jsonb,integer,text,uuid) to authenticated;
