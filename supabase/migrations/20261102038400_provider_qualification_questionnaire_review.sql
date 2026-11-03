begin;
-- The reviewer gets one purpose-bound projection, never table-wide access to
-- another actor's private questionnaire sessions or answer revisions.
create function private.provider_qualification_review_target_v1(p_qualification_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
declare target record;
begin
 if auth.uid()is null or auth.jwt()->>'aal'is distinct from'aal2'then raise exception 'QUALIFICATION_REVIEW_MFA_REQUIRED'using errcode='42501';end if;
 if not private.can_decide_provider_qualification(auth.uid())then raise exception 'QUALIFICATION_REVIEW_DENIED'using errcode='42501';end if;
 select q.id,q.provider_organization_id,q.service_id,q.row_version,s.library_id into target
 from public.provider_qualifications q join public.provider_services ps on ps.id=q.provider_service_id and ps.provider_organization_id=q.provider_organization_id and ps.service_id=q.service_id
 join public.catalog_services s on s.id=q.service_id where q.id=p_qualification_id;
 if not found or private.is_active_org_member(target.provider_organization_id,auth.uid())then raise exception 'QUALIFICATION_REVIEW_DENIED'using errcode='42501';end if;
 return jsonb_build_object('qualificationId',target.id,'organizationId',target.provider_organization_id,'serviceId',target.service_id,'libraryId',target.library_id,'qualificationRowVersion',target.row_version);
end$$;
create function private.provider_qualification_review_session_v1(p_qualification_id uuid,p_session_id uuid)returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public,private,extensions as $$
declare target jsonb;session public.questionnaire_sessions%rowtype;snapshot public.questionnaire_session_snapshots%rowtype;evaluation public.questionnaire_session_evaluations%rowtype;version public.questionnaire_versions%rowtype;questions jsonb;context_hash text;
begin
 target:=private.provider_qualification_review_target_v1(p_qualification_id);
 select s.* into session from public.questionnaire_sessions s join public.questionnaire_versions v on v.id=s.questionnaire_version_id and v.library_id=s.library_id and v.audience='PROVIDER'
 join public.catalog_releases r on r.id=s.catalog_release_id and r.library_id=s.library_id
 where s.id=p_session_id and s.organization_id=(target->>'organizationId')::uuid and s.library_id=(target->>'libraryId')::uuid and s.audience='PROVIDER'and s.status='SUBMITTED'and not s.is_simulation and s.actor_user_id<>auth.uid();
 if not found then raise exception 'QUALIFICATION_QUESTIONNAIRE_SCOPE_DENIED'using errcode='42501';end if;
 select * into snapshot from public.questionnaire_session_snapshots where session_id=session.id and organization_id=session.organization_id and questionnaire_version_id=session.questionnaire_version_id and catalog_release_id=session.catalog_release_id;
 select * into evaluation from public.questionnaire_session_evaluations where session_id=session.id and organization_id=session.organization_id and questionnaire_version_id=session.questionnaire_version_id and session_snapshot_id=snapshot.id and answer_manifest_hash=session.answer_manifest_hash;
 select * into version from public.questionnaire_versions where id=session.questionnaire_version_id;
 if snapshot.id is null or evaluation.id is null or private.canonical_request_hash(session.answer_manifest)is distinct from session.answer_manifest_hash
 or exists(select 1 from jsonb_array_elements(snapshot.questions_manifest)m left join public.question_versions q on q.id=(m->>'question_version_id')::uuid where q.id is null or q.library_id<>session.library_id or q.content_hash is distinct from m->>'content_hash')then raise exception 'QUALIFICATION_REVIEW_SOURCE_UNAVAILABLE'using errcode='55000';end if;
 -- Provider questionnaires may contain common library questions. A question
 -- explicitly bound to another service cannot qualify this target service.
 if exists(select 1 from jsonb_array_elements(snapshot.questions_manifest)m join public.question_versions q on q.id=(m->>'question_version_id')::uuid where q.source_service_id is not null and q.source_service_id<>(target->>'serviceId')::uuid)then raise exception 'QUALIFICATION_QUESTIONNAIRE_SCOPE_DENIED'using errcode='42501';end if;
 if exists(select 1 from jsonb_array_elements(session.answer_manifest)m left join public.questionnaire_answer_revisions a on a.id=(m->>'answer_revision_id')::uuid and a.session_id=session.id and a.organization_id=session.organization_id and a.question_version_id=(m->>'question_version_id')::uuid and a.answer_hash=m->>'answer_hash'where a.id is null or not exists(select 1 from jsonb_array_elements(snapshot.questions_manifest)q where q->>'question_version_id'=m->>'question_version_id'))then raise exception 'QUALIFICATION_REVIEW_SOURCE_UNAVAILABLE'using errcode='55000';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'labelFr',q.label_fr,'labelAr',q.label_ar,'answerType',q.answer_type,'options',q.options,'required',coalesce((m->>'required')::boolean,false),'applicable',not exists(select 1 from jsonb_array_elements(evaluation.triggered_actions)a where a->>'type'='HIDE'and a->>'target'=q.id::text),'answered',a.id is not null,'value',a.value,'answeredAt',a.answered_at)order by (m->>'sort_order')::integer,q.id),'[]')into questions
 from jsonb_array_elements(snapshot.questions_manifest)m join public.question_versions q on q.id=(m->>'question_version_id')::uuid
 left join lateral(select ar.*from jsonb_array_elements(session.answer_manifest)am join public.questionnaire_answer_revisions ar on ar.id=(am->>'answer_revision_id')::uuid and ar.session_id=session.id and ar.organization_id=session.organization_id and ar.question_version_id=q.id where am->>'question_version_id'=q.id::text)a on true;
 context_hash:=private.canonical_request_hash(target||jsonb_build_object('sessionId',session.id,'snapshotHash',snapshot.snapshot_hash,'answerManifestHash',session.answer_manifest_hash,'evaluationHash',evaluation.reproducibility_hash));
 return jsonb_build_object('id',session.id,'titleFr',version.title_fr,'titleAr',version.title_ar,'version',version.version,'submittedAt',session.submitted_at,'locale',session.locale,'engineScoreBasisPoints',evaluation.score_basis_points,'snapshotHash',snapshot.snapshot_hash,'answerManifestHash',session.answer_manifest_hash,'contextHash',context_hash,'questions',questions);
end$$;
create function public.get_provider_qualification_questionnaire_review_v1(p_qualification_id uuid,p_session_id uuid default null,p_page integer default 1)returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare target jsonb;total integer;sessions jsonb;selected jsonb;
begin
 target:=private.provider_qualification_review_target_v1(p_qualification_id);
 if p_page is null or p_page not between 1 and 100000 then raise exception 'QUALIFICATION_REVIEW_PAGE_INVALID'using errcode='22023';end if;
 with applicable as(select s.id,s.questionnaire_version_id,s.submitted_at,v.title_fr,v.title_ar,v.version,
 exists(select 1 from public.questionnaire_session_snapshots sn join public.questionnaire_session_evaluations e on e.session_snapshot_id=sn.id and e.session_id=sn.session_id and e.answer_manifest_hash=s.answer_manifest_hash where sn.session_id=s.id and sn.organization_id=s.organization_id)available
 from public.questionnaire_sessions s join public.questionnaire_versions v on v.id=s.questionnaire_version_id and v.library_id=s.library_id and v.audience='PROVIDER'
 where s.organization_id=(target->>'organizationId')::uuid and s.library_id=(target->>'libraryId')::uuid and s.audience='PROVIDER'and s.status='SUBMITTED'and not s.is_simulation and s.actor_user_id<>auth.uid()
 and not exists(select 1 from public.questionnaire_session_snapshots sn cross join lateral jsonb_array_elements(sn.questions_manifest)m join public.question_versions q on q.id=(m->>'question_version_id')::uuid where sn.session_id=s.id and q.source_service_id is not null and q.source_service_id<>(target->>'serviceId')::uuid)),
 paged as(select *from applicable order by submitted_at desc,id offset(p_page-1)*20 limit 20)
 select (select count(*)from applicable),coalesce((select jsonb_agg(jsonb_build_object('id',id,'titleFr',title_fr,'titleAr',title_ar,'version',version,'submittedAt',submitted_at,'available',available)order by submitted_at desc,id)from paged),'[]')into total,sessions;
 if p_session_id is not null then
  selected:=private.provider_qualification_review_session_v1(p_qualification_id,p_session_id);
  insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values((target->>'organizationId')::uuid,auth.uid(),'USER','provider.qualification.questionnaire_read','provider_qualification',p_qualification_id::text,extensions.gen_random_uuid(),jsonb_build_object('session_id',p_session_id,'context_hash',selected->>'contextHash','answer_manifest_hash',selected->>'answerManifestHash','purpose','HUMAN_QUALIFICATION_REVIEW'),repeat('0',64));
 end if;
 return target||jsonb_build_object('sessions',sessions,'total',total,'page',p_page,'pageSize',20,'selected',selected);
end$$;
-- Keep the native decision/CAS/history/outbox implementation, but require the
-- exact submitted service context and the reviewer's own audited projection.
alter function public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)rename to decide_provider_qualification_pre_review_0384;
revoke all on function public.decide_provider_qualification_pre_review_0384(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)from public,anon,authenticated,service_role;
create function public.decide_provider_qualification(p_qualification_id uuid,p_status text,p_questionnaire_session_id uuid,p_score_basis_points integer,p_mandatory_checks jsonb,p_blocking_conditions jsonb,p_rationale text,p_rule_version text,p_expires_at timestamptz,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare target jsonb;review jsonb;prior private.provider_qualification_command_keys%rowtype;request_hash text;
begin
 target:=private.provider_qualification_review_target_v1(p_qualification_id);
 request_hash:=encode(extensions.digest(convert_to(jsonb_build_object('operation','provider.qualification.decide.v1','qualification_id',p_qualification_id,'status',p_status,'questionnaire_session_id',p_questionnaire_session_id,'score',p_score_basis_points,'mandatory_checks',p_mandatory_checks,'blocking_conditions',p_blocking_conditions,'rationale',btrim(p_rationale),'rule_version',p_rule_version,'expires_at',p_expires_at,'expected',p_expected_row_version)::text,'UTF8'),'sha256'),'hex');
 select *into prior from private.provider_qualification_command_keys where actor_user_id=auth.uid()and operation_scope='provider.qualification.decide'and key=p_idempotency_key;
 if found and prior.response_body is not null then if prior.request_hash<>request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'using errcode='22000';end if;return prior.response_body;end if;
 if p_questionnaire_session_id is not null then review:=private.provider_qualification_review_session_v1(p_qualification_id,p_questionnaire_session_id);end if;
 if p_status in('APPROVED','CONDITIONAL')then
  if review is null or not exists(select 1 from jsonb_array_elements(p_mandatory_checks)c where c->>'check'='HUMAN_EVIDENCE_REVIEW'and c->>'passed'='true'and c->>'review_context_hash'=review->>'contextHash')
  or not exists(select 1 from public.audit_events a where a.actor_user_id=auth.uid()and a.action='provider.qualification.questionnaire_read'and a.resource_id=p_qualification_id::text and a.organization_id=(target->>'organizationId')::uuid and a.metadata->>'session_id'=p_questionnaire_session_id::text and a.metadata->>'context_hash'=review->>'contextHash')then raise exception 'QUALIFICATION_QUESTIONNAIRE_REVIEW_REQUIRED'using errcode='23514';end if;
 end if;
 return public.decide_provider_qualification_pre_review_0384(p_qualification_id,p_status,p_questionnaire_session_id,p_score_basis_points,p_mandatory_checks,p_blocking_conditions,p_rationale,p_rule_version,p_expires_at,p_expected_row_version,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function private.provider_qualification_review_target_v1(uuid),private.provider_qualification_review_session_v1(uuid,uuid),public.get_provider_qualification_questionnaire_review_v1(uuid,uuid,integer),public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.get_provider_qualification_questionnaire_review_v1(uuid,uuid,integer),public.decide_provider_qualification(uuid,text,uuid,integer,jsonb,jsonb,text,text,timestamptz,integer,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
