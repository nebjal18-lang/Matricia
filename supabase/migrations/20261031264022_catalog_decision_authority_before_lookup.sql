begin;
-- Restore the historical central authorization boundary on both public facades.
-- Approval and FR/AR attestation remain distinct legacy commands. Enforce source
-- independence at every public approval entry; the new UI keeps explicit review proofs.
create or replace function public.decide_catalog_change(p_change_request_id uuid,p_decision text,p_reason text,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare request public.catalog_change_requests%rowtype;source_creator uuid;
begin
 -- Both decisions already require this same central authority in the private
 -- core. Check it before looking up the request to hide its existence.
 begin perform private.assert_catalog_central_aal2_locked(auth.uid());exception when insufficient_privilege then raise exception 'CATALOG_APPROVAL_DENIED'using errcode='42501';end;
 if p_decision='APPROVE'then
  perform pg_advisory_xact_lock(hashtextextended('catalog-change:'||p_change_request_id::text,0));
  select*into request from public.catalog_change_requests where id=p_change_request_id for update;
  if request.id is not null then
   begin perform private.assert_catalog_central_aal2_locked(auth.uid());exception when insufficient_privilege then raise exception 'CATALOG_APPROVAL_DENIED'using errcode='42501';end;
   perform private.assert_catalog_permission_locked(request.library_id,'CATALOG_APPROVE',auth.uid());
   select created_by into source_creator from(
    select created_by from public.catalog_library_versions where request.target_type='LIBRARY'and id=request.target_version_id and library_id=request.library_id and library_id=request.target_id
    union all select created_by from public.catalog_category_versions where request.target_type='CATEGORY'and id=request.target_version_id and library_id=request.library_id and category_id=request.target_id
    union all select created_by from public.catalog_subcategory_versions where request.target_type='SUBCATEGORY'and id=request.target_version_id and library_id=request.library_id and subcategory_id=request.target_id
    union all select created_by from public.catalog_service_versions where request.target_type='SERVICE'and id=request.target_version_id and library_id=request.library_id and service_id=request.target_id
    union all select created_by from public.question_rule_versions where request.target_type='RULE'and id=request.target_version_id and library_id=request.library_id and rule_id=request.target_id
    union all select created_by from public.catalog_releases where request.target_type='RELEASE'and id=request.target_version_id and library_id=request.library_id and id=request.target_id
    union all select created_by from public.questionnaire_versions where request.target_type='QUESTIONNAIRE'and id=request.target_version_id and library_id=request.library_id and questionnaire_id=request.target_id
   )source;
   if source_creator=auth.uid()then raise exception 'CATALOG_SELF_APPROVAL_DENIED'using errcode='42501';end if;
  end if;
  if request.target_type='QUESTIONNAIRE'then
   if not exists(select 1 from public.questionnaire_version_questions where questionnaire_version_id=request.target_version_id)or exists(select 1 from public.questionnaire_version_questions l join public.question_versions q on q.id=l.question_version_id where l.questionnaire_version_id=request.target_version_id and q.status not in('APPROVED','PUBLISHED'))or exists(select 1 from public.questionnaire_version_rules l join public.question_rule_versions r on r.id=l.rule_version_id where l.questionnaire_version_id=request.target_version_id and r.status not in('APPROVED','PUBLISHED'))then raise exception 'CATALOG_BUNDLE_REVIEW_REQUIRED'using errcode='55000';end if;
  end if;
 end if;
 return private.decide_catalog_change_before_questionnaire_bundle(p_change_request_id,p_decision,p_reason,p_expected_row_version,p_idempotency_key,p_correlation_id);
end$$;
create or replace function public.decide_catalog_change(p_change_request_id uuid,p_approved boolean,p_comment text,p_expected_row_version integer,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid()is null or auth.jwt()->>'role'is distinct from'authenticated'or auth.jwt()->>'aal'is distinct from'aal2'then raise exception 'CENTRAL_MFA_REQUIRED'using errcode='42501';end if;
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform private.assert_catalog_central_aal2_locked(auth.uid());
 if p_approved is null then raise exception 'INVALID_CATALOG_DECISION'using errcode='22023';end if;
 return public.decide_catalog_change(p_change_request_id,case when p_approved then'APPROVE'else'REJECT'end,p_comment,p_expected_row_version,p_idempotency_key,p_correlation_id);
end$$;
revoke all on function public.decide_catalog_change(uuid,text,text,integer,text,uuid),public.decide_catalog_change(uuid,boolean,text,integer,text,uuid)from public,anon,service_role;
grant execute on function public.decide_catalog_change(uuid,text,text,integer,text,uuid),public.decide_catalog_change(uuid,boolean,text,integer,text,uuid)to authenticated;

notify pgrst,'reload schema';
commit;
