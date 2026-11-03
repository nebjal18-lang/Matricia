begin;
-- New decisions only. Append-only historical decisions and facts are preserved.
create or replace function public.decide_benefit_admission_policy_v1(p_policy_id uuid,p_expected_content_hash text,p_approve boolean,p_reference text,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare p public.benefit_admission_policy_versions_v1%rowtype;d public.benefit_admission_policy_decisions_v1%rowtype;result text;correlation uuid:=extensions.gen_random_uuid();begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select*into p from public.benefit_admission_policy_versions_v1 where id=p_policy_id;
 if p.id is null or p.created_by=auth.uid()then raise exception'BENEFIT_POLICY_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_approve is null or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_POLICY_REVIEW'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||p.benefit_version_id::text,0)); if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
select*into d from public.benefit_admission_policy_decisions_v1 where policy_id=p.id;result:=case when p_approve then'APPROVE'else'REJECT'end;
 if p_expected_content_hash is distinct from p.content_hash then raise exception'STALE_BENEFIT_ADMISSION_POLICY'using errcode='40001';end if;
 if d.policy_id is not null then if d.decided_by=auth.uid()and d.decision=result and d.reference=btrim(p_reference)and d.reason=btrim(p_reason)then return jsonb_build_object('outcome','BENEFIT_ADMISSION_POLICY_REVIEWED','decision',d.decision);end if;raise exception'BENEFIT_POLICY_ALREADY_REVIEWED'using errcode='55000';end if;
 if p_approve and(private.benefit_admission_head_v1(p.benefit_version_id)is distinct from p.expected_head_id or private.canonical_request_hash(private.benefit_admission_source_v1(p.benefit_version_id))is distinct from p.source_hash or not private.benefit_admission_legacy_supported_v1(p))then raise exception'STALE_BENEFIT_ADMISSION_POLICY'using errcode='40001';end if;
 if p_approve and exists(select 1 from jsonb_array_elements(p.box_source_snapshot)b where not exists(select 1 from public.box_versions v where v.id=(b->>'box_version_id')::uuid and v.content_hash=b->>'content_hash'and v.status='ACTIVE'))then raise exception'BENEFIT_POLICY_ACTIVE_BOX_REQUIRED'using errcode='23514';end if;
 insert into public.benefit_admission_policy_decisions_v1(policy_id,content_hash,decision,reference,reason,decided_by)values(p.id,p.content_hash,result,btrim(p_reference),btrim(p_reason),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(null,auth.uid(),'USER','benefit.admission_policy.reviewed','benefit_policy',p.id::text,correlation,jsonb_build_object('content_hash',p.content_hash,'decision',result),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(null,'benefit_policy',p.id::text,'BenefitAdmissionPolicyReviewedV1',correlation,jsonb_build_object('policy_id',p.id,'content_hash',p.content_hash,'decision',result));
 return jsonb_build_object('outcome','BENEFIT_ADMISSION_POLICY_REVIEWED','decision',result);
end$$;

create or replace function public.decide_legacy_benefit_admission_v1(p_proposal_id uuid,p_expected_content_hash text,p_approve boolean,p_reference text,p_reason text)returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private set timezone='UTC' as $$declare p public.benefit_legacy_admission_proposals_v1%rowtype;r public.benefit_redemptions%rowtype;d public.benefit_legacy_admission_decisions_v1%rowtype;context jsonb;outcome text;correlation uuid:=extensions.gen_random_uuid();begin
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select*into p from public.benefit_legacy_admission_proposals_v1 where id=p_proposal_id;if p.id is null or p.created_by=auth.uid()then raise exception'BENEFIT_POLICY_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 if p_approve is null or p.content_hash is distinct from p_expected_content_hash or length(btrim(coalesce(p_reference,'')))not between 8 and 1000 or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception'INVALID_BENEFIT_LEGACY_REVIEW'using errcode='22023';end if;
 select*into r from public.benefit_redemptions where id=p.redemption_id;
 perform pg_advisory_xact_lock(hashtextextended('subscription-financial:'||r.organization_id::text,0));perform 1 from public.credit_wallets where id=r.wallet_id for update;perform pg_advisory_xact_lock(hashtextextended('benefit-admission:'||r.benefit_version_id::text,0));select*into r from public.benefit_redemptions where id=p.redemption_id for update;
 if not coalesce(private.benefit_admission_staff_v1(),false)then raise exception'BENEFIT_POLICY_FINANCE_AAL2_REQUIRED'using errcode='42501';end if;
 select*into d from public.benefit_legacy_admission_decisions_v1 where proposal_id=p.id;outcome:=case when p_approve then'APPROVE'else'REJECT'end;
 if d.proposal_id is not null then if d.decided_by=auth.uid()and d.decision=outcome and d.reference=btrim(p_reference)and d.reason=btrim(p_reason)then return jsonb_build_object('outcome','BENEFIT_LEGACY_ADMISSION_REVIEWED','decision',d.decision);end if;raise exception'BENEFIT_POLICY_ALREADY_REVIEWED'using errcode='55000';end if;
 if p_approve then
  if not exists(select 1 from public.organizations where id=r.organization_id and status='ACTIVE')or not private.subscription_financially_clear(r.organization_id)or not private.client_identity_allows_new_operations(r.organization_id)then raise exception'BENEFIT_LEGACY_ADMISSION_NOT_REVIEWABLE'using errcode='55000';end if;
  context:=private.benefit_legacy_admission_context_v1(r.id);
  if context->>'redemption_hash'is distinct from p.redemption_hash or context#>>'{admission,policy_id}'is distinct from p.policy_id::text or context#>>'{admission,source_hash}'is distinct from p.context_snapshot#>>'{admission,source_hash}'or context#>>'{admission,subscription_cycle_id}'is distinct from p.context_snapshot#>>'{admission,subscription_cycle_id}'then raise exception'STALE_BENEFIT_LEGACY_ADMISSION'using errcode='40001';end if;
  if(context#>>'{admission,admissible}')::boolean is distinct from true then raise exception'%',context#>>'{admission,blocked_reason}'using errcode='55000';end if;
  perform private.record_benefit_admission_v1(r,auth.uid(),context->'admission',p.content_hash);
 end if;
 insert into public.benefit_legacy_admission_decisions_v1(proposal_id,content_hash,decision,reference,reason,decided_by)values(p.id,p.content_hash,outcome,btrim(p_reference),btrim(p_reason),auth.uid());
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(r.organization_id,auth.uid(),'USER','benefit.legacy_admission.reviewed','benefit_redemption',r.id::text,correlation,jsonb_build_object('proposal_id',p.id,'content_hash',p.content_hash,'decision',outcome),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload)values(r.organization_id,'benefit_redemption',r.id::text,'BenefitLegacyAdmissionReviewedV1',correlation,jsonb_build_object('proposal_id',p.id,'content_hash',p.content_hash,'decision',outcome));
 return jsonb_build_object('outcome','BENEFIT_LEGACY_ADMISSION_REVIEWED','decision',outcome);
end$$;

commit;
