-- A single latest comparable native report, after approval, must meet all goals.
-- Earlier improvements cannot be cherry-picked across reports or models.
begin;
create table private.franchise_control_completion_reports_v1(
 plan_id uuid primary key references public.franchise_control_plan_proposals_v1(id),event_id bigint not null unique references public.franchise_control_plan_events_v1(id),report_id uuid not null references public.franchise_control_reports_v1(id),recorded_at timestamptz not null default clock_timestamp()
);
revoke all on private.franchise_control_completion_reports_v1 from public,anon,authenticated,service_role;
create trigger franchise_control_completion_reports_immutable before update or delete on private.franchise_control_completion_reports_v1 for each row execute function private.prevent_franchise_history_change();
create function private.franchise_control_completion_measurement_v1(p_plan_id uuid)returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
declare p public.franchise_control_plan_proposals_v1%rowtype;basis public.franchise_control_reports_v1%rowtype;latest public.franchise_control_reports_v1%rowtype;approved_at timestamptz;
begin
 select *into p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;if not found then return null;end if;
 select *into strict basis from public.franchise_control_reports_v1 where id=p.report_id;
 select created_at into approved_at from public.franchise_control_plan_events_v1 where plan_id=p.id and kind='APPROVED'order by id limit 1;if not found then return null;end if;
 select *into latest from public.franchise_control_reports_v1 where franchise_id=p.franchise_id and kind=basis.kind order by period_end desc,generated_at desc,id desc limit 1;
 if not found or latest.model_id<>basis.model_id or latest.generated_at<=approved_at or latest.period_end<basis.period_end or latest.id=basis.id then return null;end if;
 if exists(select 1 from jsonb_array_elements(p.objectives)o where latest.axis_scores->>(o->>'axis')is null or(latest.axis_scores->>(o->>'axis'))::integer<(o->>'targetScoreBps')::integer)then return null;end if;
 return latest.id;
end$$;
revoke all on function private.franchise_control_completion_measurement_v1(uuid)from public,anon,authenticated,service_role;
create or replace function private.franchise_control_owner_context_v1(p_plan_id uuid,p_member_search text default '',p_before_request_at timestamptz default null,p_before_request_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare p public.franchise_control_plan_proposals_v1%rowtype;owner_id uuid;active_owner boolean;independent_admin boolean;closed boolean;approved boolean;
begin
 select *into strict p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;owner_id:=private.franchise_control_current_owner_v1(p.id);
 active_owner:=coalesce(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],owner_id),false);independent_admin:=private.franchise_control_owner_admin_v1(p.id);
 closed:=exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('REJECTED','COMPLETED'));approved:=exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind='APPROVED');
 return jsonb_build_object('organizationId',(select operator_organization_id from public.franchises where id=p.franchise_id),'version',private.franchise_control_owner_version_v1(p.id),'ownerUserId',owner_id,'ownerName',(select display_name from public.user_profiles where id=owner_id),'ownerActive',active_owner,'ownerConfirmed',private.franchise_control_owner_version_v1(p.id)>0 or exists(select 1 from private.franchise_control_approval_owners_v1 where plan_id=p.id),'historicalSuggestedOwnerUserId',p.suggested_owner_user_id,
 'canProgress',not closed and active_owner and(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or independent_admin),'canProposeAssignment',independent_admin and not closed and not exists(select 1 from private.franchise_control_owner_requests_v1 q where q.plan_id=p.id and not exists(select 1 from private.franchise_control_owner_decisions_v1 d where d.request_id=q.id)),
 'canApprovePlan',independent_admin and not closed and not approved and active_owner and private.franchise_control_owner_version_v1(p.id)>0,
 'canRejectPlan',independent_admin and not closed and not approved,
 'canCompletePlan',independent_admin and not closed and approved and active_owner and private.franchise_control_completion_measurement_v1(p.id)is not null,
 'candidates',case when independent_admin and not closed then coalesce((select jsonb_agg(jsonb_build_object('id',x.user_id,'name',x.display_name,'index',x.n)order by x.n)from(select *from private.franchise_control_owner_candidates_v1(p.id,p_member_search)limit 50)x),'[]')else'[]'::jsonb end,
 'candidateCount',case when independent_admin then(select count(*)from private.franchise_control_owner_candidates_v1(p.id,p_member_search))else 0 end,
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'ownerUserId',q.owner_user_id,'ownerName',(select display_name from public.user_profiles where id=q.owner_user_id),'createdAt',q.created_at,'decision',d.decision,'version',d.version,'canReview',independent_admin and not closed and q.proposed_by<>auth.uid()and d.request_id is null)order by q.created_at desc,q.id)from(select *from private.franchise_control_owner_requests_v1 where plan_id=p.id and(p_before_request_at is null or(created_at,id)<(p_before_request_at,p_before_request_id))order by created_at desc,id desc limit 25)q left join private.franchise_control_owner_decisions_v1 d on d.request_id=q.id),'[]'),
 'nextRequestCursor',(select jsonb_build_object('before',q.created_at,'id',q.id)from private.franchise_control_owner_requests_v1 q where q.plan_id=p.id and(p_before_request_at is null or(q.created_at,q.id)<(p_before_request_at,p_before_request_id))and exists(select 1 from private.franchise_control_owner_requests_v1 older where older.plan_id=p.id and(older.created_at,older.id)<(q.created_at,q.id))order by q.created_at desc,q.id desc offset 24 limit 1),
 'assignmentRequestCount',(select count(*)from private.franchise_control_owner_requests_v1 where plan_id=p.id));
end$$;

create or replace function public.record_franchise_control_plan_event_v1(p_plan_id uuid,p_kind text,p_comment text,p_progress_percent integer,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p public.franchise_control_plan_proposals_v1%rowtype;e public.franchise_control_plan_events_v1%rowtype;current_owner uuid;assignment uuid;measurement uuid;w public.admin_work_items%rowtype;claim jsonb;key_hash text;
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
  if p_kind='COMPLETED'then measurement:=private.franchise_control_completion_measurement_v1(p.id);if measurement is null then raise exception 'FRANCHISE_CONTROL_REMEASUREMENT_REQUIRED'using errcode='23514';end if;end if;
  if p_kind='COMPLETED'and not exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind='APPROVED')then raise exception 'FRANCHISE_CONTROL_PLAN_APPROVAL_REQUIRED'using errcode='23514';end if;
  insert into public.franchise_control_plan_events_v1(plan_id,kind,comment,progress_percent,actor_user_id,idempotency_key)values(p.id,p_kind,p_comment,p_progress_percent,a,p_idempotency_key)returning *into e;
  if p_kind='COMPLETED'then insert into private.franchise_control_completion_reports_v1(plan_id,event_id,report_id)values(p.id,e.id,measurement);end if;
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
