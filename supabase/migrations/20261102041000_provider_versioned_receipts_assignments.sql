begin;
-- Corrective deliveries retain each prior receipt. A technician's operational
-- scope is an explicit mission assignment, never every mission of their employer.
alter table public.acceptance_checklists add column delivery_version integer not null default 0 check(delivery_version>=0);
-- Attribute existing decisions to the version actually present at decision time;
-- no past decision is copied onto a later corrective delivery.
update public.acceptance_checklists a set delivery_version=coalesce((
 select max(v.version) from public.delivery_versions v where v.deliverable_id=a.deliverable_id
 and(a.decided_at is null or v.submitted_at<=a.decided_at)),0);
alter table public.acceptance_checklists drop constraint acceptance_checklists_deliverable_id_criterion_key_key;
alter table public.acceptance_checklists add unique(deliverable_id,delivery_version,criterion_key);
-- Existing corrective versions that were already submitted before this fix
-- also receive a fresh pending receipt; the old decision stays on its own version.
insert into public.acceptance_checklists(mission_id,deliverable_id,delivery_version,criterion_key)
select a.mission_id,a.deliverable_id,d.current_version,a.criterion_key from public.deliverables d join public.acceptance_checklists a on a.deliverable_id=d.id
where d.status='SUBMITTED'and d.current_version>0
and a.delivery_version=(select max(b.delivery_version)from public.acceptance_checklists b where b.deliverable_id=d.id)
and a.delivery_version<d.current_version;
create function private.initialize_delivery_receipt_v1() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.version=1 then
  update public.acceptance_checklists set delivery_version=1 where deliverable_id=new.deliverable_id and delivery_version=0 and status='PENDING';
 else
  insert into public.acceptance_checklists(mission_id,deliverable_id,delivery_version,criterion_key)
  select a.mission_id,a.deliverable_id,new.version,a.criterion_key from public.acceptance_checklists a
  where a.deliverable_id=new.deliverable_id and a.delivery_version=(select max(b.delivery_version)from public.acceptance_checklists b where b.deliverable_id=new.deliverable_id and b.delivery_version<new.version);
 end if;
 return new;
end$$;
create trigger delivery_receipt_initialize_v1 after insert on public.delivery_versions for each row execute function private.initialize_delivery_receipt_v1();
create function private.preserve_delivery_receipt_v1() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if tg_op='DELETE' or old.status<>'PENDING' or new.deliverable_id<>old.deliverable_id or new.criterion_key<>old.criterion_key or new.mission_id<>old.mission_id then
  raise exception 'IMMUTABLE_DELIVERY_RECEIPT' using errcode='55000';
 end if;
 return new;
end$$;
create trigger delivery_receipt_immutable_v1 before update or delete on public.acceptance_checklists for each row execute function private.preserve_delivery_receipt_v1();

create table public.provider_mission_assignments_v1(
 mission_id uuid not null references public.missions(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 assigned_by uuid not null references auth.users(id),assigned_at timestamptz not null default clock_timestamp(),
 revoked_by uuid references auth.users(id),revoked_at timestamptz,
 primary key(mission_id,user_id),check((revoked_at is null)=(revoked_by is null))
);
alter table public.provider_mission_assignments_v1 enable row level security;
create function private.provider_mission_access_v1(p_mission_id uuid,p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_actor is not null and exists(select 1 from public.missions m where m.id=p_mission_id and(
 private.has_org_role(m.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_ACCOUNTING','PROVIDER_VIEWER'],p_actor)
 or(private.has_org_role(m.provider_organization_id,array['PROVIDER_TECHNICIAN'],p_actor)and exists(select 1 from public.provider_mission_assignments_v1 a where a.mission_id=m.id and a.user_id=p_actor and a.revoked_at is null))))
$$;
create or replace function private.mission_party_access(p_mission_id uuid,p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_actor is not null and(exists(select 1 from public.missions m where m.id=p_mission_id and private.is_active_org_member(m.client_organization_id,p_actor))or private.provider_mission_access_v1(p_mission_id,p_actor)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'],p_actor))
$$;
create or replace function private.contract_party_access(p_contract_id uuid,p_actor uuid default auth.uid())returns boolean language sql stable security definer set search_path=pg_catalog,public,private as $$
 select p_actor is not null and(exists(select 1 from public.contracts c where c.id=p_contract_id and(private.is_active_org_member(c.client_organization_id,p_actor)or private.has_org_role(c.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_SALES','PROVIDER_ACCOUNTING','PROVIDER_VIEWER'],p_actor)))or exists(select 1 from public.missions m where m.contract_id=p_contract_id and private.provider_mission_access_v1(m.id,p_actor))or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR'],p_actor))
$$;
create policy provider_mission_assignment_read on public.provider_mission_assignments_v1 for select to authenticated using(private.provider_mission_access_v1(mission_id)or private.has_platform_role(array['SUPER_ADMIN','MATRICIA_ADMIN','READ_ONLY_AUDITOR']));
revoke all on public.provider_mission_assignments_v1 from public,anon,authenticated,service_role;
grant select on public.provider_mission_assignments_v1 to authenticated;
create function public.assign_provider_mission_v1(p_mission_id uuid,p_user_id uuid,p_assigned boolean,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();m public.missions%rowtype;h text;r jsonb;
begin
 select * into m from public.missions where id=p_mission_id for update;
 if a is null or m.id is null or not private.has_org_role(m.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],a)then raise exception'ASSIGNMENT_MANAGE_DENIED'using errcode='42501';end if;
 if p_assigned is null or length(btrim(coalesce(p_reason,'')))not between 3 and 1000 or not private.has_org_role(m.provider_organization_id,array['PROVIDER_TECHNICIAN'],p_user_id)then raise exception'INVALID_MISSION_ASSIGNMENT'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('mission',m.id,'user',p_user_id,'assigned',p_assigned,'reason',p_reason));
 r:=private.begin_contract_command(m.provider_organization_id,'mission.assignment.v1',p_idempotency_key,h,a);if r is not null then return r;end if;
 if p_assigned then
  insert into public.provider_mission_assignments_v1(mission_id,user_id,assigned_by)values(m.id,p_user_id,a)
  on conflict(mission_id,user_id)do update set assigned_by=a,assigned_at=clock_timestamp(),revoked_by=null,revoked_at=null;
 else update public.provider_mission_assignments_v1 set revoked_by=a,revoked_at=clock_timestamp()where mission_id=m.id and user_id=p_user_id and revoked_at is null;end if;
 r:=jsonb_build_object('outcome','MISSION_ASSIGNMENT_RECORDED','mission_id',m.id,'user_id',p_user_id,'assigned',p_assigned);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(m.provider_organization_id,a,'USER','mission.assignment.recorded','mission',m.id::text,p_correlation_id,r||jsonb_build_object('reason',p_reason),repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(m.provider_organization_id,'mission',m.id::text,'MissionAssignmentRecordedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(m.provider_organization_id,'mission.assignment.v1',p_idempotency_key,r);return r;
end$$;
-- Preserve all installed proof, scan, signature and state guards. Add the same
-- assignment check inside the existing authenticated mutation commands.
do $patch$declare sig text;src text;needle text;replacement text;begin
 for sig,needle,replacement in select * from(values
 ('public.submit_delivery(uuid,text,jsonb,jsonb,text,uuid)',
 'not private.has_org_role(m.provider_organization_id,array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN''],a)',
 '(not private.has_org_role(m.provider_organization_id,array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN''],a) or not private.provider_mission_access_v1(m.id,a))'),
 ('public.complete_mission_checklist_item(uuid,text,uuid,text,uuid)',
 'not private.has_org_role(m.provider_organization_id,array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN''],a)',
 '(not private.has_org_role(m.provider_organization_id,array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN''],a) or not private.provider_mission_access_v1(m.id,a))'),
 ('public.submit_mission_milestone(uuid,integer,text,uuid)',
 'not private.has_org_role(v_milestone.owner_organization_id, array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN''], v_actor)',
 '(not private.has_org_role(v_milestone.owner_organization_id, array[''PROVIDER_OWNER'',''PROVIDER_MANAGER'',''PROVIDER_TECHNICIAN''], v_actor) or not private.provider_mission_access_v1(v_mission.id,v_actor))')
 )x(sig,needle,replacement) loop
  src:=pg_get_functiondef(sig::regprocedure);if position(needle in src)=0 then raise exception'PROVIDER_ASSIGNMENT_GUARD_SOURCE_DRIFT:%',sig;end if;execute replace(src,needle,replacement);
 end loop;
 -- Receipt decisions are scoped to the current immutable delivery version.
 src:=pg_get_functiondef('public.accept_delivery(uuid,jsonb,text,uuid)'::regprocedure);
 needle:='where deliverable_id=d.id';
 if position(needle in src)=0 then raise exception'ACCEPTANCE_GUARD_SOURCE_DRIFT';end if;
 src:=replace(src,needle,'where deliverable_id=d.id and delivery_version=d.current_version');
 src:=replace(src,'where id=p_deliverable_id;','where id=p_deliverable_id for update;');
 execute src;
end$patch$;

create table public.mission_milestone_corrections_v1(
 id uuid primary key default extensions.gen_random_uuid(),milestone_id uuid not null references public.mission_milestones(id),
 prior_row_version integer not null,prior_snapshot jsonb not null,reason text not null check(length(btrim(reason))between 3 and 2000),
 submitted_by uuid not null references auth.users(id),submitted_at timestamptz not null default clock_timestamp(),unique(milestone_id,prior_row_version)
);
alter table public.mission_milestone_corrections_v1 enable row level security;
create policy milestone_correction_read on public.mission_milestone_corrections_v1 for select to authenticated using(private.mission_party_access((select m.mission_id from public.mission_milestones m where m.id=milestone_id)));
create trigger milestone_correction_immutable before update or delete on public.mission_milestone_corrections_v1 for each row execute function private.prevent_contract_immutable_change();
revoke all on public.mission_milestone_corrections_v1 from public,anon,authenticated,service_role;grant select on public.mission_milestone_corrections_v1 to authenticated;
create function public.resubmit_mission_milestone_v1(p_milestone_id uuid,p_expected_row_version integer,p_reason text,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private,extensions as $$
declare a uuid:=auth.uid();i public.mission_milestones%rowtype;m public.missions%rowtype;h text;r jsonb;correction_id uuid;
begin
 select * into i from public.mission_milestones where id=p_milestone_id for update;
 select * into m from public.missions where id=i.mission_id;
 if a is null or m.id is null or not private.has_org_role(m.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_TECHNICIAN'],a)or not private.provider_mission_access_v1(m.id,a)then raise exception'MILESTONE_SUBMIT_DENIED'using errcode='42501';end if;
 if length(btrim(coalesce(p_reason,'')))not between 3 and 2000 then raise exception'CORRECTION_REASON_REQUIRED'using errcode='22023';end if;
 h:=private.canonical_request_hash(jsonb_build_object('milestone',i.id,'version',p_expected_row_version,'reason',p_reason));
 r:=private.begin_contract_command(m.provider_organization_id,'mission.milestone.correct.v1',p_idempotency_key,h,a);if r is not null then return r;end if;
 if i.status<>'REJECTED' or i.row_version<>p_expected_row_version then raise exception'INVALID_MILESTONE_TRANSITION'using errcode='55000';end if;
 insert into public.mission_milestone_corrections_v1(milestone_id,prior_row_version,prior_snapshot,reason,submitted_by)values(i.id,i.row_version,to_jsonb(i),p_reason,a)returning id into correction_id;
 update public.mission_milestones set status='IN_PROGRESS',decided_at=null where id=i.id;
 r:=public.submit_mission_milestone(i.id,p_expected_row_version,'correction:'||p_idempotency_key,p_correlation_id);
 r:=r||jsonb_build_object('outcome','MILESTONE_CORRECTION_SUBMITTED','reason',p_reason,'correction_id',correction_id);
 insert into public.audit_events(organization_id,actor_user_id,actor_type,action,resource_type,resource_id,correlation_id,metadata,event_hash)values(m.provider_organization_id,a,'USER','mission.milestone.corrected','mission_milestone',i.id::text,p_correlation_id,r,repeat('0',64));
 insert into public.event_outbox(organization_id,aggregate_type,aggregate_id,event_type,correlation_id,payload,idempotency_key)values(m.provider_organization_id,'mission',m.id::text,'MissionMilestoneCorrectionSubmittedV1',p_correlation_id,r,p_idempotency_key);
 perform private.finish_contract_command(m.provider_organization_id,'mission.milestone.correct.v1',p_idempotency_key,r);return r;
end$$;
revoke all on function private.initialize_delivery_receipt_v1(),private.preserve_delivery_receipt_v1(),private.provider_mission_access_v1(uuid,uuid),public.assign_provider_mission_v1(uuid,uuid,boolean,text,text,uuid),public.resubmit_mission_milestone_v1(uuid,integer,text,text,uuid)from public,anon,authenticated,service_role;
grant execute on function private.provider_mission_access_v1(uuid,uuid),public.assign_provider_mission_v1(uuid,uuid,boolean,text,text,uuid),public.resubmit_mission_milestone_v1(uuid,integer,text,text,uuid)to authenticated;

create function public.accept_delivery_version_v1(p_deliverable_id uuid,p_expected_delivery_version integer,p_decisions jsonb,p_idempotency_key text,p_correlation_id uuid default extensions.gen_random_uuid())returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare d public.deliverables%rowtype;m public.missions%rowtype;
begin
 select * into d from public.deliverables where id=p_deliverable_id for update;
 select * into m from public.missions where id=d.mission_id;
 if auth.uid()is null or m.id is null or not private.has_org_role(m.client_organization_id,array['CLIENT_OWNER','CLIENT_ADMIN'],auth.uid())then raise exception'DELIVERY_ACCEPT_DENIED'using errcode='42501';end if;
 if p_expected_delivery_version is null or d.current_version<>p_expected_delivery_version then raise exception'DELIVERY_VERSION_CHANGED'using errcode='40001';end if;
 return public.accept_delivery(d.id,p_decisions,p_idempotency_key,p_correlation_id);
end$$;
create function public.list_provider_mission_assignment_options_v1(p_organization_id uuid)returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,private as $$
begin
 if auth.uid()is null or not private.has_org_role(p_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER'],auth.uid())then raise exception'ASSIGNMENT_MANAGE_DENIED'using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'display_name',u.display_name)order by u.display_name,u.id)from public.user_profiles u where private.has_org_role(p_organization_id,array['PROVIDER_TECHNICIAN'],u.id)),'[]'::jsonb);
end$$;
revoke all on function public.accept_delivery_version_v1(uuid,integer,jsonb,text,uuid),public.list_provider_mission_assignment_options_v1(uuid)from public,anon,authenticated,service_role;
grant execute on function public.accept_delivery_version_v1(uuid,integer,jsonb,text,uuid),public.list_provider_mission_assignment_options_v1(uuid)to authenticated;
-- Storage writes require the same authorized mission as operational commands.
alter policy delivery_proof_storage_insert on storage.objects with check(
 bucket_id='delivery-proofs'and(storage.foldername(name))[1]=auth.uid()::text
 and coalesce((storage.foldername(name))[2],'')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 and exists(select 1 from public.deliverables d join public.missions m on m.id=d.mission_id
 where d.id=(case when coalesce((storage.foldername(name))[2],'')~*'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'then(storage.foldername(name))[2]::uuid end)
 and m.status in('ACTIVE','DELIVERY_SUBMITTED')and private.has_org_role(m.provider_organization_id,array['PROVIDER_OWNER','PROVIDER_MANAGER','PROVIDER_TECHNICIAN'],auth.uid())and private.provider_mission_access_v1(m.id,auth.uid()))
);

commit;
