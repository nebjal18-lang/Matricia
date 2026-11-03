-- A draft questionnaire can compose draft snapshots. The central bundle review is explicit,
-- four-eyes/AAL2 and immutable; the original publication trigger is unchanged.
create table public.franchise_questionnaire_bundle_reviews(
 change_request_id uuid primary key references public.catalog_change_requests(id)on delete restrict,
 library_id uuid not null references public.catalog_libraries(id)on delete restrict,
 questionnaire_version_id uuid not null references public.questionnaire_versions(id)on delete restrict,
 decision text not null check(decision in('APPROVE','REJECT')),
 translation_confirmed boolean not null,
 reviewed_by uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason))between 3 and 1000),
 review_snapshot jsonb not null check(jsonb_typeof(review_snapshot)='object'),
 review_proof_hash text not null check(review_proof_hash~'^[0-9a-f]{64}$'),
 reviewed_at timestamptz not null default clock_timestamp(),
 check(decision<>'APPROVE'or translation_confirmed)
);
alter table public.franchise_questionnaire_bundle_reviews enable row level security;
create policy franchise_questionnaire_bundle_reviews_read on public.franchise_questionnaire_bundle_reviews for select to authenticated using(private.has_library_permission(library_id,'CATALOG_VIEW_DRAFT',auth.uid())and(auth.jwt()->>'aal'='aal2'or not private.has_any_questionnaire_platform_role()));
revoke all on public.franchise_questionnaire_bundle_reviews from public,anon,authenticated,service_role;
grant select on public.franchise_questionnaire_bundle_reviews to authenticated;
create function private.prevent_questionnaire_bundle_review_mutation()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin raise exception 'IMMUTABLE_CATALOG_REVIEW_SNAPSHOT'using errcode='55000';end$$;
revoke all on function private.prevent_questionnaire_bundle_review_mutation()from public,anon,authenticated,service_role;
create trigger franchise_questionnaire_bundle_reviews_immutable before update or delete on public.franchise_questionnaire_bundle_reviews for each row execute function private.prevent_questionnaire_bundle_review_mutation();

-- Retain the existing central command as the authoritative core, including its
-- idempotence and four-eyes checks. Legacy approval must not falsely approve draft children.
alter function public.decide_catalog_change(uuid,text,text,integer,text,uuid)rename to decide_catalog_change_before_questionnaire_bundle;
alter function public.decide_catalog_change_before_questionnaire_bundle(uuid,text,text,integer,text,uuid)set schema private;
revoke all on function private.decide_catalog_change_before_questionnaire_bundle(uuid,text,text,integer,text,uuid)from public,anon,authenticated,service_role;
create function public.decide_catalog_change(p_change_request_id uuid,p_decision text,p_reason text,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare request public.catalog_change_requests%rowtype;
begin
 if p_decision='APPROVE'then
  perform pg_advisory_xact_lock(hashtextextended('catalog-change:'||p_change_request_id::text,0));
  select*into request from public.catalog_change_requests where id=p_change_request_id for update;
  if request.target_type='QUESTIONNAIRE'then
   begin perform private.assert_catalog_central_aal2_locked(auth.uid());exception when insufficient_privilege then raise exception 'CATALOG_APPROVAL_DENIED'using errcode='42501';end;
   if not private.has_library_permission(request.library_id,'CATALOG_APPROVE',auth.uid())then raise exception 'CATALOG_APPROVAL_DENIED'using errcode='42501';end if;
   if not exists(select 1 from public.questionnaire_version_questions where questionnaire_version_id=request.target_version_id)or exists(select 1 from public.questionnaire_version_questions l join public.question_versions q on q.id=l.question_version_id where l.questionnaire_version_id=request.target_version_id and q.status not in('APPROVED','PUBLISHED'))or exists(select 1 from public.questionnaire_version_rules l join public.question_rule_versions r on r.id=l.rule_version_id where l.questionnaire_version_id=request.target_version_id and r.status not in('APPROVED','PUBLISHED'))then raise exception 'CATALOG_BUNDLE_REVIEW_REQUIRED'using errcode='55000';end if;
  end if;
 end if;
 return private.decide_catalog_change_before_questionnaire_bundle(p_change_request_id,p_decision,p_reason,p_expected_row_version,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.decide_catalog_change(uuid,text,text,integer,text,uuid)from public,anon,service_role;
grant execute on function public.decide_catalog_change(uuid,text,text,integer,text,uuid)to authenticated;

create function public.catalog_questionnaire_review_queue(p_page integer default 1)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform private.assert_catalog_central_aal2_locked(auth.uid());
 if p_page is null or p_page not between 1 and 100000 then raise exception 'INVALID_CATALOG_REVIEW_PAGE'using errcode='22023';end if;
 with pending as(select cr.*,v.title_fr,v.title_ar,q.code from public.catalog_change_requests cr join public.questionnaire_versions v on v.id=cr.target_version_id and v.library_id=cr.library_id join public.questionnaires q on q.id=v.questionnaire_id where cr.target_type='QUESTIONNAIRE'and cr.status='IN_REVIEW'and private.has_library_permission(cr.library_id,'CATALOG_APPROVE',auth.uid())),
 paged as(select*from pending order by requested_at,id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('total',(select count(*)from pending),'page',p_page,'pageSize',25,'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'libraryId',library_id,'code',code,'titleFr',title_fr,'titleAr',title_ar,'rowVersion',row_version,'requestedAt',requested_at,'requestedBy',requested_by)order by requested_at,id)from paged),'[]'::jsonb))into result;
 return result;
end$$;

create function public.catalog_questionnaire_review_bundle(p_change_request_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare request public.catalog_change_requests%rowtype;result jsonb;
begin
 perform private.assert_catalog_central_aal2_locked(auth.uid());
 select*into request from public.catalog_change_requests where id=p_change_request_id and target_type='QUESTIONNAIRE';
 if request.id is null or not private.has_library_permission(request.library_id,'CATALOG_APPROVE',auth.uid())then raise exception 'CATALOG_APPROVAL_DENIED'using errcode='42501';end if;
 select jsonb_build_object('request',jsonb_build_object('id',request.id,'rowVersion',request.row_version,'requestedBy',request.requested_by,'requestedAt',request.requested_at),'questionnaire',to_jsonb(v),'sections',coalesce((select jsonb_agg(to_jsonb(s)order by s.sort_order,s.id)from public.questionnaire_sections s where s.questionnaire_version_id=v.id),'[]'::jsonb),'questions',coalesce((select jsonb_agg(to_jsonb(q)||jsonb_build_object('compositionOrder',l.sort_order,'sectionId',l.section_id,'requiredOverride',l.required_override)order by l.sort_order,q.id)from public.questionnaire_version_questions l join public.question_versions q on q.id=l.question_version_id and q.library_id=request.library_id where l.questionnaire_version_id=v.id),'[]'::jsonb),'rules',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('evaluationOrder',l.evaluation_order)order by l.evaluation_order,r.id)from public.questionnaire_version_rules l join public.question_rule_versions r on r.id=l.rule_version_id and r.library_id=request.library_id where l.questionnaire_version_id=v.id),'[]'::jsonb))into result from public.questionnaire_versions v where v.id=request.target_version_id and v.library_id=request.library_id;
 if result is null then raise exception 'CATALOG_VERSION_NOT_FOUND'using errcode='P0002';end if;
 return result;
end$$;

create function public.decide_franchise_questionnaire_bundle(p_change_request_id uuid,p_decision text,p_reason text,p_expected_row_version integer,p_translation_confirmed boolean,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();request public.catalog_change_requests%rowtype;version public.questionnaire_versions%rowtype;question public.question_versions%rowtype;rule public.question_rule_versions%rowtype;identity public.question_bank_questions%rowtype;rule_identity public.question_rules%rowtype;snapshot jsonb;proof text;h text;command uuid;replay jsonb;result jsonb;question_ids text[];
begin
 perform private.assert_catalog_central_aal2_locked(actor);
 if p_translation_confirmed is null or(p_decision='APPROVE'and not p_translation_confirmed)then raise exception 'CATALOG_TRANSLATION_CONFIRMATION_REQUIRED'using errcode='23514';end if;
 if p_decision is null or p_decision not in('APPROVE','REJECT')or p_expected_row_version is null or p_expected_row_version<1 or length(btrim(coalesce(p_reason,'')))not between 3 and 1000 then raise exception 'INVALID_CATALOG_DECISION'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-change:'||p_change_request_id::text,0));
 select*into request from public.catalog_change_requests where id=p_change_request_id and target_type='QUESTIONNAIRE'for update;
 if request.id is null then raise exception 'CATALOG_CHANGE_NOT_FOUND'using errcode='P0002';end if;
 perform private.assert_catalog_permission_locked(request.library_id,'CATALOG_APPROVE',actor);
 if request.requested_by=actor then raise exception 'CATALOG_SELF_APPROVAL_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request',p_change_request_id,'decision',p_decision,'reason',btrim(p_reason),'expected',p_expected_row_version,'translations',p_translation_confirmed));
 select b.command_id,b.response_body into command,replay from private.begin_catalog_command(actor,'catalog.questionnaire.bundle.review',p_idempotency_key,h)b;
 if replay is not null then return replay;end if;
 select*into version from public.questionnaire_versions where id=request.target_version_id and library_id=request.library_id for update;
 if version.id is null then raise exception 'CATALOG_VERSION_NOT_FOUND'using errcode='P0002';end if;
 -- Lock the precise versions reviewed; a concurrent edit creates another version and cannot
 -- change these references or the content being approved.
 perform 1 from public.question_bank_questions i join public.question_versions q on q.question_id=i.id join public.questionnaire_version_questions l on l.question_version_id=q.id where l.questionnaire_version_id=version.id order by i.id for update of i;
 perform 1 from public.question_rules i join public.question_rule_versions r on r.rule_id=i.id join public.questionnaire_version_rules l on l.rule_version_id=r.id where l.questionnaire_version_id=version.id order by i.id for update of i;
 perform 1 from public.question_versions q join public.questionnaire_version_questions l on l.question_version_id=q.id where l.questionnaire_version_id=version.id order by q.id for update of q;
 perform 1 from public.question_rule_versions r join public.questionnaire_version_rules l on l.rule_version_id=r.id where l.questionnaire_version_id=version.id order by r.id for update of r;
 snapshot:=public.catalog_questionnaire_review_bundle(p_change_request_id);proof:=private.canonical_request_hash(snapshot);
 if p_decision='APPROVE'then
  if version.created_by=actor then raise exception 'CATALOG_SELF_APPROVAL_DENIED'using errcode='42501';end if;
  if not exists(select 1 from public.questionnaire_version_questions where questionnaire_version_id=version.id)then raise exception 'QUESTIONNAIRE_HAS_NO_QUESTIONS'using errcode='23514';end if;
  if exists(select 1 from public.question_versions q join public.questionnaire_version_questions l on l.question_version_id=q.id where l.questionnaire_version_id=version.id and(q.library_id<>request.library_id or q.status not in('DRAFT','APPROVED','PUBLISHED')or not private.is_valid_question_metadata(q)or(q.status='PUBLISHED'and q.translation_review_status<>'APPROVED')))then raise exception 'QUESTIONNAIRE_QUESTION_METADATA_INVALID'using errcode='23514';end if;
  if exists(select 1 from public.question_versions q join public.questionnaire_version_questions l on l.question_version_id=q.id where l.questionnaire_version_id=version.id and q.status<>'PUBLISHED'and q.created_by=actor)or exists(select 1 from public.question_rule_versions r join public.questionnaire_version_rules l on l.rule_version_id=r.id where l.questionnaire_version_id=version.id and r.status<>'PUBLISHED'and r.created_by=actor)then raise exception 'CATALOG_SELF_APPROVAL_DENIED'using errcode='42501';end if;
  select coalesce(array_agg(question_version_id::text),'{}')into question_ids from public.questionnaire_version_questions where questionnaire_version_id=version.id;
  for rule in select r.*from public.question_rule_versions r join public.questionnaire_version_rules l on l.rule_version_id=r.id where l.questionnaire_version_id=version.id loop
   if rule.library_id<>request.library_id or rule.status not in('DRAFT','APPROVED','PUBLISHED')then raise exception 'RULE_VERSION_NOT_PUBLISHABLE'using errcode='23514';end if;
   perform private.assert_advanced_rule_contract(rule.condition_ast,rule.actions,rule.dependency_graph,question_ids);
  end loop;
 end if;
 -- Existing command retains central authorization, two-person decision, expected version,
 -- durable idempotence, audit and Outbox. Any later failure rolls back this whole bundle.
 result:=private.decide_catalog_change_before_questionnaire_bundle(p_change_request_id,p_decision,p_reason,p_expected_row_version,p_idempotency_key,p_correlation_id);
 if p_decision='APPROVE'then
  for question in select q.*from public.question_versions q join public.questionnaire_version_questions l on l.question_version_id=q.id where l.questionnaire_version_id=version.id and q.status<>'PUBLISHED'order by q.question_id,q.id loop
   select*into identity from public.question_bank_questions where id=question.question_id for update;
   if identity.status='ARCHIVED'then raise exception 'CATALOG_QUESTION_NOT_EDITABLE'using errcode='55000';end if;
   if identity.current_published_version_id is not null and identity.current_published_version_id<>question.id then update public.question_versions set status='SUPERSEDED',superseded_at=clock_timestamp(),row_version=row_version+1 where id=identity.current_published_version_id and status='PUBLISHED';end if;
   update public.question_versions set status='PUBLISHED',published_at=clock_timestamp(),superseded_at=null,translation_review_status='APPROVED',translation_reviewer_user_id=actor,translation_reviewed_at=clock_timestamp(),translation_review_proof_hash=proof,translation_review_version=translation_review_version+1,row_version=row_version+1 where id=question.id;
   update public.question_bank_questions set status='PUBLISHED',current_published_version_id=question.id,current_draft_version_id=case when current_draft_version_id=question.id then null else current_draft_version_id end,row_version=row_version+1 where id=question.question_id;
  end loop;
  for rule in select r.*from public.question_rule_versions r join public.questionnaire_version_rules l on l.rule_version_id=r.id where l.questionnaire_version_id=version.id and r.status<>'PUBLISHED'order by r.rule_id,r.id loop
   select*into rule_identity from public.question_rules where id=rule.rule_id for update;
   if rule_identity.status='ARCHIVED'then raise exception 'CATALOG_RULE_NOT_EDITABLE'using errcode='55000';end if;
   if rule_identity.current_published_version_id is not null and rule_identity.current_published_version_id<>rule.id then update public.question_rule_versions set status='SUPERSEDED',superseded_at=clock_timestamp(),row_version=row_version+1 where id=rule_identity.current_published_version_id and status='PUBLISHED';end if;
   update public.question_rule_versions set status='PUBLISHED',published_at=clock_timestamp(),superseded_at=null,row_version=row_version+1 where id=rule.id;
   update public.question_rules set status='PUBLISHED',current_published_version_id=rule.id,current_draft_version_id=case when current_draft_version_id=rule.id then null else current_draft_version_id end,row_version=row_version+1 where id=rule.rule_id;
  end loop;
  update public.questionnaire_versions set translation_review_status='APPROVED',translation_reviewer_user_id=actor,translation_reviewed_at=clock_timestamp(),translation_review_proof_hash=proof,translation_review_version=translation_review_version+1,row_version=row_version+1 where id=version.id;
 end if;
 insert into public.franchise_questionnaire_bundle_reviews(change_request_id,library_id,questionnaire_version_id,decision,translation_confirmed,reviewed_by,reason,review_snapshot,review_proof_hash)values(request.id,request.library_id,version.id,p_decision,p_translation_confirmed,actor,btrim(p_reason),snapshot,proof);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values((select steward_organization_id from public.catalog_libraries where id=request.library_id),actor,'USER','catalog.questionnaire.bundle_reviewed','catalog_questionnaire',version.questionnaire_id::text,p_correlation_id,jsonb_build_object('change_request_id',request.id,'decision',p_decision,'review_proof_hash',proof,'translation_confirmed',p_translation_confirmed),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key,causation_id)values((select steward_organization_id from public.catalog_libraries where id=request.library_id),'catalog_questionnaire',version.questionnaire_id::text,'QuestionnaireBundleReviewedV1',p_correlation_id,jsonb_build_object('change_request_id',request.id,'decision',p_decision,'review_proof_hash',proof),p_idempotency_key,command);
 result:=result||jsonb_build_object('reviewProofHash',proof,'questionnaireVersionId',version.id,'questionnaireRowVersion',(select row_version from public.questionnaire_versions where id=version.id));perform private.finish_catalog_command(actor,'catalog.questionnaire.bundle.review',p_idempotency_key,result);return result;
end$$;
revoke all on function public.catalog_questionnaire_review_queue(integer),public.catalog_questionnaire_review_bundle(uuid),public.decide_franchise_questionnaire_bundle(uuid,text,text,integer,boolean,text,uuid)from public,anon,service_role;
grant execute on function public.catalog_questionnaire_review_queue(integer),public.catalog_questionnaire_review_bundle(uuid),public.decide_franchise_questionnaire_bundle(uuid,text,text,integer,boolean,text,uuid)to authenticated;

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
 if (v.sensitive or exists(select 1 from public.questionnaire_version_questions l join public.question_versions q on q.id=l.question_version_id where l.questionnaire_version_id=v.id and q.sensitivity in('CONFIDENTIAL','RESTRICTED'))or exists(select 1 from public.questionnaire_version_rules l join public.question_rule_versions r on r.id=l.rule_version_id where l.questionnaire_version_id=v.id and r.sensitive))and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED' using errcode='42501';end if;
 for section in select value from jsonb_array_elements(p_sections) loop
   if coalesce(section->>'key','')!~'^[A-Z][A-Z0-9_-]{1,79}$' or length(btrim(coalesce(section->>'labelFr','')))not between 1 and 240
   or length(btrim(coalesce(section->>'labelAr','')))not between 1 and 240 then raise exception 'INVALID_QUESTIONNAIRE_SECTION' using errcode='22023';end if;
 end loop;
 if (select count(distinct q.question_id) from jsonb_array_elements(p_questions)j join public.question_versions q on q.id=(j->>'versionId')::uuid)<>jsonb_array_length(p_questions) then raise exception 'DUPLICATE_QUESTIONNAIRE_QUESTION' using errcode='22023';end if;
 if (select count(distinct value->>'key') from jsonb_array_elements(p_sections))<>jsonb_array_length(p_sections)
 or (select count(distinct value->>'versionId')from jsonb_array_elements(p_questions))<>jsonb_array_length(p_questions)
 then raise exception 'DUPLICATE_QUESTIONNAIRE_ELEMENT' using errcode='22023';end if;
 for question in select value from jsonb_array_elements(p_questions) loop
   if not exists(select 1 from public.question_versions q where q.id=(question->>'versionId')::uuid and q.library_id=v.library_id and q.status in('DRAFT','APPROVED','PUBLISHED'))
   or not exists(select 1 from jsonb_array_elements(p_sections)s where s->>'key'=question->>'sectionKey')
   or jsonb_typeof(question->'required') is distinct from 'boolean' then raise exception 'CATALOG_QUESTIONNAIRE_LINK_NOT_FOUND' using errcode='P0002';end if;
   if exists(select 1 from public.question_versions q where q.id=(question->>'versionId')::uuid and q.sensitivity in('CONFIDENTIAL','RESTRICTED')) and auth.jwt()->>'aal' is distinct from 'aal2' then raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED' using errcode='42501';end if;
 end loop;
 select coalesce(array_agg(value->>'versionId'),'{}'::text[]) into question_ids from jsonb_array_elements(p_questions);
 if(select count(distinct r.rule_id)from jsonb_array_elements_text(p_rules)j(value) join public.question_rule_versions r on r.id=j.value::uuid)<>jsonb_array_length(p_rules)then raise exception 'DUPLICATE_QUESTIONNAIRE_RULE'using errcode='22023';end if;
 if(select count(distinct value)from jsonb_array_elements(p_rules))<>jsonb_array_length(p_rules)then raise exception 'DUPLICATE_QUESTIONNAIRE_RULE' using errcode='22023';end if;
 for selected_rule_id in select value from jsonb_array_elements(p_rules)loop
   select * into rule from public.question_rule_versions where id=(selected_rule_id#>>'{}')::uuid and library_id=v.library_id and status in('DRAFT','APPROVED','PUBLISHED');
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

create or replace function public.franchise_catalog_bank(p_franchise_id uuid,p_kind text,p_search text default'',p_page integer default 1)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare lib uuid;result jsonb;
begin
 lib:=private.franchise_catalog_reader_library(p_franchise_id);
 if p_kind is null or p_page is null or p_search is null or p_kind not in('QUESTION','RULE')or p_page not between 1 and 100000 or length(p_search)>120 then raise exception 'INVALID_FRANCHISE_CATALOG_PAGE'using errcode='22023';end if;

 with candidates as(
 select v.id,v.question_id object_id,q.question_key code,v.label_fr fr,v.label_ar ar,v.answer_type,v.status,v.version from public.question_versions v join public.question_bank_questions q on q.id=v.question_id where p_kind='QUESTION'and v.library_id=lib and v.status in('DRAFT','APPROVED','PUBLISHED')and(v.status<>'DRAFT'or v.id=q.current_draft_version_id)and q.status<>'ARCHIVED'
 union all select v.id,v.rule_id,r.rule_key,r.rule_key,r.rule_key,null,v.status,v.version from public.question_rule_versions v join public.question_rules r on r.id=v.rule_id where p_kind='RULE'and v.library_id=lib and v.status in('DRAFT','APPROVED','PUBLISHED')and(v.status<>'DRAFT'or v.id=r.current_draft_version_id)and r.status<>'ARCHIVED'),
 filtered as(select*from candidates where p_search=''or position(lower(p_search)in lower(code||' '||fr||' '||ar))>0),
 paged as(select*from filtered order by code,version desc,id limit 25 offset(p_page-1)*25)
 select jsonb_build_object('total',(select count(*)from filtered),'page',p_page,'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'objectId',object_id,'code',code,'labelFr',fr,'labelAr',ar,'answerType',answer_type,'status',status,'version',version)order by code,version desc,id)from paged),'[]'::jsonb))into result;
 return result;
end$$;
revoke all on function public.franchise_catalog_bank(uuid,text,text,integer)from public,anon,service_role;
grant execute on function public.franchise_catalog_bank(uuid,text,text,integer)to authenticated;

create or replace function public.submit_franchise_catalog_questionnaire(
  p_questionnaire_id uuid,
  p_version_id uuid,
  p_expected_identity_row_version integer,
  p_expected_version_row_version integer,
  p_idempotency_key text,
  p_correlation_id uuid default extensions.gen_random_uuid()
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, extensions, private
as $$
declare
  v_actor uuid := auth.uid();
  v_identity public.questionnaires%rowtype;
  v_version public.questionnaire_versions%rowtype;
  v_org uuid;
  v_hash text;
  v_command uuid;
  v_replay jsonb;
  v_request uuid;
  v_response jsonb;
begin
  if p_questionnaire_id is null or p_version_id is null
     or p_expected_identity_row_version is null or p_expected_identity_row_version < 1
     or p_expected_version_row_version is null or p_expected_version_row_version < 1
  then
    raise exception 'INVALID_CATALOG_CHANGE' using errcode = '22023';
  end if;
  if v_actor is null then
    raise exception 'CATALOG_SCOPE_DENIED' using errcode = '42501';
  end if;
  select * into v_identity from public.questionnaires where id = p_questionnaire_id;
  if not found or not private.has_library_permission(v_identity.library_id, 'CATALOG_SUBMIT', v_actor) then
    raise exception 'CATALOG_SCOPE_DENIED' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('catalog-object:QUESTIONNAIRE:' || p_questionnaire_id::text, 0));
  select * into v_identity from public.questionnaires where id = p_questionnaire_id for update;
  select * into v_version from public.questionnaire_versions where id = p_version_id and questionnaire_id = p_questionnaire_id for update;
  if not found then
    raise exception 'CATALOG_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform private.assert_catalog_permission_locked(v_identity.library_id, 'CATALOG_SUBMIT', v_actor);
  if(v_version.sensitive or exists(select 1 from public.questionnaire_version_questions l join public.question_versions q on q.id=l.question_version_id where l.questionnaire_version_id=v_version.id and q.sensitivity in('CONFIDENTIAL','RESTRICTED'))or exists(select 1 from public.questionnaire_version_rules l join public.question_rule_versions r on r.id=l.rule_version_id where l.questionnaire_version_id=v_version.id and r.sensitive))and auth.jwt()->>'aal' is distinct from 'aal2' then
    raise exception 'CATALOG_SENSITIVE_MFA_REQUIRED' using errcode = '42501';
  end if;
  v_hash := private.canonical_request_hash(jsonb_build_object(
    'operation', 'catalog.questionnaire.submit.v1',
    'questionnaire_id', p_questionnaire_id,
    'version_id', p_version_id,
    'expected_identity', p_expected_identity_row_version,
    'expected_version', p_expected_version_row_version
  ));
  select b.command_id, b.response_body into v_command, v_replay
    from private.begin_catalog_command(v_actor, 'catalog.questionnaire.submit', p_idempotency_key, v_hash) b;
  if v_replay is not null then
    return v_replay;
  end if;
  if v_identity.row_version is distinct from p_expected_identity_row_version
     or v_version.row_version is distinct from p_expected_version_row_version
  then
    raise exception 'STALE_CATALOG_VERSION' using errcode = '40001';
  end if;
  if p_version_id is distinct from coalesce(v_identity.current_draft_version_id, v_identity.current_published_version_id) then
    raise exception 'CATALOG_VERSION_NOT_CURRENT' using errcode = '55000';
  end if;
  if v_identity.status is distinct from 'DRAFT'
     or v_version.status not in ('DRAFT', 'LOCAL_TEST', 'FRANCHISE_REVIEW')
  then
    raise exception 'INVALID_CATALOG_VERSION_STATE' using errcode = '55000';
  end if;
  insert into public.catalog_change_requests(library_id, target_type, target_id, target_version_id, sensitive, requested_by)
  values (v_identity.library_id, 'QUESTIONNAIRE', p_questionnaire_id, p_version_id, v_version.sensitive, v_actor)
  returning id into v_request;
  update public.questionnaire_versions set status = 'CENTRAL_REVIEW', row_version = row_version + 1 where id = p_version_id;
  update public.questionnaires set row_version = row_version + 1 where id = p_questionnaire_id;
  select steward_organization_id into v_org from public.catalog_libraries where id = v_identity.library_id;
  v_response := jsonb_build_object(
    'outcome', 'CATALOG_CHANGE_SUBMITTED',
    'change_request_id', v_request,
    'object_type', 'QUESTIONNAIRE',
    'object_id', p_questionnaire_id,
    'version_id', p_version_id,
    'identity_row_version', p_expected_identity_row_version + 1,
    'version_row_version', p_expected_version_row_version + 1,
    'sensitive', v_version.sensitive,
    'command_id', v_command
  );
  insert into public.audit_events(organization_id, actor_user_id, actor_type, action, resource_type, resource_id, correlation_id, metadata, previous_hash, event_hash)
  values (
    v_org, v_actor, 'USER', 'catalog.change.submitted', 'catalog_change_request', v_request::text, p_correlation_id,
    jsonb_build_object('object_type', 'QUESTIONNAIRE', 'object_id', p_questionnaire_id, 'version_id', p_version_id, 'sensitive', v_version.sensitive, 'command_id', v_command),
    v_version.snapshot_hash, repeat('0', 64)
  );
  insert into public.event_outbox(organization_id, aggregate_type, aggregate_id, event_type, correlation_id, payload, idempotency_key, causation_id)
  values (
    v_org, 'catalog_change_request', v_request::text, 'CatalogChangeSubmittedV1', p_correlation_id,
    jsonb_build_object('change_request_id', v_request, 'object_type', 'QUESTIONNAIRE', 'object_id', p_questionnaire_id, 'version_id', p_version_id, 'sensitive', v_version.sensitive),
    p_idempotency_key, v_command
  );
  perform private.finish_catalog_command(v_actor, 'catalog.questionnaire.submit', p_idempotency_key, v_response);
  return v_response;
end;
$$;
