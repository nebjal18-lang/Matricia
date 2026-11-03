-- Central editorial review for standalone catalogue objects. Existing decision,
-- translation and publication commands remain authoritative.
create table public.catalog_editorial_review_snapshots(
 change_request_id uuid primary key references public.catalog_change_requests(id)on delete restrict,
 library_id uuid not null references public.catalog_libraries(id)on delete restrict,
 decision text not null check(decision in('APPROVE','REJECT')),
 translation_confirmed boolean not null,reviewed_by uuid not null references auth.users(id),
 reason text not null check(length(btrim(reason))between 3 and 1000),
 review_snapshot jsonb not null check(jsonb_typeof(review_snapshot)='object'),
 review_proof_hash text not null check(review_proof_hash~'^[0-9a-f]{64}$'),
 reviewed_at timestamptz not null default clock_timestamp(),check(decision<>'APPROVE'or translation_confirmed)
);
alter table public.catalog_editorial_review_snapshots enable row level security;
create policy catalog_editorial_review_snapshots_read on public.catalog_editorial_review_snapshots for select to authenticated using(private.has_library_permission(library_id,'CATALOG_VIEW_DRAFT',auth.uid())and(auth.jwt()->>'aal'='aal2'or not private.has_any_questionnaire_platform_role()));
revoke all on public.catalog_editorial_review_snapshots from public,anon,authenticated,service_role;
grant select on public.catalog_editorial_review_snapshots to authenticated;
create trigger catalog_editorial_review_snapshots_immutable before update or delete on public.catalog_editorial_review_snapshots for each row execute function private.prevent_questionnaire_bundle_review_mutation();

create function private.catalog_editorial_object(p_kind text,p_object_id uuid,p_version_id uuid,p_library_id uuid,p_include_items boolean default true)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 if p_kind='LIBRARY'then
 select jsonb_build_object('identity',to_jsonb(i),'version',to_jsonb(v),'previousVersion',(select to_jsonb(p)from public.catalog_library_versions p where p.id=i.current_published_version_id),'releaseItems','[]'::jsonb)into result from public.catalog_libraries i join public.catalog_library_versions v on v.library_id=i.id where i.id=p_object_id and i.id=p_library_id and v.id=p_version_id and v.library_id=p_library_id;
 elsif p_kind='CATEGORY'then
 select jsonb_build_object('identity',to_jsonb(i),'version',to_jsonb(v),'previousVersion',(select to_jsonb(p)from public.catalog_category_versions p where p.id=i.current_published_version_id),'releaseItems','[]'::jsonb)into result from public.catalog_categories i join public.catalog_category_versions v on v.category_id=i.id where i.id=p_object_id and i.library_id=p_library_id and v.id=p_version_id and v.library_id=p_library_id;
 elsif p_kind='SUBCATEGORY'then
 select jsonb_build_object('identity',to_jsonb(i),'version',to_jsonb(v),'previousVersion',(select to_jsonb(p)from public.catalog_subcategory_versions p where p.id=i.current_published_version_id),'releaseItems','[]'::jsonb)into result from public.catalog_subcategories i join public.catalog_subcategory_versions v on v.subcategory_id=i.id where i.id=p_object_id and i.library_id=p_library_id and v.id=p_version_id and v.library_id=p_library_id;
 elsif p_kind='SERVICE'then
 select jsonb_build_object('identity',to_jsonb(i),'version',to_jsonb(v),'previousVersion',(select to_jsonb(p)from public.catalog_service_versions p where p.id=i.current_published_version_id),'releaseItems','[]'::jsonb)into result from public.catalog_services i join public.catalog_service_versions v on v.service_id=i.id where i.id=p_object_id and i.library_id=p_library_id and v.id=p_version_id and v.library_id=p_library_id;
 elsif p_kind='RULE'then
 select jsonb_build_object('identity',to_jsonb(i),'version',to_jsonb(v),'previousVersion',(select to_jsonb(p)from public.question_rule_versions p where p.id=i.current_published_version_id),'releaseItems','[]'::jsonb)into result from public.question_rules i join public.question_rule_versions v on v.rule_id=i.id where i.id=p_object_id and i.library_id=p_library_id and v.id=p_version_id and v.library_id=p_library_id;
 elsif p_kind='SERVICE_SUBCATEGORY_LINK'then
 select jsonb_build_object('identity',to_jsonb(i),'version',to_jsonb(v),'previousVersion',null,'releaseItems','[]'::jsonb)into result from public.catalog_service_subcategory_links i join public.catalog_service_subcategory_link_versions v on v.link_id=i.id where i.id=p_object_id and i.library_id=p_library_id and v.id=p_version_id and v.library_id=p_library_id;
 elsif p_kind='RELEASE'then
 select jsonb_build_object('identity',to_jsonb(r)-array['lease_token','last_lease_token','lease_worker_id','leased_until'],'version',to_jsonb(r)-array['lease_token','last_lease_token','lease_worker_id','leased_until'],'previousVersion',(select to_jsonb(p)-array['lease_token','last_lease_token','lease_worker_id','leased_until']from public.catalog_releases p where p.id=r.based_on_release_id),'releaseItems',case when p_include_items then coalesce((select jsonb_agg(jsonb_build_object('item',to_jsonb(item))||private.catalog_editorial_object(item.object_type,item.object_id,item.version_id,item.library_id)order by item.sort_order,item.object_type,item.object_id)from public.catalog_release_items item where item.release_id=r.id and item.library_id=p_library_id),'[]'::jsonb)else'[]'::jsonb end)into result from public.catalog_releases r where r.id=p_object_id and r.id=p_version_id and r.library_id=p_library_id;
 end if;
 if result is null then raise exception 'CATALOG_VERSION_NOT_FOUND'using errcode='P0002';end if;
 if octet_length(result::text)>16777216 then raise exception 'CATALOG_REVIEW_BUDGET_EXCEEDED'using errcode='54000';end if;
 return result;
end$$;
revoke all on function private.catalog_editorial_object(text,uuid,uuid,uuid,boolean)from public,anon,authenticated,service_role;

create function public.catalog_editorial_review_queue(p_page integer default 1,p_kind text default 'ALL')returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
 perform private.assert_catalog_central_aal2_locked(auth.uid());
 if p_page is null or p_page not between 1 and 100000 or p_kind is null or p_kind not in('ALL','LIBRARY','CATEGORY','SUBCATEGORY','SERVICE','RULE','RELEASE')then raise exception 'INVALID_CATALOG_REVIEW_PAGE'using errcode='22023';end if;
 with pending as(select cr.*from public.catalog_change_requests cr where cr.status='IN_REVIEW'and cr.target_type in('LIBRARY','CATEGORY','SUBCATEGORY','SERVICE','RULE','RELEASE')and(p_kind='ALL'or cr.target_type=p_kind)and private.has_library_permission(cr.library_id,'CATALOG_APPROVE',auth.uid())),
 paged as(select*from pending order by requested_at,id limit 25 offset(p_page-1)*25),
 described as(select page.*,private.catalog_editorial_object(page.target_type,page.target_id,page.target_version_id,page.library_id,false)description from paged page)
 select jsonb_build_object('total',(select count(*)from pending),'page',p_page,'pageSize',25,'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'libraryId',library_id,'targetType',target_type,'targetId',target_id,'versionId',target_version_id,'titleFr',coalesce(description->'version'->>'name_fr',description->'version'->>'title_fr',description->'identity'->>'rule_key',description->'identity'->>'release_key',description->'identity'->>'code'),'titleAr',coalesce(description->'version'->>'name_ar',description->'version'->>'title_ar',description->'identity'->>'rule_key',description->'identity'->>'release_key',description->'identity'->>'code'),'code',coalesce(description->'identity'->>'code',description->'identity'->>'rule_key',description->'identity'->>'release_key'),'rowVersion',row_version,'requestedAt',requested_at,'requestedBy',requested_by)order by requested_at,id)from described),'[]'::jsonb))into result;
 return result;
end$$;

create function public.catalog_editorial_review_detail(p_change_request_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare request public.catalog_change_requests%rowtype;result jsonb;
begin
 perform private.assert_catalog_central_aal2_locked(auth.uid());
 select*into request from public.catalog_change_requests where id=p_change_request_id and target_type in('LIBRARY','CATEGORY','SUBCATEGORY','SERVICE','RULE','RELEASE');
 if request.id is null or not private.has_library_permission(request.library_id,'CATALOG_APPROVE',auth.uid())then raise exception 'CATALOG_APPROVAL_DENIED'using errcode='42501';end if;
 result:=private.catalog_editorial_object(request.target_type,request.target_id,request.target_version_id,request.library_id);
 return result||jsonb_build_object('snapshotHash',case when request.target_type='RELEASE'then result->'version'->>'snapshot_hash'else null end,'releaseRowVersion',case when request.target_type='RELEASE'then(result->'version'->>'row_version')::integer else null end,'reviewedSnapshot',(select review_snapshot from public.catalog_editorial_review_snapshots where change_request_id=request.id),'request',jsonb_build_object('id',request.id,'rowVersion',request.row_version,'requestedBy',request.requested_by,'requestedAt',request.requested_at,'status',request.status,'reviewedBy',request.reviewed_by,'reviewedAt',request.reviewed_at,'reviewComment',request.review_comment,'targetType',request.target_type,'targetId',request.target_id,'versionId',request.target_version_id));
end$$;

create function public.decide_catalog_editorial_review(p_change_request_id uuid,p_decision text,p_reason text,p_expected_row_version integer,p_translation_confirmed boolean,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare actor uuid:=auth.uid();request public.catalog_change_requests%rowtype;snapshot jsonb;proof text;h text;command uuid;replay jsonb;result jsonb;target_row integer;target_creator uuid;translation_result jsonb;
begin
 perform private.assert_catalog_central_aal2_locked(actor);
 if p_translation_confirmed is null or(p_decision='APPROVE'and not p_translation_confirmed)then raise exception 'CATALOG_TRANSLATION_CONFIRMATION_REQUIRED'using errcode='23514';end if;
 if p_decision is null or p_decision not in('APPROVE','REJECT')or p_expected_row_version is null or p_expected_row_version<1 or length(btrim(coalesce(p_reason,'')))not between 3 and 1000 then raise exception 'INVALID_CATALOG_DECISION'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-change:'||p_change_request_id::text,0));
 select*into request from public.catalog_change_requests where id=p_change_request_id and target_type in('LIBRARY','CATEGORY','SUBCATEGORY','SERVICE','RULE','RELEASE')for update;
 if request.id is null then raise exception 'CATALOG_CHANGE_NOT_FOUND'using errcode='P0002';end if;
 perform private.assert_catalog_permission_locked(request.library_id,'CATALOG_APPROVE',actor);
 if request.requested_by=actor then raise exception 'CATALOG_SELF_APPROVAL_DENIED'using errcode='42501';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request',request.id,'decision',p_decision,'reason',btrim(p_reason),'expected',p_expected_row_version,'translations',p_translation_confirmed));
 select b.command_id,b.response_body into command,replay from private.begin_catalog_command(actor,'catalog.editorial.review',p_idempotency_key,h)b;
 if replay is not null then return replay;end if;
 if request.status<>'IN_REVIEW'or request.row_version<>p_expected_row_version then raise exception 'STALE_CATALOG_VERSION'using errcode='40001';end if;
 if request.target_type='LIBRARY'then
 perform 1 from public.catalog_libraries where id=request.target_id for update;
 select row_version,created_by into target_row,target_creator from public.catalog_library_versions where id=request.target_version_id and library_id=request.target_id and library_id=request.library_id and status='IN_REVIEW'for update;
 elsif request.target_type='CATEGORY'then
 perform 1 from public.catalog_categories where id=request.target_id for update;
 select row_version,created_by into target_row,target_creator from public.catalog_category_versions where id=request.target_version_id and category_id=request.target_id and library_id=request.library_id and status='IN_REVIEW'for update;
 elsif request.target_type='SUBCATEGORY'then
 perform 1 from public.catalog_subcategories where id=request.target_id for update;
 select row_version,created_by into target_row,target_creator from public.catalog_subcategory_versions where id=request.target_version_id and subcategory_id=request.target_id and library_id=request.library_id and status='IN_REVIEW'for update;
 elsif request.target_type='SERVICE'then
 perform 1 from public.catalog_services where id=request.target_id for update;
 select row_version,created_by into target_row,target_creator from public.catalog_service_versions where id=request.target_version_id and service_id=request.target_id and library_id=request.library_id and status='IN_REVIEW'for update;
 elsif request.target_type='RULE'then
 perform 1 from public.question_rules where id=request.target_id for update;
 select row_version,created_by into target_row,target_creator from public.question_rule_versions where id=request.target_version_id and rule_id=request.target_id and library_id=request.library_id and status='IN_REVIEW'for update;
 else
 select row_version,created_by into target_row,target_creator from public.catalog_releases where id=request.target_id and id=request.target_version_id and library_id=request.library_id and status='IN_REVIEW'for update;
 end if;
 if target_row is null then raise exception 'INVALID_CATALOG_VERSION_STATE'using errcode='55000';end if;
 snapshot:=public.catalog_editorial_review_detail(request.id);proof:=private.canonical_request_hash(snapshot);
 if p_decision='APPROVE'then
  if target_creator=actor then raise exception 'CATALOG_SELF_APPROVAL_DENIED'using errcode='42501';end if;
  if request.target_type in('LIBRARY','CATEGORY','SUBCATEGORY','SERVICE')then
   translation_result:=public.attest_catalog_ar_translation(request.target_type,request.target_version_id,proof,target_row,p_idempotency_key||':translation',p_correlation_id);
  elsif request.target_type='RELEASE'then
   perform private.validate_catalog_release_tree(request.target_id);
  end if;
 end if;
 result:=public.decide_catalog_change(request.id,p_decision,btrim(p_reason),p_expected_row_version,p_idempotency_key||':decision',p_correlation_id);
 insert into public.catalog_editorial_review_snapshots(change_request_id,library_id,decision,translation_confirmed,reviewed_by,reason,review_snapshot,review_proof_hash)values(request.id,request.library_id,p_decision,p_translation_confirmed,actor,btrim(p_reason),snapshot,proof);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values((select steward_organization_id from public.catalog_libraries where id=request.library_id),actor,'USER','catalog.editorial.review_recorded','catalog_change_request',request.id::text,p_correlation_id,jsonb_build_object('decision',p_decision,'review_proof_hash',proof,'translation_confirmed',p_translation_confirmed),repeat('0',64));
 snapshot:=private.catalog_editorial_object(request.target_type,request.target_id,request.target_version_id,request.library_id);
 result:=result||jsonb_build_object('reviewProofHash',proof,'targetVersionId',request.target_version_id,'targetVersionRowVersion',(snapshot->'version'->>'row_version')::integer,'targetType',request.target_type);
 perform private.finish_catalog_command(actor,'catalog.editorial.review',p_idempotency_key,result);return result;
end$$;

create function public.schedule_reviewed_catalog_release(p_release_id uuid,p_expected_row_version integer,p_expected_snapshot_hash text,p_effective_from timestamptz,p_effective_until timestamptz,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare release public.catalog_releases%rowtype;result jsonb;
begin
 perform private.assert_catalog_central_aal2_locked(auth.uid());
 if p_expected_row_version is null or p_expected_row_version<1 or length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception 'INVALID_CATALOG_SCHEDULE'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('catalog-library:'||(select library_id from public.catalog_releases where id=p_release_id)::text,0));
 select*into release from public.catalog_releases where id=p_release_id for update;
 if release.id is null or not private.has_library_permission(release.library_id,'CATALOG_PUBLISH',auth.uid())then raise exception 'CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 if p_expected_snapshot_hash is null or release.snapshot_hash is distinct from p_expected_snapshot_hash then raise exception 'STALE_CATALOG_VERSION'using errcode='40001';end if;
 result:=public.schedule_catalog_release(release.id,p_effective_from,p_effective_until,release.audience,p_expected_row_version,p_idempotency_key,p_correlation_id);
 return result||jsonb_build_object('releaseRowVersion',(result->>'release_row_version')::integer);
end$$;
revoke all on function public.catalog_editorial_review_queue(integer,text),public.catalog_editorial_review_detail(uuid),public.decide_catalog_editorial_review(uuid,text,text,integer,boolean,text,uuid),public.schedule_reviewed_catalog_release(uuid,integer,text,timestamptz,timestamptz,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.catalog_editorial_review_queue(integer,text),public.catalog_editorial_review_detail(uuid),public.decide_catalog_editorial_review(uuid,text,text,integer,boolean,text,uuid),public.schedule_reviewed_catalog_release(uuid,integer,text,timestamptz,timestamptz,text,uuid)to authenticated;

-- Preserve rejected standalone review content after later draft corrections.
create or replace function public.franchise_catalog_review_diff(p_franchise_id uuid,p_change_request_id uuid)returns jsonb
language plpgsql stable security invoker set search_path=pg_catalog as $$
declare request public.catalog_change_requests%rowtype;before_doc jsonb;after_doc jsonb;result jsonb;current_version uuid;reviewed_snapshot jsonb;
begin
 if not public.franchise_catalog_scope(p_franchise_id)then raise exception 'FRANCHISE_CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 select cr.*into request from public.catalog_change_requests cr join public.franchises f on f.library_id=cr.library_id where cr.id=p_change_request_id and f.id=p_franchise_id;
 if request.id is null then raise exception 'FRANCHISE_CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 if request.target_type='SERVICE'then
  select coalesce(current_draft_version_id,current_published_version_id)into current_version from public.catalog_services where id=request.target_id;
  select to_jsonb(v)into after_doc from public.catalog_service_versions v where v.id=current_version and v.library_id=request.library_id;
  select to_jsonb(v)into before_doc from public.catalog_service_versions v where v.service_id=request.target_id and v.library_id=request.library_id and case when current_version<>request.target_version_id then v.id=request.target_version_id else v.version<(after_doc->>'version')::int end order by v.version desc limit 1;
 elsif request.target_type='QUESTIONNAIRE'then
  select coalesce(current_draft_version_id,current_published_version_id)into current_version from public.questionnaires where id=request.target_id;
  select to_jsonb(v)into after_doc from public.questionnaire_versions v where v.id=current_version and v.library_id=request.library_id;
  select to_jsonb(v)into before_doc from public.questionnaire_versions v where v.questionnaire_id=request.target_id and v.library_id=request.library_id and case when current_version<>request.target_version_id then v.id=request.target_version_id else v.version<(after_doc->>'version')::int end order by v.version desc limit 1;
 elsif request.target_type='RULE'then
  select coalesce(current_draft_version_id,current_published_version_id)into current_version from public.question_rules where id=request.target_id;
  select to_jsonb(v)into after_doc from public.question_rule_versions v where v.id=current_version and v.library_id=request.library_id;
  select to_jsonb(v)into before_doc from public.question_rule_versions v where v.rule_id=request.target_id and v.library_id=request.library_id and case when current_version<>request.target_version_id then v.id=request.target_version_id else v.version<(after_doc->>'version')::int end order by v.version desc limit 1;
 else raise exception 'INVALID_FRANCHISE_REVIEW_TARGET'using errcode='22023';end if;
 if request.target_type='QUESTIONNAIRE'then
  after_doc:=after_doc||jsonb_build_object('sections',coalesce((select jsonb_agg(jsonb_build_object('key',section_key,'label_fr',label_fr,'label_ar',label_ar,'help_fr',help_fr,'help_ar',help_ar,'order',sort_order)order by sort_order,section_key)from public.questionnaire_sections where questionnaire_version_id=current_version),'[]'::jsonb),'questions',coalesce((select jsonb_agg((to_jsonb(vq)-array['id','question_id','rule_id','library_id','version','row_version','status','created_at','created_by','published_at','superseded_at','content_hash','compiled_hash','change_reason','translation_review_status','translation_reviewer_user_id','translation_reviewed_at','translation_review_proof_hash','translation_review_version','source_import_batch_id','source_file','source_line_number','source_row_hash','compositionOrder','sectionId','requiredOverride','evaluationOrder'])||jsonb_build_object('question_version_id',l.question_version_id,'section',s.section_key,'required',l.required_override,'order',l.sort_order)order by l.sort_order,l.question_version_id)from public.questionnaire_version_questions l join public.question_versions vq on vq.id=l.question_version_id join public.questionnaire_sections s on s.id=l.section_id where l.questionnaire_version_id=current_version),'[]'::jsonb),'rules',coalesce((select jsonb_agg((to_jsonb(vr)-array['id','question_id','rule_id','library_id','version','row_version','status','created_at','created_by','published_at','superseded_at','content_hash','compiled_hash','change_reason','translation_review_status','translation_reviewer_user_id','translation_reviewed_at','translation_review_proof_hash','translation_review_version','source_import_batch_id','source_file','source_line_number','source_row_hash','compositionOrder','sectionId','requiredOverride','evaluationOrder'])||jsonb_build_object('rule_version_id',l.rule_version_id,'order',l.evaluation_order)order by l.evaluation_order,l.rule_version_id)from public.questionnaire_version_rules l join public.question_rule_versions vr on vr.id=l.rule_version_id where l.questionnaire_version_id=current_version),'[]'::jsonb));
  select review_snapshot into reviewed_snapshot from public.franchise_questionnaire_bundle_reviews where change_request_id=request.id;
  if reviewed_snapshot is not null then
   before_doc:=(reviewed_snapshot->'questionnaire')||jsonb_build_object('sections',coalesce((select jsonb_agg(jsonb_build_object('key',entry->'section_key','label_fr',entry->'label_fr','label_ar',entry->'label_ar','help_fr',entry->'help_fr','help_ar',entry->'help_ar','order',entry->'sort_order')order by(entry->>'sort_order')::int,entry->>'section_key')from jsonb_array_elements(reviewed_snapshot->'sections')as x(entry)),'[]'::jsonb),'questions',coalesce((select jsonb_agg((entry-array['id','question_id','rule_id','library_id','version','row_version','status','created_at','created_by','published_at','superseded_at','content_hash','compiled_hash','change_reason','translation_review_status','translation_reviewer_user_id','translation_reviewed_at','translation_review_proof_hash','translation_review_version','source_import_batch_id','source_file','source_line_number','source_row_hash','compositionOrder','sectionId','requiredOverride','evaluationOrder'])||jsonb_build_object('question_version_id',entry->'id','section',(select section->'section_key'from jsonb_array_elements(reviewed_snapshot->'sections')as sx(section)where section->>'id'=entry->>'sectionId'),'required',entry->'requiredOverride','order',entry->'compositionOrder')order by(entry->>'compositionOrder')::int,entry->>'id')from jsonb_array_elements(reviewed_snapshot->'questions')as qx(entry)),'[]'::jsonb),'rules',coalesce((select jsonb_agg((entry-array['id','question_id','rule_id','library_id','version','row_version','status','created_at','created_by','published_at','superseded_at','content_hash','compiled_hash','change_reason','translation_review_status','translation_reviewer_user_id','translation_reviewed_at','translation_review_proof_hash','translation_review_version','source_import_batch_id','source_file','source_line_number','source_row_hash','compositionOrder','sectionId','requiredOverride','evaluationOrder'])||jsonb_build_object('rule_version_id',entry->'id','order',entry->'evaluationOrder')order by(entry->>'evaluationOrder')::int,entry->>'id')from jsonb_array_elements(reviewed_snapshot->'rules')as rx(entry)),'[]'::jsonb));
  elsif before_doc is not null then before_doc:=before_doc||jsonb_build_object('sections',coalesce((select jsonb_agg(jsonb_build_object('key',section_key,'label_fr',label_fr,'label_ar',label_ar,'help_fr',help_fr,'help_ar',help_ar,'order',sort_order)order by sort_order,section_key)from public.questionnaire_sections where questionnaire_version_id=(before_doc->>'id')::uuid),'[]'::jsonb),'questions',coalesce((select jsonb_agg((to_jsonb(vq)-array['id','question_id','rule_id','library_id','version','row_version','status','created_at','created_by','published_at','superseded_at','content_hash','compiled_hash','change_reason','translation_review_status','translation_reviewer_user_id','translation_reviewed_at','translation_review_proof_hash','translation_review_version','source_import_batch_id','source_file','source_line_number','source_row_hash','compositionOrder','sectionId','requiredOverride','evaluationOrder'])||jsonb_build_object('question_version_id',l.question_version_id,'section',s.section_key,'required',l.required_override,'order',l.sort_order)order by l.sort_order,l.question_version_id)from public.questionnaire_version_questions l join public.question_versions vq on vq.id=l.question_version_id join public.questionnaire_sections s on s.id=l.section_id where l.questionnaire_version_id=(before_doc->>'id')::uuid),'[]'::jsonb),'rules',coalesce((select jsonb_agg((to_jsonb(vr)-array['id','question_id','rule_id','library_id','version','row_version','status','created_at','created_by','published_at','superseded_at','content_hash','compiled_hash','change_reason','translation_review_status','translation_reviewer_user_id','translation_reviewed_at','translation_review_proof_hash','translation_review_version','source_import_batch_id','source_file','source_line_number','source_row_hash','compositionOrder','sectionId','requiredOverride','evaluationOrder'])||jsonb_build_object('rule_version_id',l.rule_version_id,'order',l.evaluation_order)order by l.evaluation_order,l.rule_version_id)from public.questionnaire_version_rules l join public.question_rule_versions vr on vr.id=l.rule_version_id where l.questionnaire_version_id=(before_doc->>'id')::uuid),'[]'::jsonb));end if;
 end if;
 if request.target_type in('SERVICE','RULE')then
  select review_snapshot into reviewed_snapshot from public.catalog_editorial_review_snapshots where change_request_id=request.id;
  if reviewed_snapshot is not null then before_doc:=reviewed_snapshot->'version';end if;
 end if;
 if after_doc is null then raise exception 'FRANCHISE_CATALOG_SCOPE_DENIED'using errcode='42501';end if;
 select jsonb_build_object('beforeVersion',before_doc->'version','afterVersion',after_doc->'version','beforeHash',coalesce(before_doc->'content_hash',before_doc->'compiled_hash',before_doc->'snapshot_hash'),'afterHash',coalesce(after_doc->'content_hash',after_doc->'compiled_hash',after_doc->'snapshot_hash'),'requestedBy',request.requested_by,'reviewedBy',request.reviewed_by,'changes',coalesce((select jsonb_agg(jsonb_build_object('field',field,'before',before_doc->field,'after',after_doc->field)order by field)from(select jsonb_object_keys(coalesce(before_doc,'{}'::jsonb)||after_doc)field)keys where field not in('id','version','row_version','status','created_at','created_by','published_at','retired_at','content_hash','compiled_hash','change_reason','translation_review_status','translation_reviewer_user_id','translation_reviewed_at','translation_review_proof_hash','translation_review_version')and(before_doc->field)is distinct from(after_doc->field)),'[]'::jsonb))into result;
 return result;
end$$;
