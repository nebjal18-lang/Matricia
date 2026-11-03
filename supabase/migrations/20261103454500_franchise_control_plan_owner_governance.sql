-- Plan proposals retain their original suggested owner. Reassignments append
-- two independent human decisions; a revoked owner never silently falls back.
begin;
create table private.franchise_control_owner_requests_v1(
 id uuid primary key default extensions.gen_random_uuid(),plan_id uuid not null references public.franchise_control_plan_proposals_v1(id),
 owner_user_id uuid not null references auth.users(id),expected_version integer not null check(expected_version>=0),
 reason text not null check(length(btrim(reason))between 10 and 2000),proposed_by uuid not null references auth.users(id),created_at timestamptz not null default clock_timestamp(),unique(id,plan_id)
);
create table private.franchise_control_owner_decisions_v1(
 request_id uuid primary key,plan_id uuid not null,decision text not null check(decision in('APPROVE','REJECT')),
 version integer check(version>0),reason text not null check(length(btrim(reason))between 10 and 2000),decided_by uuid not null references auth.users(id),decided_at timestamptz not null default clock_timestamp(),
 foreign key(request_id,plan_id)references private.franchise_control_owner_requests_v1(id,plan_id),unique(plan_id,version),check((decision='APPROVE')=(version is not null))
);
create table private.franchise_control_approval_owners_v1(
 plan_id uuid primary key references public.franchise_control_plan_proposals_v1(id),event_id bigint not null unique references public.franchise_control_plan_events_v1(id),
 owner_user_id uuid not null references auth.users(id),assignment_request_id uuid references private.franchise_control_owner_requests_v1(id),
 origin text not null check(origin in('HISTORICAL_FROZEN_PROPOSAL','GOVERNED_ASSIGNMENT_AT_APPROVAL')),recorded_at timestamptz not null default clock_timestamp()
);
insert into private.franchise_control_approval_owners_v1(plan_id,event_id,owner_user_id,origin)
select distinct on(p.id)p.id,e.id,p.suggested_owner_user_id,'HISTORICAL_FROZEN_PROPOSAL'from public.franchise_control_plan_proposals_v1 p join public.franchise_control_plan_events_v1 e on e.plan_id=p.id and e.kind='APPROVED'where p.suggested_owner_user_id is not null order by p.id,e.id;
revoke all on private.franchise_control_owner_requests_v1,private.franchise_control_owner_decisions_v1,private.franchise_control_approval_owners_v1 from public,anon,authenticated,service_role;
do $$declare t text;begin foreach t in array array['franchise_control_owner_requests_v1','franchise_control_owner_decisions_v1','franchise_control_approval_owners_v1']loop execute format('create trigger %I before update or delete on private.%I for each row execute function private.prevent_franchise_history_change()',t||'_immutable',t);end loop;end$$;

create function private.franchise_control_owner_version_v1(p_plan_id uuid)returns integer language sql stable security definer set search_path=pg_catalog as $$select coalesce(max(version),0)from private.franchise_control_owner_decisions_v1 where plan_id=p_plan_id and decision='APPROVE'$$;
create function private.franchise_control_current_owner_v1(p_plan_id uuid)returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select coalesce((select q.owner_user_id from private.franchise_control_owner_requests_v1 q join private.franchise_control_owner_decisions_v1 d on d.request_id=q.id where q.plan_id=p_plan_id and d.decision='APPROVE'order by d.version desc limit 1),(select owner_user_id from private.franchise_control_approval_owners_v1 where plan_id=p_plan_id),(select suggested_owner_user_id from public.franchise_control_plan_proposals_v1 where id=p_plan_id))
$$;
create function private.franchise_control_owner_admin_v1(p_plan_id uuid)returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select auth.uid()is not null and coalesce(auth.jwt()->>'aal','')='aal2'and private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN'])and exists(select 1 from public.franchise_control_plan_proposals_v1 p join public.franchises f on f.id=p.franchise_id where p.id=p_plan_id and auth.uid()is distinct from p.suggested_owner_user_id and auth.uid()is distinct from private.franchise_control_current_owner_v1(p.id)and not exists(select 1 from public.organization_memberships m where m.organization_id=f.operator_organization_id and m.user_id=auth.uid()and m.status='ACTIVE'))
$$;
create function private.franchise_control_owner_candidates_v1(p_plan_id uuid,p_search text)returns table(user_id uuid,display_name text,n bigint)language sql stable security definer set search_path=pg_catalog as $$
 select m.user_id,u.display_name,row_number()over(order by m.id)from public.organization_memberships m join public.franchises f on f.operator_organization_id=m.organization_id join public.franchise_control_plan_proposals_v1 p on p.franchise_id=f.id left join public.user_profiles u on u.id=m.user_id where p.id=p_plan_id and m.status='ACTIVE'and private.has_franchise_role(f.id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],m.user_id)and(p_search=''or position(lower(p_search)in lower(coalesce(u.display_name,'')))>0)
$$;
create function private.franchise_control_owner_context_v1(p_plan_id uuid,p_member_search text default '',p_before_request_at timestamptz default null,p_before_request_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare p public.franchise_control_plan_proposals_v1%rowtype;owner_id uuid;active_owner boolean;independent_admin boolean;closed boolean;approved boolean;
begin
 select *into strict p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;owner_id:=private.franchise_control_current_owner_v1(p.id);
 active_owner:=coalesce(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],owner_id),false);independent_admin:=private.franchise_control_owner_admin_v1(p.id);
 closed:=exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('REJECTED','COMPLETED'));approved:=exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind='APPROVED');
 return jsonb_build_object('organizationId',(select operator_organization_id from public.franchises where id=p.franchise_id),'version',private.franchise_control_owner_version_v1(p.id),'ownerUserId',owner_id,'ownerName',(select display_name from public.user_profiles where id=owner_id),'ownerActive',active_owner,'ownerConfirmed',private.franchise_control_owner_version_v1(p.id)>0 or exists(select 1 from private.franchise_control_approval_owners_v1 where plan_id=p.id),'historicalSuggestedOwnerUserId',p.suggested_owner_user_id,
 'canProgress',not closed and active_owner and(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'])or independent_admin),'canProposeAssignment',independent_admin and not closed and not exists(select 1 from private.franchise_control_owner_requests_v1 q where q.plan_id=p.id and not exists(select 1 from private.franchise_control_owner_decisions_v1 d where d.request_id=q.id)),
 'canApprovePlan',independent_admin and not closed and not approved and active_owner and private.franchise_control_owner_version_v1(p.id)>0,
 'canRejectPlan',independent_admin and not closed and not approved,
 'canCompletePlan',independent_admin and not closed and approved and active_owner and not exists(select 1 from jsonb_array_elements(p.objectives)o where not exists(select 1 from public.franchise_control_reports_v1 r where r.franchise_id=p.franchise_id and r.generated_at>p.created_at and(r.axis_scores->>(o->>'axis'))::integer>=(o->>'targetScoreBps')::integer)),
 'candidates',case when independent_admin and not closed then coalesce((select jsonb_agg(jsonb_build_object('id',x.user_id,'name',x.display_name,'index',x.n)order by x.n)from(select *from private.franchise_control_owner_candidates_v1(p.id,p_member_search)limit 50)x),'[]')else'[]'::jsonb end,
 'candidateCount',case when independent_admin then(select count(*)from private.franchise_control_owner_candidates_v1(p.id,p_member_search))else 0 end,
 'requests',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'ownerUserId',q.owner_user_id,'ownerName',(select display_name from public.user_profiles where id=q.owner_user_id),'createdAt',q.created_at,'decision',d.decision,'version',d.version,'canReview',independent_admin and not closed and q.proposed_by<>auth.uid()and d.request_id is null)order by q.created_at desc,q.id)from(select *from private.franchise_control_owner_requests_v1 where plan_id=p.id and(p_before_request_at is null or(created_at,id)<(p_before_request_at,p_before_request_id))order by created_at desc,id desc limit 25)q left join private.franchise_control_owner_decisions_v1 d on d.request_id=q.id),'[]'),
 'nextRequestCursor',(select jsonb_build_object('before',q.created_at,'id',q.id)from private.franchise_control_owner_requests_v1 q where q.plan_id=p.id and(p_before_request_at is null or(q.created_at,q.id)<(p_before_request_at,p_before_request_id))and exists(select 1 from private.franchise_control_owner_requests_v1 older where older.plan_id=p.id and(older.created_at,older.id)<(q.created_at,q.id))order by q.created_at desc,q.id desc offset 24 limit 1),
 'assignmentRequestCount',(select count(*)from private.franchise_control_owner_requests_v1 where plan_id=p.id));
end$$;

create function public.get_franchise_control_owner_context_v1(p_plan_id uuid,p_member_search text default '',p_before_request_at timestamptz default null,p_before_request_id uuid default null)returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare franchise uuid;
begin if p_member_search is null or length(p_member_search)>120 or((p_before_request_at is null)<>(p_before_request_id is null))then raise exception 'FRANCHISE_CONTROL_OWNER_SEARCH_INVALID'using errcode='22023';end if;select franchise_id into franchise from public.franchise_control_plan_proposals_v1 where id=p_plan_id;if franchise is null or not private.franchise_native_control_read_access_v1(franchise)then raise exception 'FRANCHISE_CONTROL_OWNER_READ_DENIED'using errcode='42501';end if;return private.franchise_control_owner_context_v1(p_plan_id,p_member_search,p_before_request_at,p_before_request_id);end$$;

create function private.lock_franchise_control_owner_authority_v1(p_plan_id uuid,p_owner_user_id uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$
declare franchise uuid;org uuid;
begin
 select p.franchise_id,f.operator_organization_id into franchise,org from public.franchise_control_plan_proposals_v1 p join public.franchises f on f.id=p.franchise_id where p.id=p_plan_id;
 perform 1 from public.franchises f join public.franchise_mandate_versions v on v.id=f.current_mandate_version_id where f.id=franchise for share of f,v;
 perform 1 from public.platform_user_roles where user_id=auth.uid()for share;
 perform 1 from public.organization_memberships m where m.organization_id=org and m.user_id in(auth.uid(),p_owner_user_id)order by m.id for share;
 perform 1 from public.organization_member_roles r join public.organization_memberships m on m.id=r.membership_id where m.organization_id=org and m.user_id in(auth.uid(),p_owner_user_id)order by r.membership_id,r.role_code for share of r;
 perform 1 from public.organization_member_franchise_assignments a join public.organization_memberships m on m.id=a.membership_id where a.franchise_id=franchise and m.user_id in(auth.uid(),p_owner_user_id)order by a.membership_id,a.role_code for share of a;
end$$;

create function public.propose_franchise_control_owner_v1(p_plan_id uuid,p_owner_user_id uuid,p_expected_version integer,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();p public.franchise_control_plan_proposals_v1%rowtype;org uuid;h text;r jsonb;x uuid;
begin
 if a is null then raise exception 'UNAUTHENTICATED'using errcode='28000';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2'then raise exception 'FRANCHISE_CONTROL_OWNER_MFA_REQUIRED'using errcode='42501';end if;
 if not private.franchise_control_owner_admin_v1(p_plan_id)then raise exception 'FRANCHISE_CONTROL_OWNER_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_plan_id::text,0));select *into strict p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;select operator_organization_id into org from public.franchises where id=p.franchise_id;
 perform private.lock_franchise_control_owner_authority_v1(p.id,p_owner_user_id);
 if not private.franchise_control_owner_admin_v1(p.id)then raise exception 'FRANCHISE_CONTROL_OWNER_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 10 and 2000 or p_expected_version is null or p_expected_version<0 then raise exception 'FRANCHISE_CONTROL_OWNER_REQUEST_INVALID'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('plan',p.id,'owner',p_owner_user_id,'expected',p_expected_version,'reason',p_reason));r:=private.begin_contract_command(org,'franchise.control.owner.propose.v1',p_idempotency_key,h,a);if r is not null then return r;end if;
 if exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('REJECTED','COMPLETED'))then raise exception 'FRANCHISE_CONTROL_PLAN_CLOSED'using errcode='55000';end if;
 if private.franchise_control_owner_version_v1(p.id)<>p_expected_version then raise exception 'FRANCHISE_CONTROL_OWNER_STALE_VERSION'using errcode='40001';end if;
 if not coalesce(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],p_owner_user_id),false)then raise exception 'FRANCHISE_CONTROL_OWNER_NOT_AUTHORIZED'using errcode='23514';end if;
 if exists(select 1 from private.franchise_control_owner_requests_v1 q where q.plan_id=p.id and not exists(select 1 from private.franchise_control_owner_decisions_v1 d where d.request_id=q.id))then raise exception 'FRANCHISE_CONTROL_OWNER_REVIEW_PENDING'using errcode='55000';end if;
 insert into private.franchise_control_owner_requests_v1(plan_id,owner_user_id,expected_version,reason,proposed_by)values(p.id,p_owner_user_id,p_expected_version,p_reason,a)returning id into x;
 r:=jsonb_build_object('outcome','FRANCHISE_CONTROL_OWNER_PROPOSED','requestId',x,'planId',p.id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,a,'USER','franchise.control.owner_proposed','franchise_control_plan',p.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'franchise_control_plan',p.id::text,'FranchiseControlOwnerProposedV1',extensions.gen_random_uuid(),r,'franchise-control-owner-proposal:'||x::text);
 perform private.finish_contract_command(org,'franchise.control.owner.propose.v1',p_idempotency_key,r);return r;
end$$;

create function public.review_franchise_control_owner_v1(p_request_id uuid,p_decision text,p_reason text,p_idempotency_key text)returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare a uuid:=auth.uid();q private.franchise_control_owner_requests_v1%rowtype;p public.franchise_control_plan_proposals_v1%rowtype;org uuid;h text;r jsonb;v integer;
begin
 select *into q from private.franchise_control_owner_requests_v1 where id=p_request_id;select *into p from public.franchise_control_plan_proposals_v1 where id=q.plan_id;
 if a is null then raise exception 'UNAUTHENTICATED'using errcode='28000';end if;
 if coalesce(auth.jwt()->>'aal','')<>'aal2'then raise exception 'FRANCHISE_CONTROL_OWNER_MFA_REQUIRED'using errcode='42501';end if;
 if q.id is null or not private.franchise_control_owner_admin_v1(p.id)or q.proposed_by=a then raise exception 'FRANCHISE_CONTROL_OWNER_SECOND_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.id::text,0));select operator_organization_id into org from public.franchises where id=p.franchise_id;
 perform private.lock_franchise_control_owner_authority_v1(p.id,q.owner_user_id);
 if not private.franchise_control_owner_admin_v1(p.id)then raise exception 'FRANCHISE_CONTROL_OWNER_INDEPENDENT_ADMIN_REQUIRED'using errcode='42501';end if;
 if p_decision is null or p_decision not in('APPROVE','REJECT')or length(btrim(coalesce(p_reason,'')))not between 10 and 2000 then raise exception 'FRANCHISE_CONTROL_OWNER_REQUEST_INVALID'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('request',q.id,'decision',p_decision,'reason',p_reason));r:=private.begin_contract_command(org,'franchise.control.owner.review.v1',p_idempotency_key,h,a);if r is not null then return r;end if;
 if exists(select 1 from public.franchise_control_plan_events_v1 where plan_id=p.id and kind in('REJECTED','COMPLETED'))then raise exception 'FRANCHISE_CONTROL_PLAN_CLOSED'using errcode='55000';end if;
 if exists(select 1 from private.franchise_control_owner_decisions_v1 where request_id=q.id)then raise exception 'FRANCHISE_CONTROL_OWNER_ALREADY_REVIEWED'using errcode='55000';end if;
 if p_decision='APPROVE'then
  if private.franchise_control_owner_version_v1(p.id)<>q.expected_version then raise exception 'FRANCHISE_CONTROL_OWNER_STALE_VERSION'using errcode='40001';end if;
  if not coalesce(private.has_franchise_role(p.franchise_id,array['FRANCHISE_OWNER','FRANCHISE_MANAGER'],q.owner_user_id),false)then raise exception 'FRANCHISE_CONTROL_OWNER_NOT_AUTHORIZED'using errcode='23514';end if;
  v:=q.expected_version+1;
 end if;
 insert into private.franchise_control_owner_decisions_v1(request_id,plan_id,decision,version,reason,decided_by)values(q.id,p.id,p_decision,v,p_reason,a);
 r:=jsonb_build_object('outcome','FRANCHISE_CONTROL_OWNER_REVIEWED','requestId',q.id,'planId',p.id,'decision',p_decision,'version',v);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(org,a,'USER','franchise.control.owner_reviewed','franchise_control_plan',p.id::text,extensions.gen_random_uuid(),r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(org,'franchise_control_plan',p.id::text,'FranchiseControlOwnerReviewedV1',extensions.gen_random_uuid(),r,'franchise-control-owner-review:'||q.id::text);
 perform private.finish_contract_command(org,'franchise.control.owner.review.v1',p_idempotency_key,r);return r;
end$$;

-- One durable task follows the plan through assignment, independent approval,
-- remediation and native remeasurement. Assigning an owner does not close it.
create function private.queue_franchise_control_plan_v1(p_plan_id uuid)returns void language plpgsql security definer set search_path=pg_catalog as $$
declare p public.franchise_control_plan_proposals_v1%rowtype;f public.franchises%rowtype;
begin
 select *into strict p from public.franchise_control_plan_proposals_v1 where id=p_plan_id;
 select *into strict f from public.franchises where id=p.franchise_id;
 insert into public.admin_work_items(queue_version_id,organization_id,source_kind,resource_type,resource_id,title_fr,title_ar,priority,due_at,redacted_context,created_by)
 select id,f.operator_organization_id,'MANUAL_REVIEW','franchise_control_plan_owner',p.id::text,'Examiner et suivre le plan correctif','مراجعة وتتبع الخطة التصحيحية','MEDIUM',p.due_on::timestamp at time zone 'Africa/Casablanca',
 jsonb_build_object('plan_id',p.id,'franchise_id',p.franchise_id,'actor_origin','SYSTEM','configuration_author_reference',f.created_by,'no_sanction_applied',true),f.created_by
 from public.admin_queue_versions where queue_key='CENTRAL_APPROVALS'and status='ACTIVE'
 on conflict(queue_version_id,source_kind,resource_type,resource_id)do nothing;
end$$;
create function private.on_franchise_control_plan_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin perform private.queue_franchise_control_plan_v1(new.id);return new;end$$;
create trigger native_franchise_control_plan_queue after insert on public.franchise_control_plan_proposals_v1 for each row execute function private.on_franchise_control_plan_v1();
do $$declare p record;begin for p in select id from public.franchise_control_plan_proposals_v1 where not exists(select 1 from public.franchise_control_plan_events_v1 e where e.plan_id=franchise_control_plan_proposals_v1.id and e.kind in('REJECTED','COMPLETED'))loop perform private.queue_franchise_control_plan_v1(p.id);end loop;end$$;
create function private.guard_franchise_control_plan_resolution_v1()returns trigger language plpgsql security definer set search_path=pg_catalog as $$begin
 if new.resource_type='franchise_control_plan_owner'and new.status in('RESOLVED','DISMISSED')and not exists(select 1 from public.franchise_control_plan_events_v1 e where e.plan_id::text=new.resource_id and e.kind in('REJECTED','COMPLETED'))then raise exception 'FRANCHISE_CONTROL_PLAN_GOVERNED_CLOSURE_REQUIRED'using errcode='42501';end if;return new;
end$$;
create trigger native_franchise_control_plan_resolution before update of status on public.admin_work_items for each row execute function private.guard_franchise_control_plan_resolution_v1();
revoke all on function private.queue_franchise_control_plan_v1(uuid),private.on_franchise_control_plan_v1(),private.guard_franchise_control_plan_resolution_v1()from public,anon,authenticated,service_role;

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

create or replace function private.franchise_control_plan_page_v1(p_franchise_id uuid,p_report_ids uuid[],p_event_plan_id uuid,p_after_event_id bigint)returns jsonb language sql stable security definer set search_path=pg_catalog as $$
 select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
 'ownerContext',private.franchise_control_owner_context_v1(p.id),'events',coalesce((select jsonb_agg(to_jsonb(e)order by e.id)from(select *from public.franchise_control_plan_events_v1 e where e.plan_id=p.id and(e.id>case when p.id=p_event_plan_id then p_after_event_id else 0 end)order by e.id limit 50)e),'[]'),
 'eventCount',(select count(*)from public.franchise_control_plan_events_v1 e where e.plan_id=p.id),
 'nextEventAfter',(select case when exists(select 1 from public.franchise_control_plan_events_v1 following where following.plan_id=p.id and following.id>last.id)then last.id::text end from public.franchise_control_plan_events_v1 last where last.plan_id=p.id and last.id>case when p.id=p_event_plan_id then p_after_event_id else 0 end order by last.id offset 49 limit 1)
 )order by p.created_at desc,p.id),'[]')from public.franchise_control_plan_proposals_v1 p where p.franchise_id=p_franchise_id and p.report_id=any(p_report_ids)
$$;
revoke all on function private.lock_franchise_control_owner_authority_v1(uuid,uuid),private.franchise_control_owner_version_v1(uuid),private.franchise_control_current_owner_v1(uuid),private.franchise_control_owner_admin_v1(uuid),private.franchise_control_owner_context_v1(uuid,text,timestamptz,uuid),private.franchise_control_owner_candidates_v1(uuid,text)from public,anon,authenticated,service_role;
revoke all on function public.get_franchise_control_owner_context_v1(uuid,text,timestamptz,uuid),public.propose_franchise_control_owner_v1(uuid,uuid,integer,text,text),public.review_franchise_control_owner_v1(uuid,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.get_franchise_control_owner_context_v1(uuid,text,timestamptz,uuid),public.propose_franchise_control_owner_v1(uuid,uuid,integer,text,text),public.review_franchise_control_owner_v1(uuid,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
