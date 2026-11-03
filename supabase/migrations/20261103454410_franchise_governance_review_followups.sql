-- An approved request for more examination creates a real successor case.
-- Resolving the first review must not lose the approved next action.
begin;
create table private.franchise_governance_review_followups_v1(
 proposal_id uuid primary key references private.franchise_governance_review_proposals_v1(id),request_id uuid not null unique references private.franchise_governance_review_requests_v1(id),created_at timestamptz not null default clock_timestamp()
);
revoke all on private.franchise_governance_review_followups_v1 from public,anon,authenticated,service_role;
create trigger franchise_governance_review_followups_immutable before update or delete on private.franchise_governance_review_followups_v1 for each row execute function private.prevent_franchise_history_change();
create or replace function public.approve_franchise_governance_review_v1(p_proposal_id uuid,p_decision text,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p private.franchise_governance_review_proposals_v1%rowtype;q private.franchise_governance_review_requests_v1%rowtype;org uuid;h text;r jsonb;w public.admin_work_items%rowtype;claim jsonb;key_hash text;followup uuid;
begin
 select *into p from private.franchise_governance_review_proposals_v1 where id=p_proposal_id;select *into q from private.franchise_governance_review_requests_v1 where id=p.request_id for update;
 if a is null then raise exception 'UNAUTHENTICATED'using errcode='28000';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2'then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_MFA_REQUIRED'using errcode='42501';end if;
 if p.id is null or not private.franchise_governance_independent_reviewer_v1(q.franchise_id)or a=p.proposed_by or a=q.requested_by then raise exception 'FRANCHISE_GOVERNANCE_SECOND_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 perform private.lock_franchise_governance_authority_v1(q.franchise_id);
 if not private.franchise_governance_independent_reviewer_v1(q.franchise_id)or a=p.proposed_by or a=q.requested_by then raise exception 'FRANCHISE_GOVERNANCE_SECOND_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 if p_decision is null or p_decision not in('APPROVE','REJECT')or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_INVALID'using errcode='22023';end if;
 select operator_organization_id into org from public.franchises where id=q.franchise_id;
 h:=private.canonical_request_hash(jsonb_build_object('proposal',p.id,'decision',p_decision,'reason',p_reason,'sourceHash',p.evidence_hash));r:=private.begin_contract_command(org,'franchise.governance.review.approve.v1',p_idempotency_key,h,a);if r is not null then return r;end if;
 if exists(select 1 from private.franchise_governance_review_approvals_v1 where proposal_id=p.id)then raise exception 'FRANCHISE_GOVERNANCE_REVIEW_ALREADY_DECIDED'using errcode='55000';end if;
 insert into private.franchise_governance_review_approvals_v1(proposal_id,decision,reason,decided_by)values(p.id,p_decision,p_reason,a);
 if p_decision='APPROVE'then
  select *into w from public.admin_work_items where resource_type='franchise_governance_signal_review'and resource_id=q.id::text and status in('OPEN','CLAIMED','WAITING_INFORMATION')order by created_at limit 1 for update;
  if found then
   key_hash:=private.canonical_request_hash(jsonb_build_object('key',p_idempotency_key));
   if w.status='OPEN'then claim:=public.claim_admin_work_item(w.id,w.row_version,'Prise en charge de la revue indépendante','governance-claim:'||key_hash);w.row_version:=(claim->>'row_version')::integer;end if;
   perform public.resolve_admin_work_item(w.id,'GOVERNANCE_REVIEW_RECORDED',p_reason,jsonb_build_object('proposalId',p.id,'sourceHash',p.evidence_hash,'noSanctionApplied',true),w.row_version,'governance-resolve:'||key_hash);
  end if;
 end if;
 if p_decision='APPROVE'and p.outcome='FURTHER_REVIEW_REQUIRED'then
  followup:=private.queue_franchise_governance_review_v1(q.snapshot_id,'SYSTEM_FACT','Examen complémentaire approuvé pour la conclusion '||p.id::text,null);
  insert into private.franchise_governance_review_followups_v1(proposal_id,request_id)values(p.id,followup);
 end if;
 r:=jsonb_build_object('outcome','FRANCHISE_GOVERNANCE_REVIEW_DECIDED','proposalId',p.id,'decision',p_decision,'requestId',q.id,'noSanctionApplied',true,'followUpRequestId',followup);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,a,'USER','franchise.governance.review_decided','franchise_governance_review',q.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'franchise_governance_review',q.id::text,'FranchiseGovernanceReviewDecidedV1',extensions.gen_random_uuid(),r,'franchise-governance-decision:'||p.id::text);
 perform private.finish_contract_command(org,'franchise.governance.review.approve.v1',p_idempotency_key,r);return r;
end$$;

commit;
