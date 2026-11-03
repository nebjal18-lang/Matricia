-- Revalidate the acting writer after locking role authority as well as the owner.
begin;
create or replace function public.record_franchise_control_plan_event_v1(p_plan_id uuid,p_kind text,p_comment text,p_progress_percent integer,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p public.franchise_control_plan_proposals_v1%rowtype;e public.franchise_control_plan_events_v1%rowtype;current_owner uuid;assignment uuid;w public.admin_work_items%rowtype;claim jsonb;key_hash text;
begin
 select *into p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;
 if a is null or not found or not private.franchise_native_control_read_access_v1(p.franchise_id)then raise exception 'FRANCHISE_CONTROL_PLAN_DENIED'using errcode='42501';end if;
 current_owner:=private.franchise_control_current_owner_v1(p.id);
 if p_kind in('APPROVED','REJECTED','COMPLETED')then
  if not private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)or coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'FRANCHISE_CONTROL_ADMIN_AAL2_REQUIRED'using errcode='42501';end if;
  if a=p.suggested_owner_user_id or a=current_owner or exists(select 1 from public.organization_memberships mem join public.franchises f on f.operator_organization_id=mem.organization_id where f.id=p.franchise_id and mem.user_id=a and mem.status='ACTIVE')then raise exception 'FRANCHISE_CONTROL_PLAN_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
 elsif p_kind in('COMMENT','PROGRESS')then
  if not(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],a)or(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)and coalesce(auth.jwt()->>'aal','')='aal2'))then raise exception 'FRANCHISE_CONTROL_PLAN_DENIED'using errcode='42501';end if;
 else raise exception 'FRANCHISE_CONTROL_PLAN_EVENT_INVALID'using errcode='22023';end if;
 if length(coalesce(p_idempotency_key,''))not between 8 and 200 then raise exception 'FRANCHISE_CONTROL_PLAN_EVENT_INVALID'using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));
 select *into e from public.franchise_control_plan_events_v1 where plan_id=p.id and actor_user_id=a and idempotency_key=p_idempotency_key;
 if found then if e.kind<>p_kind or e.comment<>p_comment or e.progress_percent is distinct from p_progress_percent then raise exception 'FRANCHISE_CONTROL_PLAN_EVENT_CONFLICT'using errcode='23514';end if;
 else
  current_owner:=private.franchise_control_current_owner_v1(p.id);
  perform private.lock_franchise_control_owner_authority_v1(p.id,current_owner);
  if p_kind in('COMMENT','PROGRESS')and not(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],a)or(private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'],a)and coalesce(auth.jwt()->>'aal','')='aal2'))then raise exception 'FRANCHISE_CONTROL_PLAN_DENIED'using errcode='42501';end if;
  if p_kind in('APPROVED','REJECTED','COMPLETED')and not private.franchise_control_owner_admin_v1(p.id)then raise exception 'FRANCHISE_CONTROL_PLAN_INDEPENDENT_REVIEW_REQUIRED'using errcode='42501';end if;
  if p_kind in('PROGRESS','COMPLETED')and not coalesce(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],current_owner),false)then raise exception 'FRANCHISE_CONTROL_OWNER_REASSIGNMENT_REQUIRED'using errcode='23514';end if;
  if p_kind='APPROVED'then
   select q.id into assignment from private.franchise_control_owner_requests_v1 q join private.franchise_control_owner_decisions_v1 d on d.request_id=q.id where q.plan_id=p.id and d.decision='APPROVE'order by d.version desc limit 1;
   if not found then raise exception 'FRANCHISE_CONTROL_OWNER_ASSIGNMENT_APPROVAL_REQUIRED'using errcode='23514';end if;
  end if;
  if p_kind='APPROVED'and(current_owner is null or not private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],current_owner))then raise exception 'FRANCHISE_CONTROL_PLAN_ACTIVE_OWNER_REQUIRED'using errcode='23514';end if;
  if p_kind in('APPROVED','REJECTED')and exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('APPROVED','REJECTED','COMPLETED'))then raise exception 'FRANCHISE_CONTROL_PLAN_DECISION_ALREADY_RECORDED'using errcode='23514';end if;
  if p_kind in('PROGRESS','COMPLETED')and exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('REJECTED','COMPLETED'))then raise exception 'FRANCHISE_CONTROL_PLAN_CLOSED'using errcode='23514';end if;
  if p_kind='COMPLETED'and exists(select 1 from jsonb_array_elements(p.objectives)o where not exists(select 1 from public.franchise_control_reports_v1 r where r.franchise_id=p.franchise_id and r.generated_at>p.created_at and(r.axis_scores->>(o->>'axis'))::integer>=(o->>'targetScoreBps')::integer))then raise exception 'FRANCHISE_CONTROL_REMEASUREMENT_REQUIRED'using errcode='23514';end if;
  if p_kind='COMPLETED'and not exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind='APPROVED')then raise exception 'FRANCHISE_CONTROL_PLAN_APPROVAL_REQUIRED'using errcode='23514';end if;
  insert into public.franchise_control_plan_events_v1(plan_id,kind,comment,progress_percent,actor_user_id,idempotency_key)values(p.id,p_kind,p_comment,p_progress_percent,a,p_idempotency_key)returning *into e;
  if p_kind='APPROVED'then insert into private.franchise_control_approval_owners_v1(plan_id,event_id,owner_user_id,assignment_request_id,origin)values(p.id,e.id,current_owner,assignment,'GOVERNED_ASSIGNMENT_AT_APPROVAL');end if;
  if p_kind in('REJECTED','COMPLETED')then
   select *into w from public.admin_work_items where resource_type='franchise_control_plan_owner'and resource_id=p.id::text and status in('OPEN','CLAIMED','WAITING_INFORMATION')order by created_at limit 1 for update;
   if found then
    key_hash:=private.canonical_request_hash(jsonb_build_object('plan',p.id,'event',e.id,'key',p_idempotency_key));
    if w.status='OPEN'then claim:=public.claim_admin_work_item(w.id,w.row_version,'Prise en charge du plan correctif','control-plan-claim:'||key_hash);w.row_version:=(claim->>'row_version')::integer;end if;
    perform public.resolve_admin_work_item(w.id,'FRANCHISE_CONTROL_PLAN_CLOSED',left('Clôture gouvernée du plan : '||p_comment,2000),jsonb_build_object('planId',p.id,'eventId',e.id,'kind',e.kind,'nativeRemeasurementRequired',p_kind='COMPLETED'),w.row_version,'control-plan-resolve:'||key_hash);
   end if;
  end if;
  insert into public.audit_events(actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(a,'USER','franchise.control.plan_event','franchise_control_plan',p.id::text,extensions.gen_random_uuid(),jsonb_build_object('eventId',e.id,'kind',e.kind),repeat('0',64));
  insert into public.event_outbox(aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values('franchise_control_plan',p.id::text,'FranchiseControlPlanEventRecordedV1',extensions.gen_random_uuid(),jsonb_build_object('planId',p.id,'eventId',e.id,'kind',e.kind),'franchise-control-plan-event:'||e.id::text);
 end if;
 return jsonb_build_object('outcome','FRANCHISE_CONTROL_PLAN_EVENT_RECORDED','eventId',e.id);
end$$;

commit;
